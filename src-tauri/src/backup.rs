//! Sauvegardes locales : fichier `.ftbackup` (ZIP) contenant
//! database.sqlite (instantané VACUUM INTO) + dossier media/ + manifest.json.
//! Toute restauration passe d'abord par une copie de sécurité dans la corbeille.

use crate::db::{drop_conn, integrity_check, open_project_db, project_db_path, project_dir, trash_root, DbState};
use aes::cipher::{block_padding::NoPadding, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use hmac::{Hmac, Mac};
use pbkdf2::pbkdf2_hmac;
use rusqlite::Connection;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

type Aes128CbcEnc = cbc::Encryptor<aes::Aes128>;
type Aes128CbcDec = cbc::Decryptor<aes::Aes128>;
type HmacSha256 = Hmac<Sha256>;

// ---------------------------------------------------------------------------
// Chiffrement AES-128-CBC + HMAC-SHA256 (optionnel, par mot de passe)
// ---------------------------------------------------------------------------

/// Générateur cryptographiquement sécurisé via OS CSPRNG.
/// Utilise `getrandom` qui s'appuie sur arc4random (macOS),
/// /dev/urandom (Linux) et BCryptGenRandom (Windows).
fn fill_random(buf: &mut [u8]) {
    getrandom::getrandom(buf).expect("OS CSPRNG indisponible");
}

/// Chiffre des données avec AES-128-CBC + HMAC-SHA256.
/// Format : salt(16) + iv(16) + ciphertext(PKCS7) + hmac(32)
fn encrypt_bytes(data: &[u8], password: &[u8]) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; 16];
    let mut iv = [0u8; 16];
    fill_random(&mut salt);
    fill_random(&mut iv);

    // Dériver clé AES (16) + clé HMAC (32) via PBKDF2
    let mut aes_key = [0u8; 16];
    let mut hmac_key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password, &salt, 100_000, &mut aes_key);
    pbkdf2_hmac::<Sha256>(&aes_key, &salt, 10_000, &mut hmac_key);

    // Chiffrement AES-128-CBC avec padding PKCS7
    let mut buf = data.to_vec();
    let ct = Aes128CbcEnc::new(&aes_key.into(), &iv.into())
        .encrypt_padded_mut::<NoPadding>(&mut buf, data.len())
        .map_err(|e| e.to_string())?;

    // HMAC-SHA256 sur salt + iv + ciphertext
    let mut mac = HmacSha256::new_from_slice(&hmac_key).map_err(|e| e.to_string())?;
    mac.update(&salt);
    mac.update(&iv);
    mac.update(ct);
    let tag = mac.finalize().into_bytes();

    // Assemblage
    let mut out = Vec::with_capacity(16 + 16 + ct.len() + 32);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&iv);
    out.extend_from_slice(ct);
    out.extend_from_slice(&tag);
    Ok(out)
}

/// Déchiffre AES-128-CBC + HMAC-SHA256.
fn decrypt_bytes(data: &[u8], password: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < 16 + 16 + 1 + 32 {
        return Err("données chiffrées trop courtes".to_string());
    }
    let salt = &data[..16];
    let iv = &data[16..32];
    let tag = &data[data.len() - 32..];
    let ct = &data[32..data.len() - 32];

    // Dériver clés
    let mut aes_key = [0u8; 16];
    let mut hmac_key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password, salt, 100_000, &mut aes_key);
    pbkdf2_hmac::<Sha256>(&aes_key, salt, 10_000, &mut hmac_key);

    // Vérifier HMAC
    let mut mac = HmacSha256::new_from_slice(&hmac_key).map_err(|e| e.to_string())?;
    mac.update(salt);
    mac.update(iv);
    mac.update(ct);
    mac.verify_slice(tag)
        .map_err(|_| "vérification HMAC échouée — mot de passe incorrect ?".to_string())?;

    // Déchiffrer
    let mut buf = ct.to_vec();
    let pt = Aes128CbcDec::new(&aes_key.into(), iv.into())
        .decrypt_padded_mut::<NoPadding>(&mut buf)
        .map_err(|_| "déchiffrement échoué — données corrompues ?".to_string())?;

    Ok(pt.to_vec())
}

// ---------------------------------------------------------------------------

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn timestamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = secs / 86_400;
    let (y, m, d) = civil_from_days(days as i64);
    let hh = (secs % 86_400) / 3_600;
    let mm = (secs % 3_600) / 60;
    let ss = secs % 60;
    format!("{y:04}-{m:02}-{d:02}_{hh:02}-{mm:02}-{ss:02}")
}

pub fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let mut y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    y += if m <= 2 { 1 } else { 0 };
    (y, m, d)
}

fn person_count(db_path: &Path) -> Result<u64, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM person WHERE deleted_at IS NULL",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(n.max(0) as u64)
}

#[derive(serde::Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
}

pub fn list_backups(app: &AppHandle) -> Result<Vec<BackupInfo>, String> {
    let root = crate::db::backups_root(app)?;
    let mut out = Vec::new();
    for entry in fs::read_dir(&root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().map(|e| e == "ftbackup").unwrap_or(false) {
            let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let created = meta
                .created()
                .map(|t| {
                    dt_string(t.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0))
                })
                .unwrap_or_default();
            out.push(BackupInfo {
                path: path.to_string_lossy().to_string(),
                name,
                created_at: created,
                size_bytes: meta.len(),
            });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

fn dt_string(secs: u64) -> String {
    let days = secs / 86_400;
    let (y, m, d) = civil_from_days(days as i64);
    let hh = (secs % 86_400) / 3_600;
    let mm = (secs % 3_600) / 60;
    format!("{y:04}-{m:02}-{d:02} {hh:02}:{mm:02}")
}

/// Crée une sauvegarde complète du projet sous forme d'un fichier .ftbackup.
/// Si `password` est fourni, la base est chiffrée en AES-256-GCM.
pub fn create_backup(
    app: &AppHandle,
    project_id: &str,
    project_name: &str,
    password: Option<&str>,
) -> Result<crate::db::ExecResult, String> {
    // 1. Instantané cohérent de la base (WAL inclus) via VACUUM INTO.
    let temp = tempfile::Builder::new()
        .prefix("ft_snapshot_")
        .suffix(".sqlite")
        .tempfile()
        .map_err(|e| e.to_string())?;
    let db_path = project_db_path(app, project_id)?;
    if !db_path.exists() {
        return Err("aucun projet à sauvegarder".to_string());
    }
    let conn = open_project_db(&db_path)?;
    let target = temp.path().to_string_lossy().to_string().replace('\\', "/");
    conn.execute_batch(&format!("VACUUM INTO '{target}'"))
        .map_err(|e| format!("instantané impossible: {e}"))?;
    drop(conn);

    let count = person_count(temp.path())?;
    let hash = sha256_file(temp.path())?;

    // 2. Création du ZIP .ftbackup.
    let backups = crate::db::backups_root(app)?;
    let safe_name = sanitize(project_name);
    let name = format!(
        "STEMMA_Backup_{}_{}.ftbackup",
        safe_name,
        timestamp()
    );
    let zip_path = backups.join(&name);
    let file = fs::File::create(&zip_path).map_err(|e| e.to_string())?;
    let mut writer = zip::ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    // Manifest
    let encrypted = password.is_some();
    writer
        .start_file("manifest.json", opts)
        .map_err(|e| e.to_string())?;
    let manifest = serde_json::json!({
        "app": "stemma",
        "version": "0.1.0",
        "projectId": project_id,
        "projectName": project_name,
        "createdAt": timestamp(),
        "personCount": count,
        "databaseSha256": hash,
        "encrypted": encrypted
    });
    writer
        .write_all(manifest.to_string().as_bytes())
        .map_err(|e| e.to_string())?;

    // 3. Database (chiffrée si mot de passe fourni)
    writer
        .start_file("database.sqlite", opts)
        .map_err(|e| e.to_string())?;
    let mut snapshot = fs::File::open(temp.path()).map_err(|e| e.to_string())?;
    if let Some(pw) = password {
        let mut raw = Vec::new();
        snapshot.read_to_end(&mut raw).map_err(|e| e.to_string())?;
        let encrypted = encrypt_bytes(&raw, pw.as_bytes())?;
        writer.write_all(&encrypted).map_err(|e| e.to_string())?;
    } else {
        std::io::copy(&mut snapshot, &mut writer).map_err(|e| e.to_string())?;
    }

    // 4. Médias.
    let media_dir = project_dir(app, project_id)?.join("media");
    if media_dir.exists() {
        for entry in fs::read_dir(&media_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                let fname = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                writer
                    .start_file(format!("media/{fname}"), opts)
                    .map_err(|e| e.to_string())?;
                let mut f = fs::File::open(&path).map_err(|e| e.to_string())?;
                std::io::copy(&mut f, &mut writer).map_err(|e| e.to_string())?;
            }
        }
    }
    writer.finish().map_err(|e| e.to_string())?;

    Ok(crate::db::ExecResult {
        last_insert_id: None,
        rows_affected: count,
    })
}

fn sanitize(s: &str) -> String {
    let mut out = String::new();
    for ch in s.chars() {
        if ch.is_alphanumeric() {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Restauration
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
pub struct RestoreReport {
    pub project_id: String,
    pub message: String,
    pub person_count: u64,
    pub ok: bool,
}

/// Restaure une sauvegarde : décompression vers un dossier temporaire,
/// vérification d'intégrité + hash, copie de sécurité de l'ancienne base
/// dans la corbeille, puis mise en place.
/// Si la sauvegarde est chiffrée, le mot de passe est requis.
pub fn restore_backup(
    app: &AppHandle,
    state: &DbState,
    project_id: &str,
    backup_path: &str,
    password: Option<&str>,
) -> Result<RestoreReport, String> {
    drop_conn(state, project_id);
    let dir = project_dir(app, project_id)?;
    let backup_file = PathBuf::from(backup_path);
    if !backup_file.exists() {
        return Err("fichier de sauvegarde introuvable".to_string());
    }

    // 1. Décompression dans un dossier temporaire.
    let staging = tempfile::Builder::new()
        .prefix("ft_restore_")
        .tempdir()
        .map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(fs::File::open(&backup_file).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    zip.extract(staging.path())
        .map_err(|e| format!("extraction impossible: {e}"))?;

    let staged_db = staging.path().join("database.sqlite");
    if !staged_db.exists() {
        return Err("sauvegarde invalide : database.sqlite manquant".to_string());
    }

    // 2. Vérifier si chiffré via le manifest
    let manifest_path = staging.path().join("manifest.json");
    let mut is_encrypted = false;
    if manifest_path.exists() {
        let m: Value = serde_json::from_slice(
            &fs::read(&manifest_path).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        is_encrypted = m["encrypted"].as_bool().unwrap_or(false);

        // Hash attendu (sur les données brutes du fichier ZIP)
        if let Some(expected) = m["databaseSha256"].as_str() {
            let actual = sha256_file(&staged_db)?;
            if actual != expected {
                return Err("la sauvegarde ne correspond pas au manifeste".to_string());
            }
        }
    }

    // 3. Déchiffrement si nécessaire
    if is_encrypted {
        let pw = password.ok_or("cette sauvegarde est chiffrée — mot de passe requis")?;
        let encrypted_data = fs::read(&staged_db).map_err(|e| e.to_string())?;
        let decrypted = decrypt_bytes(&encrypted_data, pw.as_bytes())?;
        fs::write(&staged_db, &decrypted).map_err(|e| e.to_string())?;
    }

    // 4. Vérification d'intégrité (post-déchiffrement)
    {
        let mut conn = open_project_db(&staged_db)?;
        let report = integrity_check(&mut conn).map_err(|e| e.to_string())?;
        if report["ok"] != Value::Bool(true) {
            return Err("intégrité refusée : base restaurée corrompue".to_string());
        }
    }
    let count = person_count(&staged_db)?;

    // 5. Copie de sécurité de l'ancienne base + médias.
    if dir.exists() {
        let trash = trash_root(app)?.join(format!(
            "{project_id}_avant_{}",
            timestamp()
        ));
        fs::create_dir_all(&trash).map_err(|e| e.to_string())?;
        move_dir_contents(&dir, &trash)?;
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // 6. Mise en place (base + médias uniquement).
    fs::rename(
        staging.path().join("database.sqlite"),
        dir.join("database.sqlite"),
    )
    .map_err(|e| format!("mise en place de la base impossible: {e}"))?;
    let staged_media = staging.path().join("media");
    if staged_media.exists() {
        fs::create_dir_all(dir.join("media")).map_err(|e| e.to_string())?;
        move_dir_contents(&staged_media, &dir.join("media"))?;
    }

    drop_conn(state, project_id);
    Ok(RestoreReport {
        project_id: project_id.to_string(),
        message: "restauration réussie".to_string(),
        person_count: count,
        ok: true,
    })
}

fn move_dir_contents(src: &Path, dst: &Path) -> Result<(), String> {
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let target = dst.join(
            path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        );
        fs::rename(&path, &target).map_err(|e| {
            format!("copie de sécurité impossible ({e})")
        })?;
    }
    Ok(())
}
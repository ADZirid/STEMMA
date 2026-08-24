//! Commandes Tauri exposées au frontend.
//! Principe : le Rust reste un socle fin (acquisition, projets, sauvegardes,
//! médias) ; tout le SQL applicatif est écrit côté TypeScript et passe par
//! db_exec / db_query / db_transaction avec des paramètres liés.

use crate::backup;
use crate::db::{self, data_root, DbState, ExecResult, Statement};
use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

type CmdResult<T> = Result<T, String>;

// ---------------------------------------------------------------------------
// Pont SQL générique
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn db_exec(
    app: AppHandle,
    state: State<DbState>,
    project_id: String,
    sql: String,
    params: Vec<Value>,
) -> CmdResult<ExecResult> {
    db::with_conn(&app, &state, &project_id, |conn| {
        db::exec(conn, &sql, &params)
    })
}

#[tauri::command]
pub fn db_query(
    app: AppHandle,
    state: State<DbState>,
    project_id: String,
    sql: String,
    params: Vec<Value>,
) -> CmdResult<Value> {
    db::with_conn(&app, &state, &project_id, |conn| {
        db::query(conn, &sql, &params)
    })
}

#[tauri::command]
pub fn db_transaction(
    app: AppHandle,
    state: State<DbState>,
    project_id: String,
    statements: Vec<Statement>,
) -> CmdResult<Value> {
    db::with_conn(&app, &state, &project_id, |conn| {
        db::transaction(conn, &statements)
    })
}

#[tauri::command]
pub fn integrity_check(
    app: AppHandle,
    state: State<DbState>,
    project_id: String,
) -> CmdResult<Value> {
    db::with_conn(&app, &state, &project_id, |conn| {
        db::integrity_check(conn)
    })
}

#[tauri::command]
pub fn backup_create(
    app: AppHandle,
    project_id: String,
    project_name: String,
    password: Option<String>,
) -> CmdResult<ExecResult> {
    crate::backup::create_backup(&app, &project_id, &project_name, password.as_deref())
}

#[tauri::command]
pub fn backup_list(app: AppHandle) -> CmdResult<Vec<backup::BackupInfo>> {
    crate::backup::list_backups(&app)
}

#[tauri::command]
pub fn backup_restore(
    app: AppHandle,
    state: State<DbState>,
    project_id: String,
    backup_path: String,
    password: Option<String>,
) -> CmdResult<backup::RestoreReport> {
    crate::backup::restore_backup(&app, &state, &project_id, &backup_path, password.as_deref())
}

// ---------------------------------------------------------------------------
// Projets (un projet = un dossier = une base SQLite + un dossier media)
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub person_count: u64,
    pub union_count: u64,
    pub source_count: u64,
    pub media_count: u64,
}

fn projects_file(app: &AppHandle) -> CmdResult<PathBuf> {
    Ok(data_root(app)?.join("projects.json"))
}

fn read_projects_json(path: &Path) -> CmdResult<Vec<Value>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    Ok(serde_json::from_str(&raw).map_err(|e| e.to_string())?)
}

fn write_projects_json(path: &Path, projects: &[Value]) -> CmdResult<()> {
    fs::write(
        path,
        serde_json::to_string_pretty(projects).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

fn project_meta(state: &DbState, app: &AppHandle, id: &str) -> CmdResult<(u64, u64, u64, u64)> {
    db::with_conn(app, state, id, |conn: &mut Connection| {
        let one = |sql: &str| -> Result<u64, String> {
            conn.query_row(sql, [], |r| r.get::<_, i64>(0))
                .map(|n| n.max(0) as u64)
                .map_err(|e| e.to_string())
        };
        let p = one("SELECT COUNT(*) FROM person WHERE deleted_at IS NULL")?;
        let u = one("SELECT COUNT(*) FROM union_family WHERE deleted_at IS NULL")?;
        let s = one("SELECT COUNT(*) FROM source")?;
        let m = one("SELECT COUNT(*) FROM media")?;
        Ok((p, u, s, m))
    })
}

#[tauri::command]
pub fn project_list(app: AppHandle, state: State<DbState>) -> CmdResult<Vec<ProjectInfo>> {
    let file = projects_file(&app)?;
    let items = read_projects_json(&file)?;
    let mut out = Vec::new();
    for item in items {
        let id = item["id"].as_str().unwrap_or("").to_string();
        let (p, u, s, m) = if id.is_empty() {
            (0, 0, 0, 0)
        } else {
            project_meta(&state, &app, &id).unwrap_or((0, 0, 0, 0))
        };
        out.push(ProjectInfo {
            id,
            name: item["name"].as_str().unwrap_or("").to_string(),
            created_at: item["created_at"].as_str().unwrap_or("").to_string(),
            updated_at: item["updated_at"].as_str().unwrap_or("").to_string(),
            person_count: p,
            union_count: u,
            source_count: s,
            media_count: m,
        });
    }
    out.sort_by(|a, b| a.updated_at.cmp(&b.updated_at).reverse());
    Ok(out)
}

#[tauri::command]
pub fn project_create(app: AppHandle, name: String) -> CmdResult<ProjectInfo> {
    if name.trim().is_empty() {
        return Err("le nom du projet est obligatoire".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_utc();
    let dir = db::project_dir(&app, &id)?;
    fs::create_dir_all(dir.join("media")).map_err(|e| e.to_string())?;
    db::open_project_db(&dir.join("familytree.db"))?;

    let mut items = read_projects_json(&projects_file(&app)?)?;
    items.push(serde_json::json!({
        "id": id,
        "name": name.trim().to_string(),
        "created_at": now,
        "updated_at": now
    }));
    write_projects_json(&projects_file(&app)?, &items)?;
    Ok(ProjectInfo {
        id,
        name: name.trim().to_string(),
        created_at: now.clone(),
        updated_at: now,
        person_count: 0,
        union_count: 0,
        source_count: 0,
        media_count: 0,
    })
}

fn now_utc() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = (secs / 86_400) as i64;
    let (y, m, d) = crate::backup::civil_from_days(days);
    let hh = (secs % 86_400) / 3_600;
    let mm = (secs % 3_600) / 60;
    let ss = secs % 60;
    format!("{y:04}-{m:02}-{d:02}T{hh:02}:{mm:02}:{ss:02}Z")
}

#[tauri::command]
pub fn project_rename(app: AppHandle, id: String, name: String) -> CmdResult<ProjectInfo> {
    if name.trim().is_empty() {
        return Err("le nom du projet est obligatoire".to_string());
    }
    let file = projects_file(&app)?;
    let mut items = read_projects_json(&file)?;
    for item in items.iter_mut() {
        if item["id"] == Value::String(id.clone()) {
            item["name"] = Value::String(name.trim().to_string());
            item["updated_at"] = Value::String(now_utc());
        }
    }
    write_projects_json(&file, &items)?;
    let item = items
        .iter()
        .find(|it| it["id"] == Value::String(id.clone()))
        .cloned()
        .ok_or("projet introuvable")?;
    Ok(ProjectInfo {
        id,
        name: item["name"].as_str().unwrap_or("").to_string(),
        created_at: item["created_at"].as_str().unwrap_or("").to_string(),
        updated_at: item["updated_at"].as_str().unwrap_or("").to_string(),
        person_count: 0,
        union_count: 0,
        source_count: 0,
        media_count: 0,
    })
}

/// Corbeille : sauvegarde automatique puis déplacement du dossier projet.
#[tauri::command]
pub fn project_trash(app: AppHandle, state: State<DbState>, id: String) -> CmdResult<String> {
    let name = project_name(&app, &id)?;
    crate::backup::create_backup(&app, &id, &name, None)?;
    let target = db::project_dir(&app, &id)?;
    let trash = db::trash_root(&app)?;
    let dest = trash.join(format!("{id}_{}", crate::backup::timestamp()));
    if target.exists() {
        fs::rename(&target, &dest).map_err(|e| e.to_string())?;
    }
    db::drop_conn(&state, &id);
    let file = projects_file(&app)?;
    let items: Vec<Value> = read_projects_json(&file)?
        .into_iter()
        .filter(|it| it["id"] != Value::String(id.clone()))
        .collect();
    write_projects_json(&file, &items)?;
    Ok(format!("projet « {name} » déplacé dans la corbeille"))
}

#[tauri::command]
pub fn trash_list(app: AppHandle) -> CmdResult<Vec<Value>> {
    let trash = db::trash_root(&app)?;
    let mut out = Vec::new();
    if let Ok(rd) = fs::read_dir(&trash) {
        for entry in rd.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            out.push(serde_json::json!({
                "name": name,
                "path": entry.path().to_string_lossy().to_string(),
            }));
        }
    }
    out.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    Ok(out)
}

#[tauri::command]
pub fn trash_restore(app: AppHandle, name: String) -> CmdResult<String> {
    let trash = db::trash_root(&app)?;
    let project_id = name.split('_').next().unwrap_or("").to_string();
    let src = trash.join(&name);
    if !src.exists() {
        return Err("élément introuvable dans la corbeille".to_string());
    }
    let dest = db::project_dir(&app, &project_id)?;
    if dest.exists() {
        return Err("un projet existe déjà avec cet identifiant".to_string());
    }
    fs::rename(&src, &dest).map_err(|e| e.to_string())?;
    let file = projects_file(&app)?;
    let mut items = read_projects_json(&file)?;
    if !items.iter().any(|it| it["id"] == Value::String(project_id.clone())) {
        items.push(serde_json::json!({
            "id": project_id,
            "name": format!("projet restauré"),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }));
        write_projects_json(&file, &items)?;
    }
    Ok("projet restauré depuis la corbeille".to_string())
}

fn project_name(app: &AppHandle, id: &str) -> CmdResult<String> {
    let file = projects_file(app)?;
    let items = read_projects_json(&file)?;
    Ok(items
        .iter()
        .find(|it| it["id"] == Value::String(id.to_string()))
        .map(|it| it["name"].as_str().unwrap_or("projet").to_string())
        .unwrap_or_else(|| "projet".to_string()))
}

// ---------------------------------------------------------------------------
// Médias (déplacés dans le dossier media/ du projet, jamais sur Internet)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct MediaRecord {
    pub id: String,
    pub original_name: String,
    pub file_type: String,
    pub size_bytes: u64,
    pub rel_path: String,
    pub abs_path: String,
    pub created_at: String,
}

fn detect_type(name: &str) -> String {
    let ext = Path::new(name)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "jpg" | "jpeg" => "jpg".to_string(),
        "png" => "png".to_string(),
        "webp" => "webp".to_string(),
        "pdf" => "pdf".to_string(),
        _ => "autre".to_string(),
    }
}

#[tauri::command]
pub fn media_import(app: AppHandle, state: State<DbState>, project_id: String, source_path: String) -> CmdResult<MediaRecord> {
    let src = PathBuf::from(&source_path);
    if !src.exists() {
        return Err("fichier source introuvable".to_string());
    }
    let ext = src
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();
    let id = uuid::Uuid::new_v4().to_string();
    let file_name = format!("{id}.{ext}");
    let media_dir = db::project_dir(&app, &project_id)?.join("media");
    fs::create_dir_all(&media_dir).map_err(|e| e.to_string())?;
    let dest = media_dir.join(&file_name);
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    let original_name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let now = now_utc();
    let rel_path = format!("media/{file_name}");
    // Insertion en base + lien éventuel fourni séparément.
    let _ = db::with_conn(&app, &state, &project_id, |conn: &mut Connection| {
        conn.execute(
            "INSERT INTO media(id, original_name, file_type, size_bytes, description, rel_path, created_at, updated_at)
             VALUES(?1,?2,?3,?4,'',?5,?6,?6)",
            rusqlite::params![id, original_name, detect_type(&original_name), size, rel_path, now],
        )
        .map_err(|e| e.to_string())
    });
    Ok(MediaRecord {
        id,
        original_name: original_name.clone(),
        file_type: detect_type(&original_name),
        size_bytes: size,
        rel_path,
        abs_path: dest.to_string_lossy().to_string(),
        created_at: now,
    })
}

#[tauri::command]
pub fn media_list(app: AppHandle, project_id: String) -> CmdResult<Value> {
    let dir = db::project_dir(&app, &project_id)?.join("media");
    let mut out = Vec::new();
    if let Ok(rd) = fs::read_dir(&dir) {
        for entry in rd.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                let ftype = detect_type(&fname);
                out.push(serde_json::json!({
                    "abs_path": path.to_string_lossy().to_string(),
                    "rel_path": format!("media/{fname}"),
                    "file_type": ftype,
                    "size_bytes": fs::metadata(&path).map(|m| m.len()).unwrap_or(0),
                }));
            }
        }
    }
    out.sort_by(|a, b| a["rel_path"].as_str().cmp(&b["rel_path"].as_str()));
    Ok(serde_json::json!({ "files": out, "dir": dir.to_string_lossy().to_string() }))
}

#[tauri::command]
pub fn media_path(app: AppHandle, project_id: String, rel_path: String) -> CmdResult<String> {
    Ok(db::project_dir(&app, &project_id)?
        .join(&rel_path)
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
pub fn media_delete(app: AppHandle, state: State<DbState>, project_id: String, id: String) -> CmdResult<()> {
    let row: Option<(String,)> = db::with_conn(&app, &state, &project_id, |conn: &mut Connection| {
        conn.query_row("SELECT rel_path FROM media WHERE id=?1", rusqlite::params![id], |r| {
            Ok((r.get::<_, String>(0)?,))
        })
        .optional()
        .map_err(|e| e.to_string())
    })?;
    if let Some((rel_path,)) = row {
        let f = db::project_dir(&app, &project_id)?.join(rel_path);
        if f.exists() {
            fs::remove_file(&f).map_err(|e| e.to_string())?;
        }
    }
    let _ = db::with_conn(&app, &state, &project_id, |conn: &mut Connection| {
        conn.execute(
            "DELETE FROM media WHERE id=?1; DELETE FROM media_link WHERE media_id=?1",
            rusqlite::params![id],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    });
    Ok(())
}

// ---------------------------------------------------------------------------
// Lecture de fichier texte (pour import GEDCOM, etc.)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn read_file_text(path: String) -> CmdResult<String> {
    fs::read_to_string(&path).map_err(|e| format!("Impossible de lire le fichier : {e}"))
}
//! Couche d'accès à SQLite : gestion des connexions par projet,
//! migrations et pont SQL (exécution + requêtes paramétrées + transactions).

use rusqlite::{params_from_iter, Connection, Row};
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub const SCHEMA_V1: &str = include_str!("../migrations/0001_schema.sql");

/// État global : connexions SQLite ouvertes, une par projet.
#[derive(Default)]
pub struct DbState {
    pub conns: Mutex<HashMap<String, Mutex<Connection>>>,
}

/// Racine des données : mode portable (data/ à côté de l'exe) ou APPDATA.
pub fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
    // Mode portable : si un fichier "portable" existe à côté de l'exe,
    // on stocke tout dans ./data/ au lieu de %APPDATA%.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let marker = exe_dir.join("portable");
            if marker.exists() {
                let root = exe_dir.join("data");
                std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
                return Ok(root);
            }
        }
    }
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?)
}

pub fn projects_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = data_root(app)?.join("projects");
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

pub fn backups_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = data_root(app)?.join("backups");
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

pub fn trash_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = data_root(app)?.join("trash");
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

pub fn project_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    Ok(projects_root(app)?.join(project_id))
}

pub fn project_db_path(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    Ok(project_dir(app, project_id)?.join("familytree.db"))
}

/// Ouvre (ou crée) la base d'un projet, applique les migrations si besoin.
pub fn open_project_db(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    init_db(&conn)?;
    Ok(conn)
}

/// Applique le schéma + pragmas de robustesse (WAL, foreign_keys, journal dur).
pub fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA synchronous=FULL;",
    )
    .map_err(|e| e.to_string())?;
    conn.execute_batch(SCHEMA_V1).map_err(|e| e.to_string())
}

/// Renvoie la connexion d'un projet, en l'ouvrant si nécessaire.
pub fn with_conn<T>(
    app: &AppHandle,
    state: &DbState,
    project_id: &str,
    f: impl FnOnce(&mut Connection) -> Result<T, String>,
) -> Result<T, String> {
    let mut map = state.conns.lock().map_err(|e| e.to_string())?;
    if !map.contains_key(project_id) {
        let path = project_db_path(app, project_id)?;
        let conn = open_project_db(&path)?;
        map.insert(project_id.to_string(), Mutex::new(conn));
    }
    let mut conn = map
        .get(project_id)
        .ok_or("projet introuvable")?
        .lock()
        .map_err(|e| e.to_string())?;
    f(&mut conn)
}

/// Rouvre la connexion d'un projet (après restauration/déplacement).
pub fn reset_conn(state: &DbState, project_id: &str) {
    if let Ok(mut map) = state.conns.lock() {
        map.remove(project_id);
    }
}

/// Ferme la connexion d'un projet tombé dans la corbeille.
pub fn drop_conn(state: &DbState, project_id: &str) {
    reset_conn(state, project_id);
}

// ---------------------------------------------------------------------------
// Conversion JSON <-> SQLite
// ---------------------------------------------------------------------------

/// Encodage minimal hexadécimal (débogage des BLOB, non utilisé en production).
fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0F) as usize] as char);
    }
    out
}

pub fn json_to_sql(v: &Value) -> rusqlite::types::Value {
    match v {
        Value::Null => rusqlite::types::Value::Null,
        Value::Bool(b) => rusqlite::types::Value::Integer(*b as i64),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else if let Some(u) = n.as_u64() {
                rusqlite::types::Value::Integer(u.min(i64::MAX as u64) as i64)
            } else {
                rusqlite::types::Value::Real(n.as_f64().unwrap_or(0.0))
            }
        }
        Value::String(s) => rusqlite::types::Value::Text(s.clone()),
        _ => rusqlite::types::Value::Null,
    }
}

pub fn row_to_json(row: &Row) -> rusqlite::Result<Value> {
    let mut obj = Map::new();
    let mut seen: HashMap<String, usize> = HashMap::new();
    let ncols = row.as_ref().column_count();
    for i in 0..ncols {
        let col = row
            .as_ref()
            .column_name(i)
            .unwrap_or(&"")
            .to_string();
        let val: rusqlite::types::Value = row.get(i)?;
        let jv = match val {
            rusqlite::types::Value::Null => Value::Null,
            rusqlite::types::Value::Integer(n) => Value::from(n),
            rusqlite::types::Value::Real(f) => serde_json::Number::from_f64(f)
                .map(Value::Number)
                .unwrap_or(Value::Null),
            rusqlite::types::Value::Text(t) => Value::String(t),
            rusqlite::types::Value::Blob(b) => Value::String(format!("hex:{}=>{}", hex_encode(&b), b.len())),
        };
        let key = match seen.get(&col) {
            Some(n) => {
                let n = *n + 1;
                seen.insert(col.clone(), n);
                format!("{col}{n}")
            }
            None => {
                seen.insert(col.clone(), 1);
                col
            }
        };
        obj.insert(key, jv);
    }
    Ok(Value::Object(obj))
}

// ---------------------------------------------------------------------------
// Pont SQL
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
pub struct ExecResult {
    pub last_insert_id: Option<i64>,
    pub rows_affected: u64,
}

#[derive(serde::Deserialize)]
pub struct Statement {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<Value>,
}

/// Exécute un unique SQL paramétré (valeurs liées, aucune concaténation).
pub fn exec(
    conn: &mut Connection,
    sql: &str,
    params: &[Value],
) -> Result<ExecResult, String> {
    let values: Vec<rusqlite::types::Value> =
        params.iter().map(json_to_sql).collect();
    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| format!("SQL invalide: {e}"))?;
    let rows_affected = stmt
        .execute(params_from_iter(values.iter()))
        .map_err(|e| format!("échec d'exécution: {e}"))?;
    let last_insert_id = conn.last_insert_rowid();
    let last_insert_id = if rows_affected > 0 && last_insert_id > 0 {
        Some(last_insert_id)
    } else {
        None
    };
    Ok(ExecResult {
        last_insert_id,
        rows_affected: rows_affected as u64,
    })
}

/// Exécute une requête de lecture paramétrée.
pub fn query(
    conn: &mut Connection,
    sql: &str,
    params: &[Value],
) -> Result<Value, String> {
    let values: Vec<rusqlite::types::Value> =
        params.iter().map(json_to_sql).collect();
    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| format!("SQL invalide: {e}"))?;
    let mut rows = stmt
        .query(params_from_iter(values.iter()))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        out.push(row_to_json(row).map_err(|e| e.to_string())?);
    }
    Ok(Value::Array(out))
}

/// Exécute une liste de statements dans une unique transaction (tout ou rien).
pub fn transaction(
    conn: &mut Connection,
    statements: &[Statement],
) -> Result<Value, String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("impossible d'ouvrir une transaction: {e}"))?;
    let mut results = Vec::new();
    for s in statements {
        let values: Vec<rusqlite::types::Value> =
            s.params.iter().map(json_to_sql).collect();
        let mut stmt = tx
            .prepare(&s.sql)
            .map_err(|e| format!("SQL invalide: {e}"))?;
        let affected = stmt
            .execute(params_from_iter(values.iter()))
            .map_err(|e| format!("échec d'exécution: {e}"))?;
        results.push(serde_json::json!({ "rows_affected": affected }));
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(Value::Array(results))
}

/// Vérifie l'intégrité de la base (PRAGMA integrity_check).
pub fn integrity_check(conn: &mut Connection) -> Result<Value, String> {
    let mut lines: Vec<String> = Vec::new();
    let mut stmt = conn
        .prepare("PRAGMA integrity_check")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let s: String = row.get(0).map_err(|e| e.to_string())?;
        lines.push(s);
    }
    let ok = lines.iter().all(|l| l == "ok");
    Ok(serde_json::json!({ "ok": ok, "details": lines }))
}

// ---------------------------------------------------------------------------
// Tests unitaires (aucune fenêtre Tauri requise)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_db() -> tempfile::NamedTempFile {
        tempfile::Builder::new()
            .prefix("ft_test_")
            .suffix(".sqlite")
            .tempfile()
            .expect("temp db")
    }

    #[test]
    fn init_et_schema() {
        let file = tmp_db();
        let conn = open_project_db(file.path()).expect("open");
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM person", [], |r| r.get(0))
            .expect("count");
        assert_eq!(n, 0);
        let v: String = conn
            .query_row(
                "SELECT value FROM meta WHERE key='schema_version'",
                [],
                |r| r.get(0),
            )
            .expect("version");
        assert_eq!(v, "1");
    }

    #[test]
    fn exec_query_transaction() {
        let file = tmp_db();
        let mut conn = open_project_db(file.path()).expect("open");
        let r = exec(
            &mut conn,
            "INSERT INTO person(id, given_name, surname) VALUES('p1','Jean','Dupont')",
            &[],
        )
        .expect("exec");
        assert_eq!(r.rows_affected, 1);

        let rows = query(&mut conn, "SELECT surname FROM person WHERE id='p1'", &[])
            .expect("query");
        assert_eq!(rows[0]["surname"], Value::String("Dupont".to_string()));

        let res = transaction(
            &mut conn,
            &[Statement {
                sql: "INSERT INTO person(id, given_name, surname) VALUES('p2','Marie','Martin')"
                    .to_string(),
                params: vec![],
            }],
        )
        .expect("transaction");
        assert_eq!(res[0]["rows_affected"], Value::from(1));

        let integrity = integrity_check(&mut conn).expect("check");
        assert_eq!(integrity["ok"], Value::Bool(true));
    }

    #[test]
    fn params_lies() {
        let file = tmp_db();
        let mut conn = open_project_db(file.path()).expect("open");
        let sql = "INSERT INTO person(id, given_name, surname) VALUES(?1, ?2, ?3)";
        let r = exec(
            &mut conn,
            sql,
            &[
                Value::String("x".into()),
                Value::String("Paul".into()),
                Value::String("Durand".into()),
            ],
        )
        .expect("exec");
        assert_eq!(r.rows_affected, 1);
        // Tentative d'injection neutralisée par le paramétrage.
        let r2 = exec(
            &mut conn,
            "INSERT INTO person(id, given_name, surname) VALUES(?1, ?2, ?3)",
            &[
                Value::String("y".into()),
                Value::String("' OR 1=1 --".into()),
                Value::String("Toto".into()),
            ],
        )
        .expect("exec2");
        assert_eq!(r2.rows_affected, 1);
    }

    #[test]
    fn cascade_et_soft_delete() {
        let file = tmp_db();
        let mut conn = open_project_db(file.path()).expect("open");
        exec(
            &mut conn,
            "INSERT INTO person(id, given_name, surname) VALUES('p','Jean','Dupont')",
            &[],
        )
        .unwrap();
        exec(
            &mut conn,
            "INSERT INTO union_family(id, type) VALUES('u','mariage')",
            &[],
        )
        .unwrap();
        exec(
            &mut conn,
            "INSERT INTO union_partner(union_id, person_id) VALUES('u','p')",
            &[],
        )
        .unwrap();
        // Soft delete : la personne reste en base.
        exec(
            &mut conn,
            "UPDATE person SET deleted_at=datetime('now') WHERE id='p'",
            &[],
        )
        .unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM person", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
    }
}
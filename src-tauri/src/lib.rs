mod backup;
mod commands;
mod db;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Dossiers de données locales garantis dès le démarrage.
            let root = db::data_root(app.handle())?;
            std::fs::create_dir_all(root.join("projects"))?;
            std::fs::create_dir_all(root.join("backups"))?;
            std::fs::create_dir_all(root.join("trash"))?;
            // Fenêtre principale agrandie, avec titre applicatif.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_title("STEMMA");
                let _ = win.set_size(tauri::LogicalSize::new(1280.0, 820.0));
            }
            Ok(())
        })
        .manage(db::DbState {
            conns: Mutex::new(std::collections::HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            // Pont SQL
            commands::db_exec,
            commands::db_query,
            commands::db_transaction,
            commands::integrity_check,
            // Projets
            commands::project_list,
            commands::project_create,
            commands::project_rename,
            commands::project_trash,
            commands::trash_list,
            commands::trash_restore,
            // Sauvegardes
            commands::backup_create,
            commands::backup_list,
            commands::backup_restore,
            // Médias
            commands::media_import,
            commands::media_list,
            commands::media_path,
            commands::media_delete,
            commands::read_file_text,
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors de l'exécution de STEMMA");
}
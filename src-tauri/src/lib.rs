mod config;
mod fonts;
mod pty;
mod serial;
mod session;
mod ssh;

use session::SessionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SessionManager::new())
        .invoke_handler(tauri::generate_handler![
            pty::pty_spawn,
            ssh::ssh_connect,
            serial::serial_list_ports,
            serial::serial_connect,
            session::session_write,
            session::session_resize,
            session::session_close,
            config::config_read,
            config::config_write,
            config::config_open_folder,
            fonts::system_list_fonts,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter};

use crate::session::{SessionCmd, SessionManager};

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: tauri::State<'_, SessionManager>,
    rows: u16,
    cols: u16,
    command: Option<String>,
) -> Result<u32, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let cmd = match command {
        Some(ref c) if !c.is_empty() => {
            let parts: Vec<&str> = c.split_whitespace().collect();
            let mut builder = CommandBuilder::new(parts[0]);
            for arg in &parts[1..] {
                builder.arg(arg);
            }
            builder
        }
        _ => CommandBuilder::new_default_prog(),
    };
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let (id, mut cmd_rx) = state.create_channel();

    let mut writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let master = pair.master;

    // Writer thread: receives commands from frontend
    let pty_id = id;
    std::thread::spawn(move || {
        let _master = master; // keep master alive for resize
        while let Some(cmd) = cmd_rx.blocking_recv() {
            match cmd {
                SessionCmd::Write(data) => {
                    if writer.write_all(&data).is_err() || writer.flush().is_err() {
                        break;
                    }
                }
                SessionCmd::Resize { rows, cols } => {
                    let _ = _master.resize(PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    });
                }
                SessionCmd::Close => break,
            }
        }
    });

    // Reader thread: reads PTY output and emits to frontend
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(&format!("session-output-{}", pty_id), &data);
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit(&format!("session-exit-{}", pty_id), ());
    });

    // Wait for child exit
    std::thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(id)
}

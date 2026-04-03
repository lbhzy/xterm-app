use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_serial::{self, SerialPortBuilderExt, SerialPortType};

use crate::session::{SessionCmd, SessionManager};

#[derive(serde::Serialize)]
pub struct SerialPortInfo {
    pub port_name: String,
    pub port_type: String,
}

#[tauri::command]
pub fn serial_list_ports() -> Result<Vec<SerialPortInfo>, String> {
    let ports = tokio_serial::available_ports().map_err(|e| e.to_string())?;
    Ok(ports
        .into_iter()
        .map(|p| SerialPortInfo {
            port_name: p.port_name,
            port_type: match p.port_type {
                SerialPortType::UsbPort(_) => "USB".to_string(),
                SerialPortType::BluetoothPort => "Bluetooth".to_string(),
                SerialPortType::PciPort => "PCI".to_string(),
                SerialPortType::Unknown => "Unknown".to_string(),
            },
        })
        .collect())
}

#[tauri::command]
pub async fn serial_connect(
    app: AppHandle,
    state: tauri::State<'_, SessionManager>,
    port_name: String,
    baud_rate: u32,
) -> Result<u32, String> {
    let port = tokio_serial::new(&port_name, baud_rate)
        .open_native_async()
        .map_err(|e| format!("Failed to open serial port {}: {}", port_name, e))?;

    let (session_id, mut cmd_rx) = state.create_channel();

    // Async I/O task
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let (mut reader, mut writer) = tokio::io::split(port);
        let mut buf = [0u8; 4096];

        loop {
            tokio::select! {
                maybe_cmd = cmd_rx.recv() => {
                    match maybe_cmd {
                        Some(SessionCmd::Write(data)) => {
                            if writer.write_all(&data).await.is_err() || writer.flush().await.is_err() {
                                break;
                            }
                        }
                        Some(SessionCmd::Resize { .. }) => {
                            // Serial ports don't support resize.
                        }
                        Some(SessionCmd::Close) | None => {
                            break;
                        }
                    }
                }
                read_result = reader.read(&mut buf) => {
                    match read_result {
                        Ok(0) => break,
                        Ok(n) => {
                            let data = String::from_utf8_lossy(&buf[..n]).to_string();
                            let _ = app_handle.emit(&format!("session-output-{}", session_id), &data);
                        }
                        Err(_) => break,
                    }
                }
            }
        }

        let _ = writer.shutdown().await;
        app_handle.state::<SessionManager>().remove(session_id);
        let _ = app_handle.emit(&format!("session-exit-{}", session_id), ());
    });

    Ok(session_id)
}

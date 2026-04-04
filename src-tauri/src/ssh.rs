use russh::client;
use russh::keys::{self, key::PrivateKeyWithHashAlg};
use russh::{ChannelMsg, Disconnect};
use std::io::Cursor;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{timeout, Duration};

use crate::session::{SessionCmd, SessionManager};

#[derive(Clone, Default)]
struct TauriSshClient;

impl client::Handler for TauriSshClient {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    state: tauri::State<'_, SessionManager>,
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    password: Option<String>,
    key_path: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<u32, String> {
    let ssh_timeout = Duration::from_secs(2);
    let config = Arc::new(client::Config::default());
    let addr = format!("{}:{}", host, port);
    let mut session = timeout(ssh_timeout, client::connect(config, addr, TauriSshClient::default()))
        .await
        .map_err(|_| "SSH connect timed out (2s)".to_string())?
        .map_err(|e| format!("SSH connect failed: {}", e))?;

    match auth_method.as_str() {
        "password" => {
            let pwd = password.ok_or("Password required")?;
            let auth = timeout(
                ssh_timeout,
                session.authenticate_password(username.clone(), pwd),
            )
                .await
                .map_err(|_| "SSH password auth timed out (2s)".to_string())?
                .map_err(|e| format!("SSH password auth failed: {}", e))?;

            if !auth.success() {
                return Err("SSH authentication failed".to_string());
            }
        }
        "key" => {
            let key = key_path.ok_or("Key path required")?;
            let key_pair = keys::load_secret_key(Path::new(&key), password.as_deref())
                .map_err(|e| format!("SSH key parse failed: {}", e))?;
            let best_hash = timeout(ssh_timeout, session.best_supported_rsa_hash())
                .await
                .map_err(|_| "SSH key hash negotiation timed out (2s)".to_string())?
                .map_err(|e| format!("SSH key hash negotiation failed: {}", e))?
                .flatten();

            let auth = timeout(
                ssh_timeout,
                session.authenticate_publickey(
                    username.clone(),
                    PrivateKeyWithHashAlg::new(Arc::new(key_pair), best_hash),
                ),
            )
                .await
                .map_err(|_| "SSH key auth timed out (2s)".to_string())?
                .map_err(|e| format!("SSH key auth failed: {}", e))?;

            if !auth.success() {
                return Err("SSH authentication failed".to_string());
            }
        }
        _ => return Err(format!("Unknown auth method: {}", auth_method)),
    }

    let channel = timeout(ssh_timeout, session.channel_open_session())
        .await
        .map_err(|_| "SSH channel open timed out (2s)".to_string())?
        .map_err(|e| format!("SSH channel error: {}", e))?;

    timeout(
        ssh_timeout,
        channel.request_pty(true, "xterm-256color", cols as u32, rows as u32, 0, 0, &[]),
    )
        .await
        .map_err(|_| "SSH pty request timed out (2s)".to_string())?
        .map_err(|e| format!("SSH pty request failed: {}", e))?;

    timeout(ssh_timeout, channel.request_shell(true))
        .await
        .map_err(|_| "SSH shell request timed out (2s)".to_string())?
        .map_err(|e| format!("SSH shell request failed: {}", e))?;

    let (session_id, mut cmd_rx) = state.create_channel();

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut channel = channel;
        loop {
            tokio::select! {
                maybe_cmd = cmd_rx.recv() => {
                    match maybe_cmd {
                        Some(SessionCmd::Write(data)) => {
                            if channel.data(Cursor::new(data)).await.is_err() {
                                break;
                            }
                        }
                        Some(SessionCmd::Resize { rows, cols }) => {
                            if channel
                                .window_change(cols as u32, rows as u32, 0, 0)
                                .await
                                .is_err()
                            {
                                break;
                            }
                        }
                        Some(SessionCmd::Close) | None => {
                            let _ = channel.eof().await;
                            let _ = channel.close().await;
                            break;
                        }
                    }
                }
                maybe_msg = channel.wait() => {
                    match maybe_msg {
                        Some(ChannelMsg::Data { data })
                        | Some(ChannelMsg::ExtendedData { data, .. }) => {
                            let payload = String::from_utf8_lossy(data.as_ref()).to_string();
                            let _ = app_handle.emit(&format!("session-output-{}", session_id), &payload);
                        }
                        Some(ChannelMsg::Eof | ChannelMsg::Close) | None => {
                            break;
                        }
                        Some(_) => {}
                    }
                }
            }
        }

        let _ = channel.close().await;
        let _ = session
            .disconnect(Disconnect::ByApplication, "", "en")
            .await;
        app_handle.state::<SessionManager>().remove(session_id);
        let _ = app_handle.emit(&format!("session-exit-{}", session_id), ());
    });

    Ok(session_id)
}

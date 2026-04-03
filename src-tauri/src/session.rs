use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::mpsc as tokio_mpsc;

pub enum SessionCmd {
    Write(Vec<u8>),
    Resize { rows: u16, cols: u16 },
    Close,
}

pub struct SessionManager {
    senders: Mutex<HashMap<u32, tokio_mpsc::UnboundedSender<SessionCmd>>>,
    next_id: Mutex<u32>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            senders: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1),
        }
    }

    pub fn next_id(&self) -> u32 {
        let mut id = self.next_id.lock().unwrap();
        let current = *id;
        *id += 1;
        current
    }

    pub fn register(&self, id: u32, sender: tokio_mpsc::UnboundedSender<SessionCmd>) {
        self.senders.lock().unwrap().insert(id, sender);
    }

    pub fn remove(&self, id: u32) {
        let mut senders = self.senders.lock().unwrap();
        if let Some(tx) = senders.remove(&id) {
            let _ = tx.send(SessionCmd::Close);
        }
    }

    pub fn send(&self, id: u32, cmd: SessionCmd) -> Result<(), String> {
        let senders = self.senders.lock().unwrap();
        if let Some(tx) = senders.get(&id) {
            tx.send(cmd).map_err(|e| format!("Session {} send error: {}", id, e))
        } else {
            Err(format!("Session {} not found", id))
        }
    }

    pub fn create_channel(&self) -> (u32, tokio_mpsc::UnboundedReceiver<SessionCmd>) {
        let id = self.next_id();
        let (tx, rx) = tokio_mpsc::unbounded_channel();
        self.register(id, tx);
        (id, rx)
    }
}

#[tauri::command]
pub fn session_write(
    state: tauri::State<'_, SessionManager>,
    id: u32,
    data: String,
) -> Result<(), String> {
    state.send(id, SessionCmd::Write(data.into_bytes()))
}

#[tauri::command]
pub fn session_resize(
    state: tauri::State<'_, SessionManager>,
    id: u32,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state.send(id, SessionCmd::Resize { rows, cols })
}

#[tauri::command]
pub fn session_close(state: tauri::State<'_, SessionManager>, id: u32) -> Result<(), String> {
    state.remove(id);
    Ok(())
}

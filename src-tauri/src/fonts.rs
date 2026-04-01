use font_kit::source::SystemSource;
use std::sync::OnceLock;

#[derive(Clone, serde::Serialize)]
pub struct SystemFonts {
    pub all: Vec<String>,
}

static FONT_CACHE: OnceLock<SystemFonts> = OnceLock::new();

fn compute_system_fonts() -> Result<SystemFonts, String> {
    let source = SystemSource::new();
    let mut families = source.all_families().map_err(|e| e.to_string())?;
    families.sort_by_key(|name| name.to_lowercase());
    families.dedup();

    Ok(SystemFonts { all: families })
}

fn get_or_compute_fonts() -> Result<SystemFonts, String> {
    if let Some(cached) = FONT_CACHE.get() {
        return Ok(cached.clone());
    }

    let result = compute_system_fonts()?;
    let _ = FONT_CACHE.set(result.clone());
    Ok(result)
}

#[tauri::command]
pub async fn system_list_fonts() -> Result<SystemFonts, String> {
    if let Some(cached) = FONT_CACHE.get() {
        return Ok(cached.clone());
    }

    tauri::async_runtime::spawn_blocking(get_or_compute_fonts)
        .await
        .map_err(|e| e.to_string())?
}

pub async fn warmup_system_fonts_cache() {
    let _ = system_list_fonts().await;
}

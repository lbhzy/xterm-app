use font_kit::source::SystemSource;
use std::sync::OnceLock;

#[derive(Clone, serde::Serialize)]
pub struct SystemFonts {
    pub all: Vec<String>,
    pub monospace: Vec<String>,
    pub chinese: Vec<String>,
}

static FONT_CACHE: OnceLock<SystemFonts> = OnceLock::new();

fn contains_any(name: &str, keywords: &[&str]) -> bool {
    let lower = name.to_lowercase();
    keywords.iter().any(|k| lower.contains(k))
}

fn monospace_name_hint(name: &str) -> bool {
    contains_any(
        name,
        &[
            "mono",
            "code",
            "console",
            "courier",
            "menlo",
            "monaco",
            "fixed",
            "terminal",
            "typewriter",
            "等宽",
        ],
    )
}

fn chinese_name_hint(name: &str) -> bool {
    contains_any(
        name,
        &[
            "pingfang",
            "hiragino",
            "song",
            "hei",
            "kai",
            "fang",
            "source han",
            "noto sans cjk",
            "noto serif cjk",
            "simsun",
            "simhei",
            "microsoft yahei",
            "wenquanyi",
            "sarasa",
            "lxgw",
            "思源",
            "宋",
            "黑",
            "楷",
            "仿",
            "中文",
            "华文",
        ],
    )
}

#[tauri::command]
pub fn system_list_fonts() -> Result<SystemFonts, String> {
    if let Some(cached) = FONT_CACHE.get() {
        return Ok(cached.clone());
    }

    let source = SystemSource::new();
    let mut families = source.all_families().map_err(|e| e.to_string())?;
    families.sort_by_key(|name| name.to_lowercase());
    families.dedup();

    let mut monospace = Vec::new();
    let mut chinese = Vec::new();

    for family_name in &families {
        let mut is_monospace = monospace_name_hint(family_name);
        let mut is_chinese = chinese_name_hint(family_name);

        if let Ok(family) = source.select_family_by_name(family_name) {
            if let Some(handle) = family.fonts().first() {
                if let Ok(font) = handle.load() {
                    is_monospace = is_monospace || font.is_monospace();
                    is_chinese = is_chinese || font.glyph_for_char('中').is_some();
                }
            }
        }

        if is_monospace {
            monospace.push(family_name.clone());
        }
        if is_chinese {
            chinese.push(family_name.clone());
        }
    }

    monospace.sort_by_key(|name| name.to_lowercase());
    monospace.dedup();
    chinese.sort_by_key(|name| name.to_lowercase());
    chinese.dedup();

    let result = SystemFonts {
        all: families,
        monospace,
        chinese,
    };

    let _ = FONT_CACHE.set(result.clone());
    Ok(result)
}

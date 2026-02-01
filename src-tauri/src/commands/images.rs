use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::ImageFormat;
use image::imageops::FilterType;
use serde::Deserialize;
use std::io::Cursor;
use std::path::PathBuf;

const THUMB_SIZE: u32 = 256;

#[derive(Debug, Deserialize)]
pub struct GetThumbnailPayload {
    pub path: String,
    #[serde(default)]
    pub size: Option<u32>,
}

/// Generates a thumbnail for the image at path. Returns a data URL (base64 JPEG).
#[tauri::command]
pub fn get_thumbnail(payload: GetThumbnailPayload) -> Result<String, String> {
    let path = PathBuf::from(&payload.path);
    if !path.exists() || !path.is_file() {
        return Err("File not found".to_string());
    }

    let size = payload.size.unwrap_or(THUMB_SIZE).min(512);

    let img = image::open(&path).map_err(|e| e.to_string())?;
    let thumb = img.resize(size, size, FilterType::Triangle);
    let mut buf = Vec::new();
    thumb
        .write_to(&mut Cursor::new(&mut buf), ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    let b64 = BASE64.encode(&buf);
    Ok(format!("data:image/jpeg;base64,{b64}"))
}

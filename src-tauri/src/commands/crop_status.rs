use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

const CROP_STATUS_FILE: &str = ".lora-studio/crop_status.json";

#[derive(Debug, Serialize, Deserialize)]
pub struct CropStatusData {
    pub statuses: HashMap<String, String>,
}

fn crop_status_path(root_path: &str) -> PathBuf {
    PathBuf::from(root_path).join(CROP_STATUS_FILE)
}

fn ensure_lora_studio_dir(root_path: &str) -> Result<(), String> {
    let dir = PathBuf::from(root_path).join(".lora-studio");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn load_crop_statuses(root_path: &str) -> Result<CropStatusData, String> {
    let path = crop_status_path(root_path);
    if !path.exists() {
        return Ok(CropStatusData {
            statuses: HashMap::new(),
        });
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn save_crop_statuses(root_path: &str, data: &CropStatusData) -> Result<(), String> {
    ensure_lora_studio_dir(root_path)?;
    let path = crop_status_path(root_path);
    let content = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct SetCropStatusPayload {
    pub root_path: String,
    pub relative_path: String,
    pub status: String,
}

#[tauri::command]
pub fn set_crop_status(payload: SetCropStatusPayload) -> Result<(), String> {
    let mut data = load_crop_statuses(&payload.root_path)?;
    if payload.status == "uncropped" {
        data.statuses.remove(&payload.relative_path);
    } else {
        data.statuses
            .insert(payload.relative_path, payload.status);
    }
    save_crop_statuses(&payload.root_path, &data)
}

#[derive(Debug, Deserialize)]
pub struct GetCropStatusesPayload {
    pub root_path: String,
}

#[tauri::command]
pub fn get_crop_statuses(
    payload: GetCropStatusesPayload,
) -> Result<HashMap<String, String>, String> {
    let data = load_crop_statuses(&payload.root_path)?;
    Ok(data.statuses)
}

#[tauri::command]
pub fn clear_all_crop_statuses(payload: GetCropStatusesPayload) -> Result<usize, String> {
    let data = load_crop_statuses(&payload.root_path)?;
    let count = data.statuses.len();
    let empty = CropStatusData {
        statuses: HashMap::new(),
    };
    save_crop_statuses(&payload.root_path, &empty)?;
    Ok(count)
}

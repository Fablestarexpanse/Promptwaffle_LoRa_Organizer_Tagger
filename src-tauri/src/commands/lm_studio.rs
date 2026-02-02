use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use futures::stream::{self, StreamExt};
use image::imageops::FilterType;
use image::ImageFormat;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::PathBuf;

const DEFAULT_BASE_URL: &str = "http://localhost:1234";

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct LmStudioSettings {
    #[serde(default = "default_base_url")]
    pub base_url: String,
    #[serde(default)]
    pub model: Option<String>,
}

fn default_base_url() -> String {
    DEFAULT_BASE_URL.to_string()
}

#[derive(Debug, Deserialize)]
pub struct TestConnectionPayload {
    #[serde(default = "default_base_url")]
    pub base_url: String,
}

#[derive(Debug, Serialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub models: Vec<String>,
    pub error: Option<String>,
}

/// Test connection to LM Studio and list available models.
#[tauri::command]
pub async fn test_lm_studio_connection(
    payload: TestConnectionPayload,
) -> Result<ConnectionStatus, String> {
    let url = format!("{}/v1/models", payload.base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = match client.get(&url).timeout(std::time::Duration::from_secs(5)).send().await {
        Ok(r) => r,
        Err(e) => {
            return Ok(ConnectionStatus {
                connected: false,
                models: Vec::new(),
                error: Some(format!("Connection failed: {}", e)),
            });
        }
    };

    if !response.status().is_success() {
        return Ok(ConnectionStatus {
            connected: false,
            models: Vec::new(),
            error: Some(format!("Server returned status: {}", response.status())),
        });
    }

    #[derive(Deserialize)]
    struct ModelsResponse {
        data: Vec<ModelInfo>,
    }

    #[derive(Deserialize)]
    struct ModelInfo {
        id: String,
    }

    let models_response: ModelsResponse = response.json().await.map_err(|e| e.to_string())?;
    let models: Vec<String> = models_response.data.into_iter().map(|m| m.id).collect();

    Ok(ConnectionStatus {
        connected: true,
        models,
        error: None,
    })
}

#[derive(Debug, Deserialize)]
pub struct GenerateCaptionPayload {
    pub image_path: String,
    #[serde(default = "default_base_url")]
    pub base_url: String,
    #[serde(default)]
    pub model: Option<String>,
    pub prompt: String,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    /// Request timeout in seconds (default 120, max 600).
    #[serde(default = "default_timeout_secs")]
    pub timeout_secs: u32,
    /// If set, resize image so longest side is at most this (reduces payload and inference time).
    #[serde(default)]
    pub max_image_dimension: Option<u32>,
}

fn default_max_tokens() -> u32 {
    300
}

const DEFAULT_TIMEOUT_SECS: u32 = 120;
const MAX_TIMEOUT_SECS: u32 = 600;

fn default_timeout_secs() -> u32 {
    DEFAULT_TIMEOUT_SECS
}

#[derive(Debug, Serialize)]
pub struct CaptionResult {
    pub success: bool,
    pub caption: String,
    pub error: Option<String>,
}

/// Generate a caption for a single image using LM Studio vision model.
#[tauri::command]
pub async fn generate_caption_lm_studio(
    payload: GenerateCaptionPayload,
) -> Result<CaptionResult, String> {
    let path = PathBuf::from(&payload.image_path);
    if !path.exists() || !path.is_file() {
        return Ok(CaptionResult {
            success: false,
            caption: String::new(),
            error: Some("Image file not found".to_string()),
        });
    }

    // Decode image so we can normalize to JPEG (LM Studio vision often only accepts JPEG).
    // Optionally resize to reduce payload and inference time.
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let (w, h) = (img.width(), img.height());

    let img = if let Some(max_dim) = payload.max_image_dimension.filter(|&d| d > 0) {
        let longest = w.max(h);
        if longest > max_dim {
            let scale = max_dim as f32 / longest as f32;
            let new_w = (w as f32 * scale).round() as u32;
            let new_h = (h as f32 * scale).round() as u32;
            let new_w = new_w.max(1);
            let new_h = new_h.max(1);
            img.resize(new_w, new_h, FilterType::Triangle)
        } else {
            img
        }
    } else {
        img
    };

    let mut buf = Vec::new();
    img.write_to(&mut Cursor::new(&mut buf), ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;
    let base64_image = BASE64.encode(&buf);
    let data_url = format!("data:image/jpeg;base64,{}", base64_image);

    // Build request body (OpenAI-compatible format)
    let request_body = serde_json::json!({
        "model": payload.model.unwrap_or_else(|| "default".to_string()),
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": payload.prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": data_url
                        }
                    }
                ]
            }
        ],
        "max_tokens": payload.max_tokens,
        "temperature": 0.7,
        "stream": false
    });

    let url = format!(
        "{}/v1/chat/completions",
        payload.base_url.trim_end_matches('/')
    );

    let timeout_secs = payload.timeout_secs.min(MAX_TIMEOUT_SECS).max(1);
    let client = reqwest::Client::new();
    let do_request = || {
        client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .timeout(std::time::Duration::from_secs(timeout_secs as u64))
            .send()
    };

    let response = match do_request().await {
        Ok(r) => r,
        Err(e) => {
            let err_str = e.to_string();
            let is_timeout = err_str.contains("timed out") || err_str.contains("timeout");
            if !is_timeout {
                return Ok(CaptionResult {
                    success: false,
                    caption: String::new(),
                    error: Some(format!("Request failed: {}", e)),
                });
            }
            // Retry once on timeout
            match do_request().await {
                Ok(r) => r,
                Err(_) => {
                    return Ok(CaptionResult {
                        success: false,
                        caption: String::new(),
                        error: Some(format!(
                            "Request timed out after {} seconds (tried 2 times). Try a larger timeout in settings or use smaller images.",
                            timeout_secs
                        )),
                    });
                }
            }
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Ok(CaptionResult {
            success: false,
            caption: String::new(),
            error: Some(format!("Server error {}: {}", status, body)),
        });
    }

    #[derive(Deserialize)]
    struct ChatResponse {
        choices: Vec<Choice>,
    }

    #[derive(Deserialize)]
    struct Choice {
        message: Message,
    }

    #[derive(Deserialize)]
    struct Message {
        content: String,
    }

    let chat_response: ChatResponse = match response.json().await {
        Ok(r) => r,
        Err(e) => {
            return Ok(CaptionResult {
                success: false,
                caption: String::new(),
                error: Some(format!("Failed to parse response: {}", e)),
            });
        }
    };

    let caption = chat_response
        .choices
        .first()
        .map(|c| c.message.content.trim().to_string())
        .unwrap_or_default();

    Ok(CaptionResult {
        success: true,
        caption,
        error: None,
    })
}

fn default_batch_concurrency() -> u32 {
    1
}

#[derive(Debug, Deserialize)]
pub struct BatchCaptionPayload {
    pub image_paths: Vec<String>,
    #[serde(default = "default_base_url")]
    pub base_url: String,
    #[serde(default)]
    pub model: Option<String>,
    pub prompt: String,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    /// Request timeout in seconds per image (default 120, max 600).
    #[serde(default = "default_timeout_secs")]
    pub timeout_secs: u32,
    /// If set, resize each image so longest side is at most this.
    #[serde(default)]
    pub max_image_dimension: Option<u32>,
    /// Max concurrent requests (1 = sequential, 2–3 recommended).
    #[serde(default = "default_batch_concurrency")]
    pub concurrency: u32,
}

#[derive(Debug, Serialize, Clone)]
pub struct BatchCaptionResult {
    pub path: String,
    pub success: bool,
    pub caption: String,
    pub error: Option<String>,
}

/// Generate captions for multiple images with bounded concurrency.
/// Results are returned in the same order as image_paths.
#[tauri::command]
pub async fn generate_captions_batch(
    payload: BatchCaptionPayload,
) -> Result<Vec<BatchCaptionResult>, String> {
    let concurrency = payload.concurrency.max(1).min(8) as usize;

    let base_url = payload.base_url.clone();
    let model = payload.model.clone();
    let prompt = payload.prompt.clone();
    let max_tokens = payload.max_tokens;
    let timeout_secs = payload.timeout_secs;
    let max_image_dimension = payload.max_image_dimension;

    let futures = payload
        .image_paths
        .into_iter()
        .enumerate()
        .map(|(index, path)| {
            let base_url = base_url.clone();
            let model = model.clone();
            let prompt = prompt.clone();
            let single_payload = GenerateCaptionPayload {
                image_path: path.clone(),
                base_url,
                model,
                prompt,
                max_tokens,
                timeout_secs,
                max_image_dimension,
            };
            async move {
                let result = generate_caption_lm_studio(single_payload).await;
                (index, path, result)
            }
        });

    let mut completed: Vec<(usize, String, Result<CaptionResult, String>)> = stream::iter(futures)
        .buffer_unordered(concurrency)
        .collect()
        .await;

    completed.sort_by_key(|(i, _, _)| *i);

    let results: Vec<BatchCaptionResult> = completed
        .into_iter()
        .map(|(_, path, result)| {
            match result {
                Ok(r) => BatchCaptionResult {
                    path,
                    success: r.success,
                    caption: r.caption,
                    error: r.error,
                },
                Err(e) => BatchCaptionResult {
                    path,
                    success: false,
                    caption: String::new(),
                    error: Some(e),
                },
            }
        })
        .collect();

    Ok(results)
}

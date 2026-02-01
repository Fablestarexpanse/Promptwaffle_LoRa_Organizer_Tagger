use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

#[derive(Debug, Clone, Deserialize)]
pub struct JoyCaptionSettings {
    /// Path to Python executable (e.g., "python" or "/path/to/venv/bin/python")
    #[serde(default = "default_python")]
    pub python_path: String,
    /// Path to JoyCaption script or module
    #[serde(default)]
    pub script_path: Option<String>,
    /// Caption mode: "descriptive", "training", "booru", etc.
    #[serde(default = "default_mode")]
    pub mode: String,
    /// Use low VRAM mode
    #[serde(default)]
    pub low_vram: bool,
}

fn default_python() -> String {
    "python".to_string()
}

fn default_mode() -> String {
    "descriptive".to_string()
}

#[derive(Debug, Deserialize)]
pub struct JoyCaptionPayload {
    pub image_path: String,
    #[serde(flatten)]
    pub settings: JoyCaptionSettings,
}

#[derive(Debug, Serialize)]
pub struct JoyCaptionResult {
    pub success: bool,
    pub caption: String,
    pub error: Option<String>,
}

/// Generate a caption using JoyCaption (Python subprocess).
/// Expects JoyCaption CLI to accept: python joycaption.py --image <path> --mode <mode>
#[tauri::command]
pub async fn generate_caption_joycaption(
    payload: JoyCaptionPayload,
) -> Result<JoyCaptionResult, String> {
    let mut cmd = Command::new(&payload.settings.python_path);

    // If script_path is provided, use it; otherwise assume joycaption is a module
    if let Some(ref script) = payload.settings.script_path {
        cmd.arg(script);
    } else {
        cmd.arg("-m").arg("joycaption");
    }

    cmd.arg("--image")
        .arg(&payload.image_path)
        .arg("--mode")
        .arg(&payload.settings.mode);

    if payload.settings.low_vram {
        cmd.arg("--low-vram");
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return Ok(JoyCaptionResult {
                success: false,
                caption: String::new(),
                error: Some(format!("Failed to start JoyCaption: {}", e)),
            });
        }
    };

    let mut stdout = child.stdout.take().expect("stdout not captured");
    let mut stderr = child.stderr.take().expect("stderr not captured");

    let mut output = String::new();
    let mut error_output = String::new();

    // Read stdout and stderr concurrently
    let (stdout_result, stderr_result, status) = tokio::join!(
        async {
            stdout.read_to_string(&mut output).await
        },
        async {
            stderr.read_to_string(&mut error_output).await
        },
        child.wait()
    );

    if let Err(e) = stdout_result {
        error_output.push_str(&format!("Read error: {}\n", e));
    }
    if let Err(e) = stderr_result {
        error_output.push_str(&format!("Stderr read error: {}\n", e));
    }

    let status = status.map_err(|e| e.to_string())?;

    if status.success() {
        Ok(JoyCaptionResult {
            success: true,
            caption: output.trim().to_string(),
            error: None,
        })
    } else {
        Ok(JoyCaptionResult {
            success: false,
            caption: String::new(),
            error: Some(if error_output.is_empty() {
                format!("JoyCaption exited with code: {:?}", status.code())
            } else {
                error_output.trim().to_string()
            }),
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct JoyCaptionBatchPayload {
    pub image_paths: Vec<String>,
    #[serde(flatten)]
    pub settings: JoyCaptionSettings,
}

#[derive(Debug, Serialize, Clone)]
pub struct JoyCaptionBatchResult {
    pub path: String,
    pub success: bool,
    pub caption: String,
    pub error: Option<String>,
}

/// Generate captions for multiple images using JoyCaption.
#[tauri::command]
pub async fn generate_captions_joycaption_batch(
    payload: JoyCaptionBatchPayload,
) -> Result<Vec<JoyCaptionBatchResult>, String> {
    let mut results = Vec::new();

    for image_path in payload.image_paths {
        let single_payload = JoyCaptionPayload {
            image_path: image_path.clone(),
            settings: payload.settings.clone(),
        };

        let result = generate_caption_joycaption(single_payload).await?;

        results.push(JoyCaptionBatchResult {
            path: image_path,
            success: result.success,
            caption: result.caption,
            error: result.error,
        });
    }

    Ok(results)
}

//! WD14 Tagger: invokes a user-provided Python script that outputs Danbooru-style tags.
//! Script is expected to accept --image <path> and print comma-separated tags to stdout.

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

#[derive(Debug, Clone, Deserialize)]
pub struct Wd14Settings {
    #[serde(default = "default_python")]
    pub python_path: String,
    pub script_path: Option<String>,
}

fn default_python() -> String {
    "python".to_string()
}

#[derive(Debug, Deserialize)]
pub struct Wd14Payload {
    pub image_path: String,
    #[serde(flatten)]
    pub settings: Wd14Settings,
}

#[derive(Debug, Serialize)]
pub struct Wd14Result {
    pub success: bool,
    pub caption: String,
    pub error: Option<String>,
}

/// Generate Danbooru-style tags using a WD14 tagger script.
/// Expects: python script_path --image <path>; stdout = comma-separated tags.
#[tauri::command]
pub async fn generate_caption_wd14(payload: Wd14Payload) -> Result<Wd14Result, String> {
    let script = match &payload.settings.script_path {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            return Ok(Wd14Result {
                success: false,
                caption: String::new(),
                error: Some("WD14 script path is not set. Set it in AI settings.".to_string()),
            });
        }
    };

    let mut cmd = Command::new(&payload.settings.python_path);
    cmd.arg(&script)
        .arg("--image")
        .arg(&payload.image_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return Ok(Wd14Result {
                success: false,
                caption: String::new(),
                error: Some(format!("Failed to start WD14 script: {}", e)),
            });
        }
    };

    let mut stdout = child.stdout.take().expect("stdout not captured");
    let mut stderr = child.stderr.take().expect("stderr not captured");
    let mut output = String::new();
    let mut error_output = String::new();

    let (stdout_result, stderr_result, status) = tokio::join!(
        async { stdout.read_to_string(&mut output).await },
        async { stderr.read_to_string(&mut error_output).await },
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
        Ok(Wd14Result {
            success: true,
            caption: output.trim().to_string(),
            error: None,
        })
    } else {
        Ok(Wd14Result {
            success: false,
            caption: String::new(),
            error: Some(if error_output.is_empty() {
                format!("WD14 script exited with code: {:?}", status.code())
            } else {
                error_output.trim().to_string()
            }),
        })
    }
}

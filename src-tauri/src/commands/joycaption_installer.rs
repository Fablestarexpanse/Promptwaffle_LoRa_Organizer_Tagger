//! JoyCaption auto-installer: venv, deps, model download, inference script.
//! Uses fpgaminer/joycaption + Hugging Face model (e.g. John6666/llama-joycaption-beta-one-hf-llava-nf4).

use serde::Serialize;
use std::env;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::task;

const JOYCAPTION_DIR_NAME: &str = "joycaption";
const MODEL_ID: &str = "John6666/llama-joycaption-beta-one-hf-llava-nf4";

fn app_data_joycaption_dir() -> Result<PathBuf, String> {
    let base = if cfg!(target_os = "windows") {
        env::var("APPDATA").map_err(|_| "APPDATA not set")?
    } else if cfg!(target_os = "macos") {
        let home = env::var("HOME").map_err(|_| "HOME not set")?;
        format!("{}/Library/Application Support", home)
    } else {
        let home = env::var("HOME").map_err(|_| "HOME not set")?;
        env::var("XDG_DATA_HOME")
            .unwrap_or_else(|_| format!("{}/.local/share", home))
    };
    Ok(PathBuf::from(base).join("LoRA Dataset Studio").join(JOYCAPTION_DIR_NAME))
}

fn find_python() -> Result<String, String> {
    // Try python3 first on Unix, then python
    let candidates = if cfg!(target_os = "windows") {
        vec!["python", "py", "python3"]
    } else {
        vec!["python3", "python"]
    };
    for name in candidates {
        let out = Command::new(name)
            .arg(if name == "py" { "-3" } else { "--version" })
            .output();
        if let Ok(o) = out {
            if o.status.success() || o.stdout.iter().any(|&b| b > 0) {
                return Ok(if name == "py" {
                    "py -3".to_string()
                } else {
                    name.to_string()
                });
            }
        }
    }
    Err("Python not found. Install Python 3.10+ and add it to PATH.".to_string())
}

fn emit_progress(app: &AppHandle, stage: &str, message: &str, percent: u8) {
    let _ = app.emit(
        "joycaption-install-progress",
        JoyCaptionInstallProgress {
            stage: stage.to_string(),
            message: message.to_string(),
            percent,
        },
    );
}

#[derive(Debug, Clone, Serialize)]
pub struct JoyCaptionInstallProgress {
    pub stage: String,
    pub message: String,
    pub percent: u8,
}

#[derive(Debug, Clone, Serialize)]
pub struct JoyCaptionInstallStatus {
    pub installed: bool,
    pub python_path: Option<String>,
    pub script_path: Option<String>,
    pub error: Option<String>,
}

/// Returns whether JoyCaption is installed and paths to use.
#[tauri::command]
pub fn joycaption_install_status() -> JoyCaptionInstallStatus {
    match do_install_status() {
        Ok((python_path, script_path)) => JoyCaptionInstallStatus {
            installed: true,
            python_path: Some(python_path),
            script_path: Some(script_path),
            error: None,
        },
        Err(e) => JoyCaptionInstallStatus {
            installed: false,
            python_path: None,
            script_path: None,
            error: Some(e),
        },
    }
}

fn do_install_status() -> Result<(String, String), String> {
    let root = app_data_joycaption_dir()?;
    let venv_python = if cfg!(target_os = "windows") {
        root.join("venv").join("Scripts").join("python.exe")
    } else {
        root.join("venv").join("bin").join("python")
    };
    let script = root.join("joycaption_inference.py");
    if !venv_python.exists() || !script.exists() {
        return Err("Not installed".to_string());
    }
    Ok((
        venv_python.to_string_lossy().to_string(),
        script.to_string_lossy().to_string(),
    ))
}

#[derive(Debug, Clone, Serialize)]
pub struct JoyCaptionInstallResult {
    pub success: bool,
    pub python_path: Option<String>,
    pub script_path: Option<String>,
    pub error: Option<String>,
}

/// Runs the JoyCaption installer: venv, pip install, model download, inference script.
/// Emits "joycaption-install-progress" with { stage, message, percent }.
#[tauri::command]
pub async fn joycaption_install(app: AppHandle) -> Result<JoyCaptionInstallResult, String> {
    let app = Arc::new(app);
    let result = task::spawn_blocking(move || run_install(app.clone())).await
        .map_err(|e| e.to_string())?;
    result
}

fn run_install(app: Arc<AppHandle>) -> Result<JoyCaptionInstallResult, String> {
    emit_progress(app.as_ref(), "checking", "Checking for Python...", 0);

    let python = find_python()?;
    let root = app_data_joycaption_dir()?;
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let venv_path = root.join("venv");
    if !venv_path.join(if cfg!(target_os = "windows") { "Scripts" } else { "bin" }).exists() {
        emit_progress(app.as_ref(), "venv", "Creating virtual environment...", 10);
        let status = if python.starts_with("py ") {
            Command::new("py").args(["-3", "-m", "venv", venv_path.to_str().unwrap()]).status()
        } else {
            Command::new(&python).args(["-m", "venv", venv_path.to_str().unwrap()]).status()
        };
        let status = status.map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("Failed to create venv".to_string());
        }
    }

    let venv_python = if cfg!(target_os = "windows") {
        venv_path.join("Scripts").join("python.exe")
    } else {
        venv_path.join("bin").join("python")
    };
    let venv_pip = if cfg!(target_os = "windows") {
        venv_path.join("Scripts").join("pip.exe")
    } else {
        venv_path.join("bin").join("pip")
    };

    emit_progress(app.as_ref(), "deps", "Installing PyTorch and transformers...", 25);
    let pip_install = |packages: &[&str]| -> Result<(), String> {
        let mut cmd = Command::new(&venv_pip);
        cmd.args(["install", "--quiet", "--disable-pip-version-check"]);
        cmd.args(packages);
        let status = cmd.status().map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("pip install failed".to_string());
        }
        Ok(())
    };

    // Install deps (torch can be large; user may need to wait)
    pip_install(&["torch", "transformers", "pillow", "accelerate", "huggingface_hub", "bitsandbytes"])
        .map_err(|e| format!("Dependencies: {}", e))?;

    emit_progress(app.as_ref(), "model", "Downloading JoyCaption model (first run may take a while)...", 60);
    // Run a small Python one-liner to download the model so it's cached
    let download_script = format!(
        "from huggingface_hub import snapshot_download; snapshot_download('{}')",
        MODEL_ID
    );
    let status = Command::new(&venv_python)
        .args(["-c", &download_script])
        .env("HF_HUB_DISABLE_TELEMETRY", "1")
        .status()
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("Model download failed. Check internet and disk space.".to_string());
    }

    emit_progress(app.as_ref(), "script", "Writing inference script...", 85);
    let script_content = include_str!("../../resources/joycaption_inference.py");
    let script_path = root.join("joycaption_inference.py");
    std::fs::write(&script_path, script_content).map_err(|e| e.to_string())?;

    emit_progress(app.as_ref(), "done", "JoyCaption is installed and ready.", 100);

    Ok(JoyCaptionInstallResult {
        success: true,
        python_path: Some(venv_python.to_string_lossy().to_string()),
        script_path: Some(script_path.to_string_lossy().to_string()),
        error: None,
    })
}

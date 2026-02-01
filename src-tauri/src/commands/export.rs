use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "bmp"];

fn is_image_path(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());
    ext.as_ref()
        .map(|e| IMAGE_EXTENSIONS.contains(&e.as_str()))
        .unwrap_or(false)
}

fn caption_path_for(image_path: &Path) -> PathBuf {
    image_path.with_extension("txt")
}

#[allow(dead_code)]
fn parse_tags(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

#[derive(Debug, Deserialize)]
pub struct ExportOptions {
    /// Source folder to export from
    pub source_path: String,
    /// Destination folder or ZIP path
    pub dest_path: String,
    /// Export as ZIP
    #[serde(default)]
    pub as_zip: bool,
    /// Only export captioned images
    #[serde(default)]
    pub only_captioned: bool,
    /// Trigger word to prepend to captions
    #[serde(default)]
    pub trigger_word: Option<String>,
    /// Use sequential naming (001.png, 002.png, etc.)
    #[serde(default)]
    pub sequential_naming: bool,
}

#[derive(Debug, Serialize)]
pub struct ExportResult {
    pub success: bool,
    pub exported_count: usize,
    pub skipped_count: usize,
    pub error: Option<String>,
    pub output_path: String,
}

/// Export dataset to folder or ZIP
#[tauri::command]
pub async fn export_dataset(options: ExportOptions) -> Result<ExportResult, String> {
    let source = PathBuf::from(&options.source_path);
    if !source.exists() || !source.is_dir() {
        return Err("Source folder does not exist".to_string());
    }

    // Collect images to export
    let mut images: Vec<PathBuf> = Vec::new();
    for entry in WalkDir::new(&source)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() || !is_image_path(path) {
            continue;
        }

        if options.only_captioned {
            let caption_path = caption_path_for(path);
            if !caption_path.exists() {
                continue;
            }
        }

        images.push(path.to_path_buf());
    }

    images.sort();

    if options.as_zip {
        export_as_zip(&images, &options)
    } else {
        export_to_folder(&images, &options)
    }
}

fn export_to_folder(images: &[PathBuf], options: &ExportOptions) -> Result<ExportResult, String> {
    let dest = PathBuf::from(&options.dest_path);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    let mut exported = 0;
    let mut skipped = 0;

    for (i, img_path) in images.iter().enumerate() {
        let ext = img_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png");

        let new_name = if options.sequential_naming {
            format!("{:04}.{}", i + 1, ext)
        } else {
            img_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("image.png")
                .to_string()
        };

        let dest_img = dest.join(&new_name);
        let dest_txt = dest.join(format!(
            "{}.txt",
            new_name.rsplit_once('.').map(|(n, _)| n).unwrap_or(&new_name)
        ));

        // Copy image
        if let Err(_e) = fs::copy(img_path, &dest_img) {
            skipped += 1;
            continue;
        }

        // Copy/modify caption
        let caption_path = caption_path_for(img_path);
        if caption_path.exists() {
            if let Ok(content) = fs::read_to_string(&caption_path) {
                let final_content = if let Some(ref trigger) = options.trigger_word {
                    if !trigger.is_empty() {
                        format!("{}, {}", trigger.trim(), content.trim())
                    } else {
                        content.trim().to_string()
                    }
                } else {
                    content.trim().to_string()
                };
                let _ = fs::write(&dest_txt, final_content);
            }
        }

        exported += 1;
    }

    Ok(ExportResult {
        success: true,
        exported_count: exported,
        skipped_count: skipped,
        error: None,
        output_path: options.dest_path.clone(),
    })
}

fn export_as_zip(images: &[PathBuf], options: &ExportOptions) -> Result<ExportResult, String> {
    use std::io::Write;

    let dest_path = PathBuf::from(&options.dest_path);

    // Create ZIP file
    let file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);

    let zip_options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut exported = 0;
    let mut skipped = 0;

    for (i, img_path) in images.iter().enumerate() {
        let ext = img_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png");

        let new_name = if options.sequential_naming {
            format!("{:04}.{}", i + 1, ext)
        } else {
            img_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("image.png")
                .to_string()
        };

        let txt_name = format!(
            "{}.txt",
            new_name.rsplit_once('.').map(|(n, _)| n).unwrap_or(&new_name)
        );

        // Add image to ZIP
        let img_data = match fs::read(img_path) {
            Ok(data) => data,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };

        zip.start_file(&new_name, zip_options)
            .map_err(|e| e.to_string())?;
        zip.write_all(&img_data).map_err(|e| e.to_string())?;

        // Add caption to ZIP
        let caption_path = caption_path_for(img_path);
        if caption_path.exists() {
            if let Ok(content) = fs::read_to_string(&caption_path) {
                let final_content = if let Some(ref trigger) = options.trigger_word {
                    if !trigger.is_empty() {
                        format!("{}, {}", trigger.trim(), content.trim())
                    } else {
                        content.trim().to_string()
                    }
                } else {
                    content.trim().to_string()
                };

                zip.start_file(&txt_name, zip_options)
                    .map_err(|e| e.to_string())?;
                zip.write_all(final_content.as_bytes())
                    .map_err(|e| e.to_string())?;
            }
        }

        exported += 1;
    }

    zip.finish().map_err(|e| e.to_string())?;

    Ok(ExportResult {
        success: true,
        exported_count: exported,
        skipped_count: skipped,
        error: None,
        output_path: options.dest_path.clone(),
    })
}

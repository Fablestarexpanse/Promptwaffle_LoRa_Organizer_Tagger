import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  ImageEntry,
  ImageRating,
  CaptionData,
  ConnectionStatus,
  CaptionResult,
  BatchCaptionResult,
  ExportOptions,
  ExportResult,
  ExportByRatingOptions,
  BatchRenameOptions,
  BatchRenameResult,
} from "@/types";

export async function openFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
  });
  if (selected === null || Array.isArray(selected)) return null;
  return selected;
}

export async function loadProject(rootPath: string): Promise<ImageEntry[]> {
  return invoke<ImageEntry[]>("open_project", {
    payload: { root_path: rootPath },
  });
}

export interface FindDuplicatesResult {
  groups: string[][];
}

/** Find duplicate images by file content hash (SHA-256). */
export async function findDuplicates(rootPath: string): Promise<FindDuplicatesResult> {
  return invoke<FindDuplicatesResult>("find_duplicates", {
    root_path: rootPath,
  });
}

export async function getThumbnailDataUrl(
  path: string,
  size?: number
): Promise<string> {
  return invoke<string>("get_thumbnail", {
    payload: { path, size },
  });
}

/** Load image as data URL for preview/crop (works without asset protocol). */
export async function getImageDataUrl(
  path: string,
  maxSide?: number
): Promise<string> {
  return invoke<string>("get_image_data_url", {
    payload: { path, max_side: maxSide ?? 0 },
  });
}

export interface CropImagePayload {
  image_path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  flip_x?: boolean;
  flip_y?: boolean;
  rotate_degrees?: number;
  /** If true, save to a new file (keeps original). Returns new path. */
  save_as_new?: boolean;
}

/** Crops image. Returns new path when save_as_new is true, else undefined. */
export async function cropImage(
  payload: CropImagePayload
): Promise<string | undefined> {
  return invoke<string | undefined>("crop_image", { payload });
}

/** Deletes an image file and its caption .txt from disk. */
export async function deleteImage(imagePath: string): Promise<void> {
  return invoke<void>("delete_image", { image_path: imagePath });
}

export type BatchResizeMode = "resize" | "center_crop" | "fit";

export interface BatchResizeResult {
  processed_count: number;
  skipped_count: number;
  output_paths: string[];
  error: string | null;
}

/** Batch resize/preprocess images to target size. Outputs to specified folder, copies captions. */
export async function batchResize(
  imagePaths: string[],
  targetSize: number,
  mode: BatchResizeMode,
  outputFolder: string
): Promise<BatchResizeResult> {
  return invoke<BatchResizeResult>("batch_resize", {
    image_paths: imagePaths,
    target_size: targetSize,
    mode,
    output_folder: outputFolder,
  });
}

export async function readCaption(path: string): Promise<CaptionData> {
  return invoke<CaptionData>("read_caption", {
    payload: { path },
  });
}

export async function writeCaption(
  path: string,
  tags: string[]
): Promise<void> {
  return invoke<void>("write_caption", {
    payload: { path, tags },
  });
}

export async function addTag(path: string, tag: string): Promise<string[]> {
  return invoke<string[]>("add_tag", {
    payload: { path, tag },
  });
}

export async function removeTag(path: string, tag: string): Promise<string[]> {
  return invoke<string[]>("remove_tag", {
    payload: { path, tag },
  });
}

export async function reorderTags(
  path: string,
  tags: string[]
): Promise<void> {
  return invoke<void>("reorder_tags", {
    payload: { path, tags },
  });
}

// ============ AI Functions ============

export async function testLmStudioConnection(
  baseUrl: string
): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>("test_lm_studio_connection", {
    payload: { base_url: baseUrl },
  });
}

export async function testOllamaConnection(
  baseUrl: string
): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>("test_ollama_connection", {
    payload: { base_url: baseUrl },
  });
}

export async function generateCaptionLmStudio(
  imagePath: string,
  baseUrl: string,
  model: string | null,
  prompt: string,
  maxTokens: number = 300
): Promise<CaptionResult> {
  return invoke<CaptionResult>("generate_caption_lm_studio", {
    payload: {
      image_path: imagePath,
      base_url: baseUrl,
      model,
      prompt,
      max_tokens: maxTokens,
    },
  });
}

export async function generateCaptionsBatch(
  imagePaths: string[],
  baseUrl: string,
  model: string | null,
  prompt: string,
  maxTokens: number = 300
): Promise<BatchCaptionResult[]> {
  return invoke<BatchCaptionResult[]>("generate_captions_batch", {
    payload: {
      image_paths: imagePaths,
      base_url: baseUrl,
      model,
      prompt,
      max_tokens: maxTokens,
    },
  });
}

export async function generateCaptionJoyCaption(
  imagePath: string,
  pythonPath: string,
  scriptPath: string | null,
  mode: string,
  lowVram: boolean
): Promise<CaptionResult> {
  return invoke<CaptionResult>("generate_caption_joycaption", {
    payload: {
      image_path: imagePath,
      python_path: pythonPath,
      script_path: scriptPath,
      mode,
      low_vram: lowVram,
    },
  });
}

export async function generateCaptionsJoyCaptionBatch(
  imagePaths: string[],
  pythonPath: string,
  scriptPath: string | null,
  mode: string,
  lowVram: boolean
): Promise<BatchCaptionResult[]> {
  return invoke<BatchCaptionResult[]>("generate_captions_joycaption_batch", {
    payload: {
      image_paths: imagePaths,
      python_path: pythonPath,
      script_path: scriptPath,
      mode,
      low_vram: lowVram,
    },
  });
}

export async function generateCaptionWd14(
  imagePath: string,
  pythonPath: string,
  scriptPath: string | null
): Promise<CaptionResult> {
  return invoke<CaptionResult>("generate_caption_wd14", {
    payload: {
      image_path: imagePath,
      python_path: pythonPath,
      script_path: scriptPath,
    },
  });
}

// ============ Export Functions ============

export async function exportDataset(
  options: ExportOptions
): Promise<ExportResult> {
  return invoke<ExportResult>("export_dataset", { ...options });
}

export async function selectSaveFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
  });
  if (selected === null || Array.isArray(selected)) return null;
  return selected;
}

export async function exportByRating(
  options: ExportByRatingOptions
): Promise<ExportResult> {
  return invoke<ExportResult>("export_by_rating", { options });
}

export async function selectSaveFile(
  defaultName: string
): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
  });
  return selected;
}

// ============ Rating Functions ============

/** Clear all ratings for a project. Returns count of cleared ratings. */
export async function clearAllRatings(rootPath: string): Promise<number> {
  return invoke<number>("clear_all_ratings", {
    root_path: rootPath,
  });
}

export async function setImageRating(
  rootPath: string,
  relativePath: string,
  rating: ImageRating
): Promise<void> {
  return invoke<void>("set_rating", {
    payload: {
      root_path: rootPath,
      relative_path: relativePath,
      rating,
    },
  });
}

export async function getImageRatings(
  rootPath: string
): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("get_ratings", {
    payload: { root_path: rootPath },
  });
}

// ============ Batch Rename ============

export async function batchRename(
  options: BatchRenameOptions
): Promise<BatchRenameResult> {
  return invoke<BatchRenameResult>("batch_rename", {
    payload: options,
  });
}

// ============ JoyCaption Installer ============

export interface JoyCaptionInstallStatus {
  installed: boolean;
  python_path: string | null;
  script_path: string | null;
  error: string | null;
}

export interface JoyCaptionInstallProgress {
  stage: string;
  message: string;
  percent: number;
}

export interface JoyCaptionInstallResult {
  success: boolean;
  python_path: string | null;
  script_path: string | null;
  error: string | null;
}

export async function joycaptionInstallStatus(): Promise<JoyCaptionInstallStatus> {
  return invoke<JoyCaptionInstallStatus>("joycaption_install_status");
}

export async function joycaptionInstall(): Promise<JoyCaptionInstallResult> {
  return invoke<JoyCaptionInstallResult>("joycaption_install");
}

export interface JoyCaptionUninstallResult {
  success: boolean;
  message: string;
}

export async function joycaptionUninstall(): Promise<JoyCaptionUninstallResult> {
  return invoke<JoyCaptionUninstallResult>("joycaption_uninstall");
}

export interface JoyCaptionDiagnoseResult {
  ok: boolean;
  python_exists: boolean;
  script_exists: boolean;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  error: string | null;
}

export interface ResourceStats {
  cpu: { name: string; usage_percent: number };
  memory: { usage_percent: number; used_gb: number; total_gb: number };
  gpu?: {
    name: string;
    temperature_c?: number;
    fan_percent?: number;
    clock_mhz?: number;
    usage_percent?: number;
    memory_used_gb?: number;
    memory_total_gb?: number;
    memory_usage_percent?: number;
    power_draw_w?: number;
    power_limit_w?: number;
  };
}

export async function getResourceStats(): Promise<ResourceStats> {
  return invoke<ResourceStats>("get_resource_stats");
}

export async function joycaptionDiagnose(
  pythonPath: string,
  scriptPath: string
): Promise<JoyCaptionDiagnoseResult> {
  return invoke<JoyCaptionDiagnoseResult>("joycaption_diagnose", {
    payload: { python_path: pythonPath, script_path: scriptPath },
  });
}

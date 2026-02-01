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

export async function getThumbnailDataUrl(
  path: string,
  size?: number
): Promise<string> {
  return invoke<string>("get_thumbnail", {
    payload: { path, size },
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

// ============ Export Functions ============

export async function exportDataset(
  options: ExportOptions
): Promise<ExportResult> {
  return invoke<ExportResult>("export_dataset", options);
}

export async function selectSaveFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
  });
  if (selected === null || Array.isArray(selected)) return null;
  return selected;
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

/** Image rating status. */
export type ImageRating = "none" | "good" | "bad" | "needs_edit";

/** Image entry as returned from open_project (list). */
export interface ImageEntry {
  id: string;
  path: string;
  relative_path: string;
  filename: string;
  has_caption: boolean;
  tags: string[];
  rating: ImageRating;
}

/** Caption data returned from read_caption. */
export interface CaptionData {
  exists: boolean;
  raw: string;
  tags: string[];
}

/** Project settings and root. */
export interface Project {
  id: string;
  name: string;
  rootPath: string;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  captionFormat: "comma" | "kohya";
  triggerWord: string;
}

/** Filter state for the image grid. */
export interface FilterState {
  query: string;
  showCaptioned: boolean | null; // null = all, true = captioned only, false = uncaptioned only
  tagFilter: string | null;
  ratingFilter: ImageRating | null; // null = all, or specific rating
}

// ============ AI Types ============

export type AiProvider = "lm_studio" | "joycaption";

/** LM Studio connection status. */
export interface ConnectionStatus {
  connected: boolean;
  models: string[];
  error: string | null;
}

/** Caption result from AI. */
export interface CaptionResult {
  success: boolean;
  caption: string;
  error: string | null;
}

/** Batch caption result. */
export interface BatchCaptionResult {
  path: string;
  success: boolean;
  caption: string;
  error: string | null;
}

/** LM Studio settings. */
export interface LmStudioSettings {
  base_url: string;
  model: string | null;
}

/** JoyCaption settings. */
export interface JoyCaptionSettings {
  python_path: string;
  script_path: string | null;
  mode: string;
  low_vram: boolean;
}

/** Prompt template. */
export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  provider: AiProvider;
}

/** Default prompt templates. */
/** Export options. */
export interface ExportOptions {
  source_path: string;
  dest_path: string;
  as_zip: boolean;
  only_captioned: boolean;
  trigger_word: string | null;
  sequential_naming: boolean;
}

/** Export result. */
export interface ExportResult {
  success: boolean;
  exported_count: number;
  skipped_count: number;
  error: string | null;
  output_path: string;
}

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "descriptive",
    name: "Descriptive (Natural Language)",
    prompt:
      "Describe this image in detail. Include the subject, setting, style, colors, and mood. Be thorough but concise.",
    provider: "lm_studio",
  },
  {
    id: "booru_tags",
    name: "Booru Tags",
    prompt:
      "Generate comma-separated booru-style tags for this image. Include: character features (hair color, eye color, clothing), art style, setting, and quality tags. Format: tag1, tag2, tag3",
    provider: "lm_studio",
  },
  {
    id: "lora_training",
    name: "LoRA Training Caption",
    prompt:
      "Create a training caption for this image. Start with the main subject, then describe pose, expression, clothing, background, and art style. Use comma-separated tags. Be specific about visual details.",
    provider: "lm_studio",
  },
  {
    id: "character_focus",
    name: "Character Focus",
    prompt:
      "Describe the character in this image. Include: gender, hair (color, style, length), eyes, face, body type, clothing, accessories, pose, and expression. Use comma-separated descriptors.",
    provider: "lm_studio",
  },
];

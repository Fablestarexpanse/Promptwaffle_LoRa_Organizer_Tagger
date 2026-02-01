import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AiProvider, PromptTemplate, LmStudioSettings, OllamaSettings, Wd14Settings, JoyCaptionSettings } from "@/types";
import { DEFAULT_PROMPT_TEMPLATES } from "@/types";

interface AiState {
  // Provider selection
  provider: AiProvider;
  setProvider: (provider: AiProvider) => void;

  // Custom prompt (editable by user)
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;

  // LM Studio settings
  lmStudio: LmStudioSettings;
  setLmStudioUrl: (url: string) => void;
  setLmStudioModel: (model: string | null) => void;

  // Ollama settings
  ollama: OllamaSettings;
  setOllamaBaseUrl: (url: string) => void;
  setOllamaModel: (model: string | null) => void;

  // WD14 Tagger settings
  wd14: Wd14Settings;
  setWd14PythonPath: (path: string) => void;
  setWd14ScriptPath: (path: string | null) => void;

  // JoyCaption settings
  joyCaption: JoyCaptionSettings;
  setJoyCaptionPythonPath: (path: string) => void;
  setJoyCaptionScriptPath: (path: string | null) => void;
  setJoyCaptionMode: (mode: string) => void;
  setJoyCaptionLowVram: (lowVram: boolean) => void;

  // Prompt templates
  promptTemplates: PromptTemplate[];
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  addPromptTemplate: (template: PromptTemplate) => void;
  removePromptTemplate: (id: string) => void;

  // Connection status
  isConnected: boolean;
  availableModels: string[];
  setConnectionStatus: (connected: boolean, models: string[]) => void;

  // Generation state
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  generationProgress: { current: number; total: number };
  setGenerationProgress: (current: number, total: number) => void;

  // Batch captioning: only caption images with these ratings (empty = no filter)
  batchCaptionRatingFilter: Set<string>;
  batchCaptionRatingAll: boolean;
  setBatchCaptionRatingFilter: (ratings: Set<string>) => void;
  setBatchCaptionRatingAll: (all: boolean) => void;
  toggleBatchCaptionRating: (rating: "good" | "bad" | "needs_edit") => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      // Provider
      provider: "lm_studio",
      setProvider: (provider) => set({ provider }),

      // Custom prompt
      customPrompt: "Write a detailed description for this image.",
      setCustomPrompt: (customPrompt) => set({ customPrompt }),

      // LM Studio
      lmStudio: {
        base_url: "http://localhost:1234",
        model: null,
      },
      setLmStudioUrl: (url) =>
        set((state) => ({
          lmStudio: { ...state.lmStudio, base_url: url },
        })),
      setLmStudioModel: (model) =>
        set((state) => ({
          lmStudio: { ...state.lmStudio, model },
        })),

      // Ollama
      ollama: {
        base_url: "http://localhost:11434/v1",
        model: null,
      },
      setOllamaBaseUrl: (url) =>
        set((state) => ({
          ollama: { ...state.ollama, base_url: url },
        })),
      setOllamaModel: (model) =>
        set((state) => ({
          ollama: { ...state.ollama, model },
        })),

      // WD14
      wd14: {
        python_path: "python",
        script_path: null,
      },
      setWd14PythonPath: (path) =>
        set((state) => ({
          wd14: { ...state.wd14, python_path: path },
        })),
      setWd14ScriptPath: (path) =>
        set((state) => ({
          wd14: { ...state.wd14, script_path: path },
        })),

      // JoyCaption
      joyCaption: {
        python_path: "python",
        script_path: null,
        mode: "descriptive",
        low_vram: false,
      },
      setJoyCaptionPythonPath: (path) =>
        set((state) => ({
          joyCaption: { ...state.joyCaption, python_path: path },
        })),
      setJoyCaptionScriptPath: (path) =>
        set((state) => ({
          joyCaption: { ...state.joyCaption, script_path: path },
        })),
      setJoyCaptionMode: (mode) =>
        set((state) => ({
          joyCaption: { ...state.joyCaption, mode },
        })),
      setJoyCaptionLowVram: (lowVram) =>
        set((state) => ({
          joyCaption: { ...state.joyCaption, low_vram: lowVram },
        })),

      // Prompt templates
      promptTemplates: DEFAULT_PROMPT_TEMPLATES,
      selectedTemplateId: "descriptive",
      setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
      addPromptTemplate: (template) =>
        set((state) => ({
          promptTemplates: [...state.promptTemplates, template],
        })),
      removePromptTemplate: (id) =>
        set((state) => ({
          promptTemplates: state.promptTemplates.filter((t) => t.id !== id),
        })),

      // Connection
      isConnected: false,
      availableModels: [],
      setConnectionStatus: (isConnected, availableModels) =>
        set({ isConnected, availableModels }),

      // Generation
      isGenerating: false,
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      generationProgress: { current: 0, total: 0 },
      setGenerationProgress: (current, total) =>
        set({ generationProgress: { current, total } }),

      // Batch captioning rating filter
      batchCaptionRatingFilter: new Set<string>(),
      batchCaptionRatingAll: false,
      setBatchCaptionRatingFilter: (ratings) =>
        set({ batchCaptionRatingFilter: ratings, batchCaptionRatingAll: false }),
      setBatchCaptionRatingAll: (all) =>
        set({
          batchCaptionRatingAll: all,
          batchCaptionRatingFilter: all ? new Set() : new Set(),
        }),
      toggleBatchCaptionRating: (rating) =>
        set((state) => {
          const next = new Set(state.batchCaptionRatingFilter);
          if (next.has(rating)) next.delete(rating);
          else next.add(rating);
          return { batchCaptionRatingFilter: next, batchCaptionRatingAll: false };
        }),
    }),
    {
      name: "lora-studio-ai-settings",
      partialize: (state) => ({
        provider: state.provider,
        customPrompt: state.customPrompt,
        lmStudio: state.lmStudio,
        ollama: state.ollama,
        wd14: state.wd14,
        joyCaption: state.joyCaption,
        promptTemplates: state.promptTemplates,
        selectedTemplateId: state.selectedTemplateId,
      }),
    }
  )
);

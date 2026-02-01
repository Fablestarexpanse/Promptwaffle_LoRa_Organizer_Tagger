import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  triggerWord: string;
  thumbnailSize: number;
  autoSelectFirst: boolean;
  setTriggerWord: (word: string) => void;
  setThumbnailSize: (size: number) => void;
  setAutoSelectFirst: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      triggerWord: "",
      thumbnailSize: 256,
      autoSelectFirst: true,
      setTriggerWord: (triggerWord) => set({ triggerWord }),
      setThumbnailSize: (thumbnailSize) => set({ thumbnailSize }),
      setAutoSelectFirst: (autoSelectFirst) => set({ autoSelectFirst }),
    }),
    {
      name: "lora-studio-settings",
    }
  )
);

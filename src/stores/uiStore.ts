import { create } from "zustand";

interface UiState {
  isPreviewOpen: boolean;
  openPreview: () => void;
  closePreview: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isPreviewOpen: false,
  openPreview: () => set({ isPreviewOpen: true }),
  closePreview: () => set({ isPreviewOpen: false }),
}));

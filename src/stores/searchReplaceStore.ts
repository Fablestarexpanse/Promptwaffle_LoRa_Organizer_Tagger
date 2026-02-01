import { create } from "zustand";

export interface SearchReplaceBatchItem {
  path: string;
  previousTags: string[];
  newTags: string[];
}

interface SearchReplaceState {
  /** Last batch of search-replace changes for undo */
  lastBatch: SearchReplaceBatchItem[] | null;
  pushBatch: (batch: SearchReplaceBatchItem[]) => void;
  clearLastBatch: () => void;

  /** Current search text for live highlighting in tags */
  searchHighlightText: string;
  setSearchHighlightText: (text: string) => void;
}

export const useSearchReplaceStore = create<SearchReplaceState>((set) => ({
  lastBatch: null,
  pushBatch: (batch) => set({ lastBatch: batch }),
  clearLastBatch: () => set({ lastBatch: null }),

  searchHighlightText: "",
  setSearchHighlightText: (text) => set({ searchHighlightText: text }),
}));

import { create } from "zustand";

interface ProjectState {
  rootPath: string | null;
  setRootPath: (path: string | null) => void;
  isLoadingProject: boolean;
  setIsLoadingProject: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  rootPath: null,
  setRootPath: (rootPath) => set({ rootPath }),
  isLoadingProject: false,
  setIsLoadingProject: (isLoadingProject) => set({ isLoadingProject }),
}));

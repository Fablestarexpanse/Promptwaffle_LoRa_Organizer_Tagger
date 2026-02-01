import { useEffect } from "react";
import { Toolbar } from "./components/layout/Toolbar";
import { AppLayout } from "./components/layout/AppLayout";
import { StatusBar } from "./components/layout/StatusBar";
import { ImagePreviewModal } from "./components/preview/ImagePreviewModal";
import { ProjectLoadOverlay } from "./components/project/ProjectLoadOverlay";
import { useUiStore } from "./stores/uiStore";

function App() {
  const isPreviewOpen = useUiStore((s) => s.isPreviewOpen);
  const closePreview = useUiStore((s) => s.closePreview);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // ? to open help
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        // Help is handled by Toolbar, but we could trigger it here
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-surface">
      <Toolbar />
      <main className="flex flex-1 min-h-0">
        <AppLayout />
      </main>
      <StatusBar />

      {/* Modals */}
      <ImagePreviewModal isOpen={isPreviewOpen} onClose={closePreview} />
      <ProjectLoadOverlay />
    </div>
  );
}

export default App;

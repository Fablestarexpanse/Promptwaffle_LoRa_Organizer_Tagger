import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Maximize2, AlertCircle } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useProjectImages } from "@/hooks/useProject";
import { useSelectionStore } from "@/stores/selectionStore";
import { batchResize, openFolder } from "@/lib/tauri";
import type { BatchResizeMode } from "@/lib/tauri";

interface BatchResizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BatchResizeModal({ isOpen, onClose }: BatchResizeModalProps) {
  const queryClient = useQueryClient();
  const rootPath = useProjectStore((s) => s.rootPath);
  const { data: images = [] } = useProjectImages();
  const selectedIds = useSelectionStore((s) => s.selectedIds);

  const [targetSize, setTargetSize] = useState(512);
  const [mode, setMode] = useState<BatchResizeMode>("resize");
  const [outputFolder, setOutputFolder] = useState("");
  const [result, setResult] = useState<{ processed: number; skipped: number } | null>(null);

  const targetImages =
    selectedIds.size > 0
      ? images.filter((img) => selectedIds.has(img.id))
      : images;
  const imagePaths = targetImages.map((img) => img.path);
  const count = imagePaths.length;

  const resizeMutation = useMutation({
    mutationFn: async () => {
      if (!outputFolder || imagePaths.length === 0)
        throw new Error("Select output folder and ensure images are selected");
      return batchResize(imagePaths, targetSize, mode, outputFolder);
    },
    onSuccess: (res) => {
      setResult({ processed: res.processed_count, skipped: res.skipped_count });
      if (rootPath) {
        queryClient.invalidateQueries({ queryKey: ["project", "images", rootPath] });
      }
    },
  });

  async function handleSelectOutput() {
    const path = await openFolder();
    if (path) setOutputFolder(path);
  }

  function handleResize() {
    setResult(null);
    resizeMutation.mutate();
  }

  function handleClose() {
    setResult(null);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-medium text-gray-100">
            <Maximize2 className="h-5 w-5" />
            Batch Resize / Preprocess
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-400">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected image(s) will be resized.`
              : `All ${images.length} image(s) will be resized.`}
            {" "}
            Output saved to a new folder with captions copied.
          </p>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Target size (px)</label>
            <select
              value={targetSize}
              onChange={(e) => setTargetSize(Number(e.target.value))}
              className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-gray-200"
            >
              <option value={512}>512 (SD 1.5)</option>
              <option value={768}>768</option>
              <option value={1024}>1024 (SDXL)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as BatchResizeMode)}
              className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-gray-200"
            >
              <option value="resize">Resize (force square)</option>
              <option value="center_crop">Center crop then resize</option>
              <option value="fit">Fit (scale down, keep aspect)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Output folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputFolder}
                readOnly
                placeholder="Select folder..."
                className="flex-1 truncate rounded border border-border bg-surface px-2 py-1.5 text-sm text-gray-200"
              />
              <button
                type="button"
                onClick={handleSelectOutput}
                className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600"
              >
                Browse
              </button>
            </div>
          </div>

          {result && (
            <div className="flex items-start gap-2 rounded bg-green-900/30 px-3 py-2 text-sm text-green-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Processed {result.processed} image(s).
                {result.skipped > 0 && ` Skipped ${result.skipped}.`}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleResize}
            disabled={count === 0 || !outputFolder || resizeMutation.isPending}
            className="flex items-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {resizeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            Resize
          </button>
        </div>
      </div>
    </div>
  );
}

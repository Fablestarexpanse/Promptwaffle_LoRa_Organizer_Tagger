import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Download, FolderOpen, Archive, Loader2, Check } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { useProjectImages } from "@/hooks/useProject";
import { useSelectionStore } from "@/stores/selectionStore";
import { exportDataset, exportByRating, selectSaveFolder, selectSaveFile } from "@/lib/tauri";
import type { ExportResult, ExportCaptionFormat } from "@/types";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const rootPath = useProjectStore((s) => s.rootPath);
  const { data: images = [] } = useProjectImages();
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const showToast = useUiStore((s) => s.showToast);

  const [destPath, setDestPath] = useState("");
  const [asZip, setAsZip] = useState(true);
  const [onlyCaptioned, setOnlyCaptioned] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);
  const [onlyGood, setOnlyGood] = useState(false);
  const [exportByRatingSubfolders, setExportByRatingSubfolders] = useState(false);
  const [triggerWord, setTriggerWord] = useState("");
  const [sequentialNaming, setSequentialNaming] = useState(false);
  const [captionFormat, setCaptionFormat] = useState<ExportCaptionFormat>("txt");
  const [kohyaFolder, setKohyaFolder] = useState(false);
  const [kohyaRepeatCount, setKohyaRepeatCount] = useState(10);
  const [kohyaConceptName, setKohyaConceptName] = useState("concept");
  const [onlyValidDimensions, setOnlyValidDimensions] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);

  const captionedCount = images.filter((img) => img.has_caption).length;
  const goodCount = images.filter((img) => img.rating === "good").length;
  const badCount = images.filter((img) => img.rating === "bad").length;
  const needsEditCount = images.filter((img) => img.rating === "needs_edit").length;

  const selectedImages = selectedIds.size > 0
    ? images.filter((img) => selectedIds.has(img.id))
    : images;

  const isValidDimensions = (img: { width?: number; height?: number }) => {
    const w = img.width ?? 0;
    const h = img.height ?? 0;
    return w >= 512 && h >= 512 && w % 2 === 0 && h % 2 === 0;
  };

  const imagesToExport = (() => {
    let list: typeof images;
    if (exportByRatingSubfolders) {
      list = images.filter(
        (img) => img.rating === "good" || img.rating === "bad" || img.rating === "needs_edit"
      );
    } else if (onlySelected && selectedIds.size > 0) {
      list = onlyCaptioned
        ? selectedImages.filter((img) => img.has_caption)
        : selectedImages;
    } else if (onlyGood) {
      list = onlyCaptioned
        ? images.filter((img) => img.rating === "good" && img.has_caption)
        : images.filter((img) => img.rating === "good");
    } else {
      list = onlyCaptioned ? images.filter((img) => img.has_caption) : images;
    }
    return onlyValidDimensions ? list.filter(isValidDimensions) : list;
  })();

  const webpCount = imagesToExport.filter((img) =>
    img.filename.toLowerCase().endsWith(".webp")
  ).length;

  let willExport: number;
  if (exportByRatingSubfolders) {
    willExport = goodCount + badCount + needsEditCount;
  } else if (onlySelected && selectedIds.size > 0) {
    willExport = onlyCaptioned
      ? selectedImages.filter((img) => img.has_caption).length
      : selectedImages.length;
  } else if (onlyGood) {
    willExport = onlyCaptioned
      ? images.filter((img) => img.rating === "good" && img.has_caption).length
      : goodCount;
  } else {
    willExport = onlyCaptioned ? captionedCount : images.length;
  }

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!rootPath || !destPath) throw new Error("Missing paths");
      if (exportByRatingSubfolders) {
        return exportByRating({
          source_path: rootPath,
          dest_path: destPath,
          trigger_word: triggerWord.trim() || null,
          sequential_naming: sequentialNaming,
        });
      }
      let relativePaths: string[] | null = imagesToExport.map((img) => img.relative_path);
      if (relativePaths.length === 0) relativePaths = null;
      return exportDataset({
        source_path: rootPath,
        dest_path: destPath,
        as_zip: captionFormat === "metadata" || kohyaFolder ? false : asZip,
        only_captioned: onlyCaptioned,
        relative_paths: relativePaths && relativePaths.length > 0 ? relativePaths : null,
        trigger_word: triggerWord.trim() || null,
        sequential_naming: sequentialNaming,
        caption_format: captionFormat,
        kohya_folder:
          kohyaFolder && kohyaConceptName.trim()
            ? {
                repeat_count: Math.max(1, Math.min(999, kohyaRepeatCount)),
                concept_name: kohyaConceptName.trim(),
              }
            : null,
      });
    },
    onSuccess: (res) => {
      setResult(res);
    },
    onError: (err: Error) => {
      const msg = err.message ?? String(err);
      setResult({
        success: false,
        exported_count: 0,
        skipped_count: 0,
        error: msg,
        output_path: "",
      });
      showToast(msg);
    },
  });

  async function handleSelectDest() {
    if (exportByRatingSubfolders || captionFormat === "metadata" || kohyaFolder) {
      const path = await selectSaveFolder();
      if (path) setDestPath(path);
      return;
    }
    if (asZip) {
      const path = await selectSaveFile("dataset.zip");
      if (path) setDestPath(path);
    } else {
      const path = await selectSaveFolder();
      if (path) setDestPath(path);
    }
  }

  function handleExport() {
    setResult(null);
    exportMutation.mutate();
  }

  function handleClose() {
    setResult(null);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-elevated shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-medium text-gray-100">
            <Download className="h-5 w-5" />
            Export Dataset
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-4">
          {/* Stats */}
          <div className="rounded bg-surface p-3 text-sm">
            <p className="text-gray-400">
              {images.length} total • {captionedCount} captioned
              {goodCount + badCount + needsEditCount > 0 && (
                <> • Good: {goodCount} • Bad: {badCount} • Edit: {needsEditCount}</>
              )}
            </p>
            <p className="mt-1 font-medium text-gray-200">
              {exportByRatingSubfolders
                ? `Will export ${willExport} into good/, bad/, needs_edit/`
                : `Will export: ${willExport} image${willExport === 1 ? "" : "s"}`}
            </p>
            {exportByRatingSubfolders && willExport === 0 && (
              <p className="mt-1 text-xs text-amber-400">
                Rate images (Good / Bad / Edit) on thumbnails first.
              </p>
            )}
            {webpCount > 0 && (
              <p className="mt-1 text-xs text-amber-400">
                Warning: {webpCount} WebP image{webpCount === 1 ? "" : "s"}. Some trainers
                (e.g. older Kohya) may not support WebP. Consider batch resize to PNG/JPEG.
              </p>
            )}
          </div>

          {/* Export by rating subfolders */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportByRatingSubfolders}
              onChange={(e) => {
                setExportByRatingSubfolders(e.target.checked);
                if (e.target.checked) setDestPath("");
              }}
              className="rounded border-gray-600"
            />
            <span className="text-sm text-gray-300">
              Export to subfolders by rating (good / bad / needs_edit)
            </span>
          </label>

          {!exportByRatingSubfolders && (
            <>
              {selectedIds.size > 0 && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlySelected}
                    onChange={(e) => setOnlySelected(e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  <span className="text-sm text-gray-300">
                    Only export selected images ({selectedIds.size})
                  </span>
                </label>
              )}
              {/* Caption format */}
              <div>
                <label className="mb-1 block text-xs text-gray-500">Caption format</label>
                <select
                  value={captionFormat}
                  onChange={(e) => {
                    setCaptionFormat(e.target.value as ExportCaptionFormat);
                    if (e.target.value === "metadata") setAsZip(false);
                    setDestPath("");
                  }}
                  className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-gray-200"
                >
                  <option value="txt">Comma-separated .txt per image</option>
                  <option value="metadata">Kohya metadata.json</option>
                </select>
                {captionFormat === "metadata" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Exports folder + metadata.json (ZIP not supported)
                  </p>
                )}
              </div>
              {/* Format toggle (ZIP vs Folder) - hidden when metadata format */}
              {captionFormat === "txt" && !kohyaFolder && (
                <div>
                  <label className="mb-2 block text-sm text-gray-400">Output</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setAsZip(true); setDestPath(""); }}
                      className={`flex flex-1 items-center justify-center gap-2 rounded py-2 text-sm ${
                        asZip
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      <Archive className="h-4 w-4" />
                      ZIP Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAsZip(false); setDestPath(""); }}
                      className={`flex flex-1 items-center justify-center gap-2 rounded py-2 text-sm ${
                        !asZip
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Folder
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Destination */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">
              {exportByRatingSubfolders
                ? "Parent folder (creates good/, bad/, needs_edit/ inside)"
                : captionFormat === "metadata" || kohyaFolder || !asZip
                  ? "Export to folder"
                  : "Save ZIP as"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={destPath}
                readOnly
                placeholder="Select destination..."
                className="flex-1 truncate rounded border border-border bg-surface px-2 py-1.5 text-sm text-gray-200"
              />
              <button
                type="button"
                onClick={handleSelectDest}
                className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {!exportByRatingSubfolders && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyGood}
                  onChange={(e) => setOnlyGood(e.target.checked)}
                  className="rounded border-gray-600"
                />
                <span className="text-sm text-gray-300">Only export images rated Good (training set)</span>
              </label>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={onlyCaptioned}
                onChange={(e) => setOnlyCaptioned(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-sm text-gray-300">Only export captioned images</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sequentialNaming}
                onChange={(e) => setSequentialNaming(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-sm text-gray-300">Sequential naming (0001.png, 0002.png...)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={onlyValidDimensions}
                onChange={(e) => setOnlyValidDimensions(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-sm text-gray-300">
                Only valid dimensions (≥512, even w/h)
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={kohyaFolder}
                onChange={(e) => {
                  setKohyaFolder(e.target.checked);
                  if (e.target.checked) setAsZip(false);
                  setDestPath("");
                }}
                className="rounded border-gray-600"
              />
              <span className="text-sm text-gray-300">Kohya folder structure (N_conceptname)</span>
            </label>
            {kohyaFolder && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-0.5 block text-xs text-gray-500">Repeat count</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={kohyaRepeatCount}
                    onChange={(e) => setKohyaRepeatCount(parseInt(e.target.value, 10) || 10)}
                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="mb-0.5 block text-xs text-gray-500">Concept name</label>
                  <input
                    type="text"
                    value={kohyaConceptName}
                    onChange={(e) => setKohyaConceptName(e.target.value)}
                    placeholder="mycharacter"
                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200 placeholder-gray-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Trigger word */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">
              Trigger word (prepended to captions)
            </label>
            <input
              type="text"
              value={triggerWord}
              onChange={(e) => setTriggerWord(e.target.value)}
              placeholder="e.g., my_character"
              className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500"
            />
          </div>

          {/* Result */}
          {result && (
            <div
              className={`rounded p-3 text-sm ${
                result.success ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"
              }`}
            >
              {result.success ? (
                <>
                  <p className="flex items-center gap-1 font-medium">
                    <Check className="h-4 w-4" />
                    Exported {result.exported_count} images
                  </p>
                  {result.skipped_count > 0 && (
                    <p className="mt-1 text-xs">Skipped: {result.skipped_count}</p>
                  )}
                </>
              ) : (
                <p>Error: {result.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-4 py-2 text-sm text-gray-400 hover:bg-white/10 hover:text-gray-200"
          >
            {result?.success ? "Done" : "Cancel"}
          </button>
          {!result?.success && (
            <button
              type="button"
              onClick={handleExport}
              disabled={!destPath || exportMutation.isPending || (exportByRatingSubfolders && willExport === 0)}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

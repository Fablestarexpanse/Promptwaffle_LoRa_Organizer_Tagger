import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, Replace, RotateCcw, Loader2, HelpCircle } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useProjectImages } from "@/hooks/useProject";
import { useSelectionStore } from "@/stores/selectionStore";
import { useSearchReplaceStore } from "@/stores/searchReplaceStore";
import { writeCaption } from "@/lib/tauri";
import { useMemo } from "react";

export function Sidebar() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const { data: images = [] } = useProjectImages();
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const { lastBatch, pushBatch, clearLastBatch, setSearchHighlightText } = useSearchReplaceStore();

  const invalidateProject = useCallback(() => {
    if (rootPath) {
      queryClient.invalidateQueries({ queryKey: ["project", "images", rootPath] });
    }
  }, [queryClient, rootPath]);

  const searchReplaceMutation = useMutation({
    mutationFn: async () => {
      if (!searchText.trim()) return;

      const search = searchText.trim();
      const replaceStr = replaceText;

      const candidateImages = images.filter((img) => img.has_caption && img.tags.length > 0);
      const targetImages =
        selectedIds.size > 0
          ? candidateImages.filter((img) => selectedIds.has(img.id))
          : candidateImages;

      const batch: { path: string; previousTags: string[]; newTags: string[] }[] = [];

      for (const img of targetImages) {
        const prevTags = img.tags;
        const newTags = prevTags.map((tag) => {
          if (useRegex) {
            try {
              const re = new RegExp(search, "g");
              return tag.replace(re, replaceStr);
            } catch {
              return tag;
            }
          } else {
            // Plain text: escape regex special chars, case-insensitive replace
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp(escaped, "gi");
            return tag.replace(re, replaceStr);
          }
        });

        const changed = newTags.some((t, i) => t !== prevTags[i]);
        if (changed) {
          await writeCaption(img.path, newTags);
          batch.push({ path: img.path, previousTags: prevTags, newTags });
        }
      }

      if (batch.length > 0) pushBatch(batch);
      return { replaced: batch.length, total: targetImages.length };
    },
    onSuccess: (result, _v, _ctx) => {
      invalidateProject();
      if (typeof result === "object" && result !== null) {
        if (result.total === 0) {
          setLastResult("No images with tags to search");
        } else if (result.replaced > 0) {
          setLastResult(`Replaced in ${result.replaced} image${result.replaced === 1 ? "" : "s"}`);
        } else {
          setLastResult(`No matches found in ${result.total} image${result.total === 1 ? "" : "s"}`);
        }
      }
    },
  });

  const undoMutation = useMutation({
    mutationFn: async () => {
      if (!lastBatch) return;
      for (const item of lastBatch) {
        await writeCaption(item.path, item.previousTags);
      }
      clearLastBatch();
    },
    onSuccess: invalidateProject,
  });

  const handleClear = useCallback(() => {
    setSearchText("");
    setReplaceText("");
    setSearchHighlightText("");
    setLastResult(null);
  }, [setSearchHighlightText]);

  // Compute tag statistics
  const stats = useMemo(() => {
    let captionedCount = 0;
    for (const img of images) {
      if (img.has_caption) captionedCount++;
    }
    return {
      total: images.length,
      captioned: captionedCount,
      uncaptioned: images.length - captionedCount,
    };
  }, [images]);

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-surface-elevated">
      {/* Project info */}
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2 text-sm text-gray-200">
          <Folder className="h-4 w-4" />
          <span className="truncate">{rootPath ? rootPath.split(/[\\/]/).pop() : "No project"}</span>
        </div>
        {rootPath && (
          <p className="mt-1 truncate text-xs text-gray-500" title={rootPath}>
            {rootPath}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="border-b border-border p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Statistics
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Total images</span>
            <span className="text-gray-200">{stats.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-400">Captioned</span>
            <span className="text-gray-200">{stats.captioned}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-400">Uncaptioned</span>
            <span className="text-gray-200">{stats.uncaptioned}</span>
          </div>
        </div>
      </div>

      {/* Search & Replace */}
      <div className="border-b border-border p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Search & Replace
        </p>
        <div className="space-y-2">
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Search</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                const v = e.target.value;
                setSearchText(v);
                setSearchHighlightText(v);
              }}
              placeholder="Find in tags…"
              className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Replace</label>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with…"
              className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => searchReplaceMutation.mutate()}
              disabled={!searchText.trim() || searchReplaceMutation.isPending}
              className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {searchReplaceMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Replace className="h-3 w-3" />
              )}
              Go!
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => undoMutation.mutate()}
              disabled={!lastBatch || undoMutation.isPending}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Undo
            </button>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="rounded border-gray-600"
              />
              Regex
            </label>
          </div>
          {lastResult && (
            <p className="text-xs text-gray-400">{lastResult}</p>
          )}
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="border-t border-border p-3">
        <p className="mb-1 flex items-center gap-1 text-xs text-gray-500">
          <HelpCircle className="h-3 w-3" />
          Keyboard
        </p>
        <div className="space-y-0.5 text-xs text-gray-600">
          <p><kbd className="rounded bg-gray-700 px-1">←→↑↓</kbd> Navigate</p>
          <p><kbd className="rounded bg-gray-700 px-1">T</kbd> Focus tag input</p>
          <p><kbd className="rounded bg-gray-700 px-1">Enter</kbd> Add tag</p>
        </div>
      </div>
    </aside>
  );
}

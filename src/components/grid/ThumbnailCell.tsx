import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Smile, Frown, Wrench, Sparkles, Loader2, Check } from "lucide-react";
import {
  getThumbnailDataUrl,
  writeCaption,
  setImageRating,
  generateCaptionLmStudio,
  generateCaptionJoyCaption,
} from "@/lib/tauri";
import { useSelectionStore } from "@/stores/selectionStore";
import { useSearchReplaceStore } from "@/stores/searchReplaceStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { useAiStore } from "@/stores/aiStore";
import type { ImageEntry, ImageRating } from "@/types";

function parseTagsFromText(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function tagsToText(tags: string[]): string {
  return tags.join(", ");
}

/** Splits text by search (case-insensitive) and returns React nodes with matches highlighted */
function highlightMatches(text: string, search: string): React.ReactNode {
  if (!search.trim()) return text;
  try {
    const searchLower = search.trim().toLowerCase();
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(re);
    return parts.map((part, i) =>
      part.toLowerCase() === searchLower ? (
        <mark key={i} className="bg-yellow-500/70 text-yellow-900 dark:text-yellow-100 rounded px-0.5">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  } catch {
    return text;
  }
}

interface ThumbnailCellProps {
  entry: ImageEntry;
  size: number;
  index: number;
}

export function ThumbnailCell({ entry, size, index }: ThumbnailCellProps) {
  const selectedImage = useSelectionStore((s) => s.selectedImage);
  const setSelectedImage = useSelectionStore((s) => s.setSelectedImage);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const toggleSelection = useSelectionStore((s) => s.toggleSelection);
  const openPreview = useUiStore((s) => s.openPreview);
  const rootPath = useProjectStore((s) => s.rootPath);
  const queryClient = useQueryClient();

  // AI store for generate button
  const provider = useAiStore((s) => s.provider);
  const customPrompt = useAiStore((s) => s.customPrompt);
  const lmStudio = useAiStore((s) => s.lmStudio);
  const joyCaption = useAiStore((s) => s.joyCaption);
  const isConnected = useAiStore((s) => s.isConnected);

  const [captionText, setCaptionText] = useState(() => tagsToText(entry.tags));
  const [isEditing, setIsEditing] = useState(false);
  const captionInputRef = useRef<HTMLTextAreaElement>(null);
  const searchHighlightText = useSearchReplaceStore((s) => s.searchHighlightText);

  const isSelected = selectedImage?.id === entry.id;
  const isMultiSelected = selectedIds.has(entry.id);

  const invalidateProject = useCallback(() => {
    if (rootPath) {
      queryClient.invalidateQueries({ queryKey: ["project", "images", rootPath] });
    }
  }, [queryClient, rootPath]);

  const writeMutation = useMutation({
    mutationFn: async (tags: string[]) => writeCaption(entry.path, tags),
    onSuccess: invalidateProject,
  });

  const ratingMutation = useMutation({
    mutationFn: async (rating: ImageRating) => {
      if (!rootPath) throw new Error("No project open");
      return setImageRating(rootPath, entry.relative_path, rating);
    },
    onSuccess: invalidateProject,
  });

  // Generate caption for this single image
  const generateMutation = useMutation({
    mutationFn: async () => {
      const prompt = customPrompt.trim() || "Describe this image in detail.";
      if (provider === "lm_studio") {
        return generateCaptionLmStudio(
          entry.path,
          lmStudio.base_url,
          lmStudio.model,
          prompt
        );
      } else {
        return generateCaptionJoyCaption(
          entry.path,
          joyCaption.python_path,
          joyCaption.script_path,
          joyCaption.mode,
          joyCaption.low_vram
        );
      }
    },
    onSuccess: (result) => {
      if (result?.success && result.caption) {
        const tags = result.caption
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t);
        writeMutation.mutate(tags);
      }
    },
  });

  const displayText = tagsToText(entry.tags);

  function handleCaptionFocus() {
    setIsEditing(true);
    setCaptionText(displayText);
  }

  useEffect(() => {
    if (isEditing && captionInputRef.current) {
      captionInputRef.current.focus();
    }
  }, [isEditing]);

  function handleCaptionBlur() {
    setIsEditing(false);
    const tags = parseTagsFromText(captionText);
    const prevTags = entry.tags;
    const tagsChanged =
      tags.length !== prevTags.length || tags.some((t, i) => t !== prevTags[i]);
    if (tagsChanged) {
      writeMutation.mutate(tags);
    } else {
      setCaptionText(displayText);
    }
  }

  function handleCaptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setCaptionText(e.target.value);
  }

  function handleCaptionKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLTextAreaElement).blur();
    }
  }

  function handleRatingClick(rating: ImageRating, e: React.MouseEvent) {
    e.stopPropagation();
    // Toggle: if already this rating, set to none
    const newRating = entry.rating === rating ? "none" : rating;
    ratingMutation.mutate(newRating);
  }

  const { data: src, isLoading, isError } = useQuery({
    queryKey: ["thumbnail", entry.path, size],
    queryFn: () => getThumbnailDataUrl(entry.path, size),
    staleTime: 5 * 60 * 1000,
  });

  function handleImageClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click for multi-select
      toggleSelection(entry.id);
    } else {
      setSelectedImage(entry);
    }
  }

  function handleGenerateClick(e: React.MouseEvent) {
    e.stopPropagation();
    generateMutation.mutate();
  }

  function handleDoubleClick() {
    setSelectedImage(entry);
    openPreview();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (
      (e.target as HTMLElement).closest("textarea") ||
      (e.target as HTMLElement).closest("input")
    ) {
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setSelectedImage(entry);
      openPreview();
    } else if (e.key === " ") {
      e.preventDefault();
      setSelectedImage(entry);
    }
  }

  return (
    <div
      role="listitem"
      tabIndex={0}
      data-index={index}
      onClick={handleImageClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex cursor-pointer flex-col rounded border-2 transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-500/10"
          : isMultiSelected
            ? "border-purple-500 bg-purple-500/10"
            : "border-border bg-surface-elevated hover:border-gray-500"
      }`}
    >
      {/* Multi-select indicator */}
      {isMultiSelected && (
        <div className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-purple-600 text-white">
          <Check className="h-3 w-3" />
        </div>
      )}

      {/* Caption indicator */}
      <div className="absolute right-1 top-1 z-10 flex gap-1">
        {entry.has_caption ? (
          <span
            className="h-2 w-2 rounded-full bg-green-500"
            title={`${entry.tags.length} tags`}
          />
        ) : (
          <span
            className="h-2 w-2 rounded-full bg-gray-500"
            title="No caption"
          />
        )}
      </div>

      {/* Thumbnail */}
      <div
        className="flex aspect-square w-full shrink-0 items-center justify-center bg-gray-800/50"
      >
        {isLoading && <span className="text-xs text-gray-500">…</span>}
        {isError && <span className="text-xs text-red-400">Err</span>}
        {src && (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        )}
      </div>

      {/* Rating icons and generate button row */}
      <div className="flex items-center justify-center gap-1 px-1 py-1">
        <button
          type="button"
          onClick={(e) => handleRatingClick("good", e)}
          className={`rounded p-1 transition-colors ${
            entry.rating === "good"
              ? "bg-green-600 text-white"
              : "text-gray-500 hover:bg-green-600/20 hover:text-green-400"
          }`}
          title="Good"
        >
          <Smile className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => handleRatingClick("bad", e)}
          className={`rounded p-1 transition-colors ${
            entry.rating === "bad"
              ? "bg-red-600 text-white"
              : "text-gray-500 hover:bg-red-600/20 hover:text-red-400"
          }`}
          title="Bad"
        >
          <Frown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => handleRatingClick("needs_edit", e)}
          className={`rounded p-1 transition-colors ${
            entry.rating === "needs_edit"
              ? "bg-yellow-600 text-white"
              : "text-gray-500 hover:bg-yellow-600/20 hover:text-yellow-400"
          }`}
          title="Needs Edit"
        >
          <Wrench className="h-4 w-4" />
        </button>

        {/* Divider */}
        <span className="mx-1 h-4 w-px bg-gray-600" />

        {/* Generate caption button */}
        <button
          type="button"
          onClick={handleGenerateClick}
          disabled={
            generateMutation.isPending ||
            (provider === "lm_studio" && !isConnected)
          }
          className={`rounded p-1 transition-colors ${
            generateMutation.isSuccess
              ? "bg-green-600 text-white"
              : "text-gray-500 hover:bg-purple-600/20 hover:text-purple-400 disabled:opacity-30"
          }`}
          title="Generate AI caption"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : generateMutation.isSuccess ? (
            <Check className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Filename */}
      <p
        className="truncate px-1 py-0.5 text-xs text-gray-400"
        title={entry.filename}
      >
        {entry.filename}
      </p>

      {/* Editable caption */}
      <div className="px-1 pb-2">
        {isEditing ? (
          <textarea
            ref={captionInputRef}
            value={captionText}
            onChange={handleCaptionChange}
            onBlur={handleCaptionBlur}
            onKeyDown={handleCaptionKeyDown}
            rows={Math.max(3, captionText.split("\n").length + 1)}
            placeholder="Add tags…"
            className="w-full resize-y rounded border border-border bg-gray-800/80 px-2 py-1.5 text-xs leading-relaxed text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            style={{ minHeight: "4rem" }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            role="textbox"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleCaptionFocus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCaptionFocus();
              }
            }}
            className="min-h-[2.5rem] w-full cursor-text whitespace-pre-wrap break-words rounded border border-border bg-gray-800/80 px-2 py-1.5 text-xs leading-relaxed text-gray-200 hover:border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {displayText ? (
              searchHighlightText.trim() ? (
                highlightMatches(displayText, searchHighlightText)
              ) : (
                displayText
              )
            ) : (
              <span className="text-gray-500">Add tags…</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

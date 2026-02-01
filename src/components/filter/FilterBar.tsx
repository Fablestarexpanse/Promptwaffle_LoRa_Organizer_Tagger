import { Search, X, Smile, Frown, Wrench, CheckSquare } from "lucide-react";
import { useFilterStore } from "@/stores/filterStore";
import { useSelectionStore } from "@/stores/selectionStore";
import type { ImageRating } from "@/types";

export function FilterBar() {
  const query = useFilterStore((s) => s.query);
  const setQuery = useFilterStore((s) => s.setQuery);
  const showCaptioned = useFilterStore((s) => s.showCaptioned);
  const setShowCaptioned = useFilterStore((s) => s.setShowCaptioned);
  const ratingFilter = useFilterStore((s) => s.ratingFilter);
  const setRatingFilter = useFilterStore((s) => s.setRatingFilter);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  const hasFilters = query || showCaptioned !== null || ratingFilter !== null;

  function handleRatingFilter(rating: ImageRating) {
    setRatingFilter(ratingFilter === rating ? null : rating);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-elevated px-3 py-2">
      {/* Search input */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by filename or tag..."
          className="w-full rounded border border-border bg-surface py-1 pl-8 pr-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Caption filter buttons */}
      <div className="flex items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => setShowCaptioned(showCaptioned === false ? null : false)}
          className={`rounded px-2 py-1 ${
            showCaptioned === false
              ? "bg-orange-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Uncaptioned
        </button>
        <button
          type="button"
          onClick={() => setShowCaptioned(showCaptioned === true ? null : true)}
          className={`rounded px-2 py-1 ${
            showCaptioned === true
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Captioned
        </button>
      </div>

      {/* Rating filter buttons */}
      <div className="flex items-center gap-1 border-l border-border pl-2">
        <button
          type="button"
          onClick={() => handleRatingFilter("good")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
            ratingFilter === "good"
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Show Good images"
        >
          <Smile className="h-3 w-3" />
          Good
        </button>
        <button
          type="button"
          onClick={() => handleRatingFilter("bad")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
            ratingFilter === "bad"
              ? "bg-red-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Show Bad images"
        >
          <Frown className="h-3 w-3" />
          Bad
        </button>
        <button
          type="button"
          onClick={() => handleRatingFilter("needs_edit")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
            ratingFilter === "needs_edit"
              ? "bg-yellow-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Show Needs Edit images"
        >
          <Wrench className="h-3 w-3" />
          Edit
        </button>
      </div>

      {/* Selection indicator */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-1 border-l border-border pl-2">
          <span className="flex items-center gap-1 text-xs text-purple-400">
            <CheckSquare className="h-3 w-3" />
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          >
            Clear
          </button>
        </div>
      )}

      {/* Clear filters */}
      {hasFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        >
          <X className="h-3 w-3" />
          Clear Filters
        </button>
      )}
    </div>
  );
}

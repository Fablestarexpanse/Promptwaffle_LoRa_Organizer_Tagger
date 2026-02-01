import { ImageGrid } from "../grid/ImageGrid";
import { RightPanel } from "../editor/RightPanel";
import { FilterBar } from "../filter/FilterBar";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="flex flex-1 min-w-0">
      {/* Sidebar: folders & stats */}
      <Sidebar />

      {/* Main: filter bar + image grid */}
      <section className="flex flex-1 min-w-0 flex-col">
        <FilterBar />
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <ImageGrid />
        </div>
      </section>

      {/* Right: tag editor + AI panel */}
      <aside className="w-80 shrink-0 border-l border-border bg-surface-elevated">
        <RightPanel />
      </aside>
    </div>
  );
}

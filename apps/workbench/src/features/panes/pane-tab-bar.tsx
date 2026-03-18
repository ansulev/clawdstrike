import {
  IconLayoutColumns,
  IconLayoutRows,
  IconX,
} from "@tabler/icons-react";
import { usePaneStore } from "./pane-store";
import { PaneTab } from "./pane-tab";
import type { PaneGroup } from "./pane-types";

export function PaneTabBar({
  pane,
  active,
}: {
  pane: PaneGroup;
  active: boolean;
}) {
  const paneCount = usePaneStore((state) => state.paneCount());

  return (
    <div
      role="tablist"
      aria-label="Open editors"
      aria-orientation="horizontal"
      className="flex h-[36px] shrink-0 items-stretch border-b border-[#202531] bg-[#0b0d13]"
    >
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto scrollbar-hide">
        {pane.views.map((view) => (
          <PaneTab
            key={view.id}
            view={view}
            isActive={view.id === pane.activeViewId}
            paneId={pane.id}
          />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1 px-2">
        <button
          type="button"
          className="rounded-md p-1.5 text-[#6f7f9a] transition-colors hover:bg-[#131721] hover:text-[#ece7dc]"
          onClick={() =>
            usePaneStore.getState().splitPane(pane.id, "vertical")
          }
          title="Split vertically"
          aria-label="Split vertically"
        >
          <IconLayoutColumns size={14} stroke={1.8} />
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 text-[#6f7f9a] transition-colors hover:bg-[#131721] hover:text-[#ece7dc]"
          onClick={() =>
            usePaneStore.getState().splitPane(pane.id, "horizontal")
          }
          title="Split horizontally"
          aria-label="Split horizontally"
        >
          <IconLayoutRows size={14} stroke={1.8} />
        </button>
        {paneCount > 1 && (
          <button
            type="button"
            className="rounded-md p-1.5 text-[#6f7f9a] transition-colors hover:bg-[#2a1115] hover:text-[#ffb8b8]"
            onClick={() => usePaneStore.getState().closePane(pane.id)}
            title="Close pane"
            aria-label="Close pane"
          >
            <IconX size={14} stroke={1.8} />
          </button>
        )}
      </div>
    </div>
  );
}

import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { usePaneStore } from "./pane-store";
import type { PaneView } from "./pane-types";

export function PaneTab({
  view,
  isActive,
  paneId,
  onContextMenu,
}: {
  view: PaneView;
  isActive: boolean;
  paneId: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`pane-content-${paneId}`}
      className={cn(
        "group/tab relative flex h-[36px] min-w-[80px] max-w-[160px] shrink-0 items-center gap-1 px-3 transition-colors",
        isActive
          ? "bg-[#131721] text-[#ece7dc]"
          : "text-[#6f7f9a] hover:bg-[#131721]/60 hover:text-[#ece7dc]/80",
      )}
      onClick={() => usePaneStore.getState().setActiveView(paneId, view.id)}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          usePaneStore.getState().closeView(paneId, view.id);
        }
      }}
      onContextMenu={onContextMenu}
    >
      <span className="min-w-0 truncate text-[11px] font-mono font-medium tracking-[0.04em]">
        {view.label}
      </span>

      <span
        role="button"
        tabIndex={-1}
        aria-label={`Close ${view.label}`}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-colors",
          isActive
            ? "opacity-100 text-[#6f7f9a]/40 hover:bg-[#2a1115] hover:text-[#ffb8b8]"
            : "opacity-0 group-hover/tab:opacity-100 text-[#6f7f9a]/40 hover:bg-[#2a1115] hover:text-[#ffb8b8]",
        )}
        onClick={(e) => {
          e.stopPropagation();
          usePaneStore.getState().closeView(paneId, view.id);
        }}
      >
        <IconX size={14} stroke={1.8} />
      </span>

      {isActive && (
        <div className="absolute bottom-0 left-[8px] right-[8px] h-[2px] rounded-t-full bg-[#d4a84b]" />
      )}
    </button>
  );
}

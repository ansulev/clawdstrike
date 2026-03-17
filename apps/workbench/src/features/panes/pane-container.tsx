import { motion } from "motion/react";
import {
  IconLayoutColumns,
  IconLayoutRows,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { getPaneActiveView } from "./pane-tree";
import { usePaneStore } from "./pane-store";
import { PaneRouteRenderer } from "./pane-route-renderer";
import type { PaneGroup } from "./pane-types";

export function PaneContainer({
  pane,
  active,
}: {
  pane: PaneGroup;
  active: boolean;
}) {
  const activeView = getPaneActiveView(pane);
  const paneCount = usePaneStore((state) => state.paneCount());

  if (!activeView) {
    return null;
  }

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border bg-[#07090f]",
        active
          ? "border-[#d4a84b]/45 shadow-[0_0_0_1px_rgba(212,168,75,0.08)]"
          : "border-[#202531]",
      )}
      onMouseDownCapture={() => {
        if (!active) {
          usePaneStore.getState().setActivePane(pane.id);
        }
      }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#202531] bg-[#0b0d13]/95 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 shrink-0 rounded-full transition-colors",
              active ? "bg-[#d4a84b]" : "bg-[#364054]",
            )}
          />
          <button
            type="button"
            className={cn(
              "min-w-0 truncate rounded-md px-2 py-1 text-left text-[11px] font-medium tracking-[0.08em] uppercase transition-colors",
              active ? "bg-[#131721] text-[#ece7dc]" : "text-[#6f7f9a]",
            )}
            onClick={() => usePaneStore.getState().setActivePane(pane.id)}
            title={activeView.route}
          >
            {activeView.label}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-[#6f7f9a] transition-colors hover:bg-[#131721] hover:text-[#ece7dc]"
            onClick={() => usePaneStore.getState().splitPane(pane.id, "vertical")}
            title="Split vertically"
            aria-label="Split vertically"
          >
            <IconLayoutColumns size={14} stroke={1.8} />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-[#6f7f9a] transition-colors hover:bg-[#131721] hover:text-[#ece7dc]"
            onClick={() => usePaneStore.getState().splitPane(pane.id, "horizontal")}
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
      </header>

      <motion.div
        key={activeView.route}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="min-h-0 flex-1 overflow-auto"
      >
        <PaneRouteRenderer route={activeView.route} />
      </motion.div>
    </section>
  );
}

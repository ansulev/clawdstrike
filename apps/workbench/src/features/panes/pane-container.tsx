import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { getPaneActiveView } from "./pane-tree";
import { usePaneStore } from "./pane-store";
import { PaneRouteRenderer } from "./pane-route-renderer";
import { PaneTabBar } from "./pane-tab-bar";
import type { PaneGroup } from "./pane-types";

export function PaneContainer({
  pane,
  active,
}: {
  pane: PaneGroup;
  active: boolean;
}) {
  const activeView = getPaneActiveView(pane);

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
      <PaneTabBar pane={pane} active={active} />

      <motion.div
        key={activeView.route}
        id={`pane-content-${pane.id}`}
        role="tabpanel"
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

import { IconChevronsRight } from "@tabler/icons-react";
import { useRightSidebarStore } from "../stores/right-sidebar-store";
import { SpeakeasyPanel } from "@/components/workbench/speakeasy/speakeasy-panel";

export function RightSidebar() {
  const width = useRightSidebarStore.use.width();
  const actions = useRightSidebarStore.use.actions();

  return (
    <aside
      role="complementary"
      aria-label="Right Sidebar"
      className="shrink-0 flex flex-col bg-[#0b0d13] border-l border-[#1a1d28]/50"
      style={{ width }}
    >
      {/* Panel header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#2d3240]/40 px-4">
        <span className="font-display font-semibold text-[14px] text-[#ece7dc]">
          Speakeasy
        </span>
        <button
          type="button"
          aria-label="Collapse right sidebar"
          className="rounded p-0.5 text-[#6f7f9a] transition-colors hover:text-[#ece7dc]"
          onClick={() => actions.hide()}
        >
          <IconChevronsRight size={14} stroke={1.8} />
        </button>
      </div>

      {/* Panel body -- SpeakeasyPanel rendered inline */}
      <SpeakeasyPanel
        inline
        isOpen
        room={null}
        onClose={() => actions.hide()}
      />
    </aside>
  );
}

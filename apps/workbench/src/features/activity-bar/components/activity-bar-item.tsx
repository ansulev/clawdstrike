import type { ComponentType } from "react";
import type { SigilProps } from "@/components/desktop/sidebar-icons";
import type { ActivityBarItemId } from "../types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// ActivityBarItem — Individual clickable icon in the 48px activity bar rail.
// ---------------------------------------------------------------------------

interface ActivityBarItemProps {
  id: ActivityBarItemId;
  icon: ComponentType<SigilProps>;
  tooltip: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

export function ActivityBarItem({
  id,
  icon: Icon,
  tooltip,
  active,
  onClick,
  badge,
}: ActivityBarItemProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls="sidebar-panel"
      id={`activity-bar-tab-${id}`}
      title={tooltip}
      onClick={onClick}
      className={cn(
        "w-9 h-9 flex items-center justify-center relative",
        "transition-colors duration-150 ease-in-out",
        active
          ? "text-[#d4a84b] bg-[#131721]/60"
          : "text-[#6f7f9a] hover:text-[#ece7dc]/80",
      )}
    >
      {/* Active indicator bar */}
      {active && (
        <span
          className="absolute left-0 rounded-r-full"
          style={{
            top: 8,
            bottom: 8,
            width: 2,
            backgroundColor: "#d4a84b",
            boxShadow: "0 0 8px rgba(212,168,75,0.3)",
          }}
        />
      )}
      <Icon
        size={18}
        stroke={1.4}
        style={
          active
            ? { filter: "drop-shadow(0 0 4px rgba(212,168,75,0.25))" }
            : undefined
        }
      />
      {typeof badge === "number" && badge > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[8px] font-bold leading-none px-1"
          style={{
            backgroundColor: "#c45c5c",
            color: "#ece7dc",
            boxShadow: "0 0 6px rgba(196,92,92,0.4)",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

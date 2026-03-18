import { useRef, useEffect } from "react";
import { IconFilePlus, IconEdit, IconTrash } from "@tabler/icons-react";
import type { ProjectFile } from "@/features/project/stores/project-store";

interface ExplorerContextMenuProps {
  menu: { file: ProjectFile; x: number; y: number };
  onClose: () => void;
  onNewFile: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function ExplorerContextMenu({
  menu,
  onClose,
  onNewFile,
  onRename,
  onDelete,
}: ExplorerContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  type MenuItem =
    | { label: string; icon: typeof IconFilePlus; action: () => void; variant?: "danger" }
    | { type: "separator" };

  const items: MenuItem[] = [
    {
      label: "New File",
      icon: IconFilePlus,
      action: () => {
        onNewFile();
        onClose();
      },
    },
  ];

  // Only show rename/delete for non-directory files.
  if (!menu.file.isDirectory) {
    items.push({ type: "separator" });
    items.push({
      label: "Rename",
      icon: IconEdit,
      action: () => {
        onRename();
        onClose();
      },
    });
    items.push({
      label: "Delete",
      icon: IconTrash,
      action: () => {
        onDelete();
        onClose();
      },
      variant: "danger",
    });
  }

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[160px] bg-[#131721] border border-[#2d3240] rounded-md shadow-xl py-1"
      style={{ left: menu.x, top: menu.y }}
    >
      {items.map((item, i) => {
        if ("type" in item && item.type === "separator") {
          return <div key={i} className="h-px bg-[#2d3240] my-1" />;
        }
        const Icon = "icon" in item ? item.icon : null;
        const isDanger = "variant" in item && item.variant === "danger";
        return (
          <button
            key={i}
            type="button"
            className={
              isDanger
                ? "flex items-center gap-2 w-full px-3 py-1.5 text-[11px] font-mono text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                : "flex items-center gap-2 w-full px-3 py-1.5 text-[11px] font-mono text-[#ece7dc] hover:bg-[#d4a84b]/10 hover:text-[#d4a84b] transition-colors text-left"
            }
            onClick={() => {
              if ("action" in item) item.action();
            }}
          >
            {Icon && <Icon size={12} stroke={1.5} />}
            {"label" in item && item.label}
          </button>
        );
      })}
    </div>
  );
}

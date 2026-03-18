/**
 * FileEditorToolbar -- Contextual toolbar for the per-file editor shell.
 *
 * Policy files (clawdstrike_policy) get validate/format/test/problems buttons.
 * Non-policy files (sigma, yara, ocsf) get a simplified toolbar with just the
 * file-type badge and validation status.
 *
 * NOTE: SplitModeToggle is intentionally omitted -- pane splitting replaces
 * the Editor's internal split (FLAT-06). Guards/Compare/Coverage/Explorer
 * buttons are also omitted since they are accessible via standalone pane
 * routes and command palette (Phase 7).
 */
import {
  IconPlayerPlay,
  IconCode,
  IconTestPipe,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { isPolicyFileType } from "@/lib/workbench/file-type-registry";
import type { TabMeta } from "@/features/policy/stores/policy-tabs-store";
import type { TabEditState } from "@/features/policy/stores/policy-edit-store";

// ---- Props ----

export interface FileEditorToolbarProps {
  tabMeta: TabMeta;
  editState: TabEditState;
  onToggleTestRunner?: () => void;
  onToggleProblems?: () => void;
  testRunnerOpen?: boolean;
  problemsOpen?: boolean;
}

// ---- Helper components ----

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
  badge,
}: {
  icon: typeof IconPlayerPlay;
  label: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "relative rounded-md p-1.5 transition-colors",
        active
          ? "bg-[#d4a84b]/10 text-[#d4a84b]"
          : "text-[#6f7f9a] hover:bg-[#131721] hover:text-[#ece7dc]",
      )}
      onClick={onClick}
    >
      <Icon size={14} stroke={1.8} />
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-[#f87171] px-0.5 text-[8px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-4 w-px bg-[#2d3240]" />;
}

// ---- Main component ----

export function FileEditorToolbar({
  tabMeta,
  editState,
  onToggleTestRunner,
  onToggleProblems,
  testRunnerOpen,
  problemsOpen,
}: FileEditorToolbarProps) {
  const isPolicy = isPolicyFileType(tabMeta.fileType);

  return (
    <div className="flex h-[36px] shrink-0 items-center gap-1 border-b border-[#202531] bg-[#0b0d13] px-3">
      {/* File type badge */}
      <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-[#6f7f9a]/60">
        {tabMeta.fileType.replace(/_/g, " ")}
      </span>

      {/* Policy-only buttons */}
      {isPolicy && (
        <>
          <ToolbarButton
            icon={IconPlayerPlay}
            label="Validate"
            onClick={() => {
              /* validation already runs on yaml change via policy-edit-store */
            }}
          />
          <ToolbarButton
            icon={IconCode}
            label="Format"
            onClick={() => {
              /* format action -- noop for now, can be wired to prettier-yaml */
            }}
          />
          <ToolbarDivider />
          <ToolbarButton
            icon={IconTestPipe}
            label="Test Runner"
            active={testRunnerOpen}
            onClick={onToggleTestRunner}
          />
          <ToolbarButton
            icon={IconAlertTriangle}
            label="Problems"
            active={problemsOpen}
            onClick={onToggleProblems}
            badge={
              editState.validation.errors.length > 0
                ? editState.validation.errors.length
                : undefined
            }
          />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Validation status indicator (right side) */}
      <span
        className={cn(
          "font-mono text-[10px]",
          editState.validation.valid
            ? "text-[#86efac]"
            : "text-[#f87171]",
        )}
      >
        {editState.validation.valid
          ? "Valid"
          : `${editState.validation.errors.length} error(s)`}
      </span>
    </div>
  );
}

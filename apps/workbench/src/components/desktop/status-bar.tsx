import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkbench, useMultiPolicy } from "@/features/policy/stores/multi-policy-store";
import { useFleetConnection } from "@/features/fleet/use-fleet-connection";
import { useMcpStatus } from "@/lib/workbench/use-mcp-status";
import { isDesktop } from "@/lib/tauri-bridge";
import { FILE_TYPE_REGISTRY } from "@/lib/workbench/file-type-registry";
import { GUARD_REGISTRY } from "@/lib/workbench/guard-registry";
import type { GuardId } from "@/lib/workbench/types";
import { cn } from "@/lib/utils";
import {
  IconPlugConnected,
  IconRefresh,
  IconPlayerStop,
  IconLoader2,
} from "@tabler/icons-react";
import {
  statusBarRegistry,
  registerStatusBarItem,
  getStatusBarItems,
  onStatusBarChange,
} from "@/lib/workbench/status-bar-registry";
import type { StatusBarItem } from "@/lib/workbench/status-bar-registry";

// ---------------------------------------------------------------------------
// Built-in segment components (each uses hooks, so must be a component)
// ---------------------------------------------------------------------------

function ValidationSegment() {
  const { state } = useWorkbench();
  const { activeTab: currentTab } = useMultiPolicy();
  const { activePolicy, validation, nativeValidation } = state;
  const desktop = isDesktop();
  const rawFileType = currentTab?.fileType ?? "clawdstrike_policy";
  const fileDescriptor = FILE_TYPE_REGISTRY[rawFileType as keyof typeof FILE_TYPE_REGISTRY];
  const policyTab = fileDescriptor?.id === "clawdstrike_policy";

  const prefersNativeDetectionValidation = desktop && !policyTab;
  const nativeValidationPending = prefersNativeDetectionValidation && nativeValidation.loading;
  const useNativeDetectionValidation =
    prefersNativeDetectionValidation && !nativeValidationPending && nativeValidation.valid !== null;
  const nativeErrorCount = nativeValidation.topLevelErrors.length
    + Object.values(nativeValidation.guardErrors).reduce((count, issues) => count + issues.length, 0);
  const errorCount = useNativeDetectionValidation
    ? nativeErrorCount
    : validation.errors.length;
  const warningCount = useNativeDetectionValidation
    ? nativeValidation.topLevelWarnings.length
    : validation.warnings.length;

  let statusIcon: string;
  let statusText: string;
  let statusColor: string;

  if (nativeValidationPending) {
    statusIcon = "\u2026";
    statusText = "Validating...";
    statusColor = "#6f7f9a";
  } else if (errorCount > 0) {
    statusIcon = "\u2718";
    statusText = `${errorCount} error${errorCount !== 1 ? "s" : ""}`;
    statusColor = "#c45c5c";
  } else if (warningCount > 0) {
    statusIcon = "\u26a0";
    statusText = `${warningCount} warning${warningCount !== 1 ? "s" : ""}`;
    statusColor = "#d4a84b";
  } else {
    statusIcon = "\u2714";
    statusText = "Valid";
    statusColor = "#3dbf84";
  }

  return (
    <span className="flex items-center gap-1.5" style={{ color: statusColor }}>
      <span className="text-[9px] leading-none">{statusIcon}</span>
      <span>{statusText}</span>
    </span>
  );
}

function GuardCountSegment() {
  const { state } = useWorkbench();
  const { activePolicy } = state;

  const enabledGuards = GUARD_REGISTRY.filter((g) => {
    const cfg = activePolicy.guards[g.id as GuardId];
    return cfg && "enabled" in cfg && cfg.enabled;
  }).length;
  const totalGuards = GUARD_REGISTRY.length;

  return (
    <span className="text-[#6f7f9a]/80">
      {enabledGuards}/{totalGuards} guards
    </span>
  );
}

function PolicyVersionSegment() {
  const { state } = useWorkbench();
  const { activePolicy } = state;

  return (
    <span className="text-[#6f7f9a]/80">
      v{activePolicy.version}
    </span>
  );
}

function FileTypeSegment() {
  const { activeTab: currentTab } = useMultiPolicy();
  const rawFileType = currentTab?.fileType ?? "clawdstrike_policy";
  const fileDescriptor = FILE_TYPE_REGISTRY[rawFileType as keyof typeof FILE_TYPE_REGISTRY];

  return (
    <span className="text-[#6f7f9a]/80">
      {fileDescriptor?.label ?? rawFileType}
    </span>
  );
}

function FleetStatusSegment() {
  const { connection } = useFleetConnection();
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/settings")}
      className="flex items-center gap-1.5 hover:text-[#ece7dc] transition-colors"
      title={
        connection.connected
          ? `Connected to ${connection.hushdUrl}`
          : "Click to configure fleet connection"
      }
    >
      <span
        className="inline-block w-[6px] h-[6px] rounded-full"
        style={{
          backgroundColor: connection.connected ? "#3dbf84" : "#6f7f9a40",
        }}
      />
      <span className={connection.connected ? "text-[#6f7f9a]" : "text-[#6f7f9a]/50"}>
        {connection.connected
          ? `Fleet: ${connection.agentCount} agent${connection.agentCount !== 1 ? "s" : ""}`
          : "Local"}
      </span>
    </button>
  );
}

function McpStatusSegment() {
  const desktop = isDesktop();
  if (!desktop) return null;
  return <McpStatusIndicator />;
}

function EvalCountSegment() {
  const { connection } = useFleetConnection();

  return (
    <span
      className="text-[#6f7f9a]/70 font-mono text-[10px]"
      title={connection.connected ? "Total evaluations processed by fleet" : "Not connected to fleet"}
    >
      {connection.connected
        ? `${connection.hushdHealth?.total_evaluations != null ? connection.hushdHealth.total_evaluations.toLocaleString() : "..."} evals`
        : "\u2014"}
    </span>
  );
}

function TabCountSegment() {
  const { tabs } = useMultiPolicy();
  if (tabs.length <= 1) return null;
  return (
    <span className="text-[#6f7f9a]/60">
      {tabs.length} tabs
    </span>
  );
}

function ActivePolicySegment() {
  const { state } = useWorkbench();
  const { activeTab: currentTab } = useMultiPolicy();
  const { activePolicy } = state;

  return (
    <span
      className="flex items-center gap-1 text-[#ece7dc]/70 truncate max-w-[200px]"
      title={`Active policy: ${currentTab?.name || activePolicy.name}${state.dirty ? " (unsaved changes)" : ""}`}
    >
      {state.dirty && (
        <span className="inline-block w-[6px] h-[6px] rounded-full bg-[#d4a84b] shrink-0" />
      )}
      <span className="truncate">{currentTab?.name || activePolicy.name}</span>
    </span>
  );
}

function FilePathSegment() {
  const { state } = useWorkbench();
  const { filePath } = state;

  if (filePath) {
    return (
      <span className="text-[#6f7f9a]/70 truncate max-w-[400px]" title={filePath}>
        {filePath}
      </span>
    );
  }
  return <span className="text-[#6f7f9a]/30 italic">unsaved</span>;
}

// ---------------------------------------------------------------------------
// Conditional wrapper: renders guard-count OR file-type based on active tab
// ---------------------------------------------------------------------------

function GuardCountOrFileTypeSegment() {
  const { activeTab: currentTab } = useMultiPolicy();
  const rawFileType = currentTab?.fileType ?? "clawdstrike_policy";
  const fileDescriptor = FILE_TYPE_REGISTRY[rawFileType as keyof typeof FILE_TYPE_REGISTRY];
  const policyTab = fileDescriptor?.id === "clawdstrike_policy";

  if (policyTab) {
    return <GuardCountSegment />;
  }
  return <FileTypeSegment />;
}

function PolicyVersionOrNullSegment() {
  const { activeTab: currentTab } = useMultiPolicy();
  const rawFileType = currentTab?.fileType ?? "clawdstrike_policy";
  const fileDescriptor = FILE_TYPE_REGISTRY[rawFileType as keyof typeof FILE_TYPE_REGISTRY];
  const policyTab = fileDescriptor?.id === "clawdstrike_policy";

  if (!policyTab) return null;
  return <PolicyVersionSegment />;
}

// ---------------------------------------------------------------------------
// Register built-in items at module scope
// ---------------------------------------------------------------------------

registerStatusBarItem({
  id: "builtin:validation",
  side: "left",
  priority: 10,
  render: () => <ValidationSegment />,
});

registerStatusBarItem({
  id: "builtin:guard-count-or-file-type",
  side: "left",
  priority: 20,
  render: () => <GuardCountOrFileTypeSegment />,
});

registerStatusBarItem({
  id: "builtin:policy-version",
  side: "left",
  priority: 25,
  render: () => <PolicyVersionOrNullSegment />,
});

registerStatusBarItem({
  id: "builtin:fleet-status",
  side: "left",
  priority: 30,
  render: () => <FleetStatusSegment />,
});

registerStatusBarItem({
  id: "builtin:mcp-status",
  side: "left",
  priority: 40,
  render: () => <McpStatusSegment />,
});

registerStatusBarItem({
  id: "builtin:eval-count",
  side: "right",
  priority: 10,
  render: () => <EvalCountSegment />,
});

registerStatusBarItem({
  id: "builtin:tab-count",
  side: "right",
  priority: 20,
  render: () => <TabCountSegment />,
});

registerStatusBarItem({
  id: "builtin:active-policy",
  side: "right",
  priority: 30,
  render: () => <ActivePolicySegment />,
});

registerStatusBarItem({
  id: "builtin:file-path",
  side: "right",
  priority: 40,
  render: () => <FilePathSegment />,
});

// ---------------------------------------------------------------------------
// Hook: subscribe to registry for reactive re-rendering
// ---------------------------------------------------------------------------

function useStatusBarItems(side: "left" | "right") {
  return useSyncExternalStore(
    onStatusBarChange,
    () => getStatusBarItems(side),
  );
}

// ---------------------------------------------------------------------------
// StatusBar component - renders from registry
// ---------------------------------------------------------------------------

const Separator = () => <span className="w-px h-3 bg-[#2d3240]/60" />;

function StatusBarSegment({ item }: { item: StatusBarItem }) {
  return <>{item.render()}</>;
}

export function StatusBar() {
  const leftItems = useStatusBarItems("left");
  const rightItems = useStatusBarItems("right");

  return (
    <footer className="desktop-statusbar shrink-0 select-none">
      {/* ---- Left ---- */}
      <div className="flex items-center gap-4">
        {leftItems.map((item, idx) => (
          <StatusBarSegmentWithSeparator key={item.id} item={item} showSeparator={idx > 0} />
        ))}
      </div>

      {/* ---- Right ---- */}
      <div className="flex items-center gap-3 min-w-0">
        {rightItems.map((item, idx) => (
          <StatusBarSegmentWithSeparator key={item.id} item={item} showSeparator={idx > 0} />
        ))}
      </div>
    </footer>
  );
}

function StatusBarSegmentWithSeparator({
  item,
  showSeparator,
}: {
  item: StatusBarItem;
  showSeparator: boolean;
}) {
  return (
    <>
      {showSeparator && <Separator />}
      <StatusBarSegment item={item} />
    </>
  );
}


function McpStatusIndicator() {
  const {
    status,
    isRestarting,
    isStopping,
    handleRestart,
    handleStop,
  } = useMcpStatus();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const running = status?.running ?? false;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 hover:text-[#ece7dc] transition-colors"
        title={running ? "MCP sidecar running — click to manage" : "MCP sidecar stopped — click to manage"}
      >
        <IconPlugConnected size={11} stroke={1.5} className={running ? "text-[#3dbf84]" : "text-[#6f7f9a]/40"} />
        <span className={running ? "text-[#6f7f9a]" : "text-[#6f7f9a]/50"}>
          {running ? "MCP" : "MCP off"}
        </span>
        <span
          className="inline-block w-[6px] h-[6px] rounded-full"
          style={{ backgroundColor: running ? "#3dbf84" : "#c45c5c" }}
        />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border border-[#2d3240] bg-[#0b0d13] shadow-xl z-50"
        >
          <div className="px-3 py-2.5 border-b border-[#2d3240]/60">
            <div className="flex items-center gap-2">
              <IconPlugConnected size={12} stroke={1.5} className="text-[#d4a84b]" />
              <span className="text-[11px] font-mono font-medium text-[#ece7dc]">MCP Sidecar</span>
              <span
                className={cn(
                  "ml-auto text-[9px] font-mono",
                  running ? "text-[#3dbf84]" : "text-[#c45c5c]",
                )}
              >
                {running ? "running" : "stopped"}
              </span>
            </div>
            {running && status?.url && (
              <div className="mt-1.5 text-[9px] font-mono text-[#6f7f9a]/60 truncate">
                {status.url}
              </div>
            )}
            {!running && status?.error && (
              <div className="mt-1.5 text-[9px] font-mono text-[#c45c5c]/80 truncate">
                {status.error}
              </div>
            )}
          </div>

          <div className="px-3 py-2 flex items-center gap-1.5">
            <button
              onClick={() => {
                handleRestart();
                setOpen(false);
              }}
              disabled={isRestarting || isStopping}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 h-6 rounded text-[10px] font-medium border transition-colors",
                isRestarting
                  ? "text-[#6f7f9a] border-[#2d3240] bg-[#131721] cursor-wait"
                  : "text-[#ece7dc] border-[#2d3240] bg-[#131721] hover:border-[#d4a84b]/40 hover:text-[#d4a84b]",
              )}
            >
              {isRestarting ? (
                <IconLoader2 size={10} stroke={1.5} className="animate-spin" />
              ) : (
                <IconRefresh size={10} stroke={1.5} />
              )}
              {running ? "Restart" : "Start"}
            </button>
            {running && (
              <button
                onClick={() => {
                  handleStop();
                  setOpen(false);
                }}
                disabled={isRestarting || isStopping}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 h-6 rounded text-[10px] font-medium border transition-colors",
                  isStopping
                    ? "text-[#6f7f9a] border-[#2d3240] bg-[#131721] cursor-wait"
                    : "text-[#ece7dc] border-[#c45c5c]/30 bg-[#131721] hover:border-[#c45c5c]/60 hover:text-[#c45c5c]",
                )}
              >
                {isStopping ? (
                  <IconLoader2 size={10} stroke={1.5} className="animate-spin" />
                ) : (
                  <IconPlayerStop size={10} stroke={1.5} />
                )}
                Stop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useLayoutEffect, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Titlebar } from "@/components/desktop/titlebar";
import { StatusBar } from "@/components/desktop/status-bar";
import { DesktopSidebar } from "@/components/desktop/desktop-sidebar";
import { ShortcutProvider } from "@/components/desktop/shortcut-provider";
import { CommandPalette } from "@/components/desktop/command-palette";
import { CrashRecoveryBanner } from "@/components/desktop/crash-recovery-banner";
import { BottomPane } from "@/features/bottom-pane/bottom-pane";
import { useBottomPaneStore } from "@/features/bottom-pane/bottom-pane-store";
import { PaneRoot } from "@/features/panes/pane-root";
import { getActivePaneRoute, usePaneStore } from "@/features/panes/pane-store";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { InitCommands } from "@/lib/commands/init-commands";
import { useMultiPolicy, useWorkbench } from "@/features/policy/stores/multi-policy-store";
import { useAutoSave } from "@/lib/workbench/use-auto-save";
import { normalizeWorkbenchRoute } from "./workbench-routes";
import { useActivePluginView, setActivePluginView } from "@/components/desktop/active-plugin-view";
import { getView, onViewRegistryChange } from "@/lib/plugins/view-registry";
import type { ViewRegistration, ViewProps } from "@/lib/plugins/view-registry";
import { ViewContainer } from "@/components/plugins/view-container";

// ---------------------------------------------------------------------------
// Internal: Stable wrapper component that passes isCollapsed via a ref so
// the ViewContainer registration identity never changes when isCollapsed
// toggles (avoids unmount/remount destroying plugin local state).
// ---------------------------------------------------------------------------

/** Inner component that reads isCollapsed from the ref held by the parent. */
function ActivityBarPluginViewInner({
  registration,
  isCollapsedRef,
}: {
  registration: ViewRegistration;
  isCollapsedRef: React.RefObject<boolean>;
}) {
  // Build a stable wrapped registration that closes over the ref, not the value.
  const wrappedRegistration = useMemo(
    () => ({
      ...registration,
      component: function PluginViewWithCollapse(props: ViewProps) {
        const Component = registration.component;
        return <Component {...props} isCollapsed={isCollapsedRef.current} />;
      },
    }),
    [registration, isCollapsedRef],
  );

  return <ViewContainer registration={wrappedRegistration} isActive={true} />;
}

function ActivityBarPluginView({
  registration,
  isCollapsed,
}: {
  registration: ViewRegistration;
  isCollapsed: boolean;
}) {
  const isCollapsedRef = useRef(isCollapsed);
  isCollapsedRef.current = isCollapsed;

  return (
    <ActivityBarPluginViewInner
      registration={registration}
      isCollapsedRef={isCollapsedRef}
    />
  );
}

export function DesktopLayout() {
  const { tabs } = useMultiPolicy();
  const { state } = useWorkbench();
  const isCollapsed = state.ui.sidebarCollapsed;
  const { pendingRecovery, dismissRecovery, restoreRecovery } = useAutoSave();
  const location = useLocation();
  const navigate = useNavigate();
  const bottomPaneOpen = useBottomPaneStore((state) => state.isOpen);
  const bottomPaneSize = useBottomPaneStore((state) => state.size);
  const activePaneRoute = usePaneStore((state) =>
    getActivePaneRoute(state.root, state.activePaneId),
  );
  const hasDirtyTabs = tabs.some((tab) => tab.dirty);
  const rawRoute = `${location.pathname}${location.search}` || "/";
  const currentRoute = normalizeWorkbenchRoute(rawRoute);

  const activePluginViewId = useActivePluginView();
  const activePluginRegistration = useSyncExternalStore(
    onViewRegistryChange,
    () => (activePluginViewId ? getView(activePluginViewId) : undefined),
  );

  // If the active plugin view was unregistered (e.g., plugin uninstalled),
  // clear the active plugin view automatically.
  useEffect(() => {
    if (activePluginViewId && !activePluginRegistration) {
      setActivePluginView(null);
    }
  }, [activePluginViewId, activePluginRegistration]);

  // Warn on window close / reload when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDirtyTabs) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasDirtyTabs]);

  useLayoutEffect(() => {
    usePaneStore.getState().syncRoute(currentRoute);
  }, [currentRoute]);

  useEffect(() => {
    if (rawRoute === currentRoute) return;
    navigate(currentRoute, { replace: true });
  }, [currentRoute, navigate, rawRoute]);

  useEffect(() => {
    if (!activePaneRoute) return;
    const latestActivePaneRoute = getActivePaneRoute(
      usePaneStore.getState().root,
      usePaneStore.getState().activePaneId,
    );
    if (activePaneRoute !== latestActivePaneRoute) {
      return;
    }
    if (rawRoute !== currentRoute) return;
    if (activePaneRoute === rawRoute) return;
    navigate(activePaneRoute);
  }, [activePaneRoute, currentRoute, rawRoute, navigate]);

  // When a plugin view is active, render it in a full-screen overlay
  // instead of the normal pane content.
  const renderMainContent = () => {
    if (activePluginViewId && activePluginRegistration) {
      return (
        <div className="h-full overflow-auto">
          <ActivityBarPluginView
            registration={activePluginRegistration}
            isCollapsed={isCollapsed}
          />
        </div>
      );
    }

    if (bottomPaneOpen) {
      return (
        <ResizablePanelGroup
          direction="vertical"
          className="h-full w-full"
          onLayout={(sizes) => {
            if (sizes.length >= 2) {
              useBottomPaneStore.getState().setSize(sizes[1]);
            }
          }}
        >
          <ResizablePanel defaultSize={100 - bottomPaneSize} minSize={30}>
            <PaneRoot />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={bottomPaneSize} minSize={16}>
            <BottomPane />
          </ResizablePanel>
        </ResizablePanelGroup>
      );
    }

    return <PaneRoot />;
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#05060a]">
      {/* Command registry initialization + global keyboard shortcuts */}
      <InitCommands />
      <ShortcutProvider />
      <CommandPalette />

      {/* Top: custom titlebar */}
      <Titlebar />

      {/* Crash recovery banner (shown when autosave detected on startup) */}
      {pendingRecovery && pendingRecovery.length > 0 && (
        <CrashRecoveryBanner
          entries={pendingRecovery}
          onRestore={restoreRecovery}
          onDismiss={dismissRecovery}
        />
      )}

      {/* Middle: sidebar + routed content */}
      <div className="flex flex-1 min-h-0">
        <DesktopSidebar />

        <main className="flex flex-1 min-w-0 flex-col overflow-hidden select-text">
          {renderMainContent()}
        </main>
      </div>

      {/* Bottom: status bar */}
      <StatusBar />
    </div>
  );
}

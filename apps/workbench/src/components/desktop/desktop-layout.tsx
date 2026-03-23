import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Titlebar } from "@/components/desktop/titlebar";
import { StatusBar } from "@/components/desktop/status-bar";
import { ShortcutProvider } from "@/components/desktop/shortcut-provider";
import { CommandPalette } from "@/components/desktop/command-palette";
import { CrashRecoveryBanner } from "@/components/desktop/crash-recovery-banner";
import { BottomPane } from "@/features/bottom-pane/bottom-pane";
import { useBottomPaneStore } from "@/features/bottom-pane/bottom-pane-store";
import { ActivityBar } from "@/features/activity-bar/components/activity-bar";
import { SidebarPanel } from "@/features/activity-bar/components/sidebar-panel";
import { SidebarResizeHandle } from "@/features/activity-bar/components/sidebar-resize-handle";
import { QuickOpenDialog } from "@/features/navigation/quick-open-dialog";
import { RightSidebar } from "@/features/right-sidebar/components/right-sidebar";
import { RightSidebarResizeHandle } from "@/features/right-sidebar/components/right-sidebar-resize-handle";
import { useRightSidebarStore } from "@/features/right-sidebar/stores/right-sidebar-store";
import { PaneRoot } from "@/features/panes/pane-root";
import { getActivePaneRoute, usePaneStore } from "@/features/panes/pane-store";
import { savePaneSession } from "@/features/panes/pane-session";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { InitCommands } from "@/lib/commands/init-commands";
import { useAutoSave } from "@/lib/workbench/use-auto-save";
import { usePolicyTabsStore } from "@/features/policy/stores/policy-tabs-store";
import { useWorkbenchUIStore } from "@/features/policy/stores/workbench-ui-store";
import { useActivePluginView, setActivePluginView } from "@/components/desktop/active-plugin-view";
import { ViewContainer } from "@/components/plugins/view-container";
import {
  getView,
  onViewRegistryChange,
  type ViewProps,
  type ViewRegistration,
} from "@/lib/plugins/view-registry";
import { normalizeWorkbenchRoute } from "./workbench-routes";

function ActivityBarPluginViewInner({
  registration,
  isCollapsedRef,
}: {
  registration: ViewRegistration;
  isCollapsedRef: RefObject<boolean>;
}) {
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
  const tabs = usePolicyTabsStore((state) => state.tabs);
  const isCollapsed = useWorkbenchUIStore((state) => state.sidebarCollapsed);
  const { pendingRecovery, dismissRecovery, restoreRecovery } = useAutoSave();
  const location = useLocation();
  const navigate = useNavigate();
  const bottomPaneOpen = useBottomPaneStore((state) => state.isOpen);
  const bottomPaneSize = useBottomPaneStore((state) => state.size);
  const rightSidebarVisible = useRightSidebarStore((state) => state.visible);
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

  useEffect(() => {
    if (activePluginViewId && !activePluginRegistration) {
      setActivePluginView(null);
    }
  }, [activePluginRegistration, activePluginViewId]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      const { root, activePaneId } = usePaneStore.getState();
      savePaneSession(root, activePaneId);

      if (hasDirtyTabs) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasDirtyTabs]);

  useEffect(() => {
    const interval = setInterval(() => {
      const { root, activePaneId } = usePaneStore.getState();
      savePaneSession(root, activePaneId);
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

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
    if (activePaneRoute !== latestActivePaneRoute) return;
    if (rawRoute !== currentRoute) return;
    if (activePaneRoute === rawRoute) return;
    navigate(activePaneRoute);
  }, [activePaneRoute, currentRoute, navigate, rawRoute]);

  const renderMainContent = () => {
    const mainPanel = activePluginViewId && activePluginRegistration ? (
      <div className="h-full overflow-auto">
        <ActivityBarPluginView
          registration={activePluginRegistration}
          isCollapsed={isCollapsed}
        />
      </div>
    ) : (
      <PaneRoot />
    );

    if (!bottomPaneOpen) {
      return mainPanel;
    }

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
          {mainPanel}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={bottomPaneSize} minSize={16}>
          <BottomPane />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#05060a]">
      <InitCommands />
      <ShortcutProvider />
      <CommandPalette />
      <QuickOpenDialog />
      <Titlebar />

      {pendingRecovery && pendingRecovery.length > 0 && (
        <CrashRecoveryBanner
          entries={pendingRecovery}
          onRestore={restoreRecovery}
          onDismiss={dismissRecovery}
        />
      )}

      <div className="flex flex-1 min-h-0">
        <ActivityBar />
        <SidebarPanel />
        <SidebarResizeHandle />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
          {renderMainContent()}
        </main>

        {rightSidebarVisible && (
          <>
            <RightSidebarResizeHandle />
            <RightSidebar />
          </>
        )}
      </div>

      <StatusBar />
    </div>
  );
}

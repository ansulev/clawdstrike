/**
 * ViewTabRenderer - Keep-alive renderer for plugin editor tabs.
 *
 * Renders ALL open plugin view tabs simultaneously, hiding inactive tabs
 * via `display: none` instead of unmounting. This preserves component state
 * (scroll position, form inputs, selections) across tab switches.
 *
 * When a tab is evicted by LRU (disappears from the store), its div is
 * removed from the DOM, causing React to unmount the component.
 */
import { useCallback, useMemo, Component, Suspense } from "react";
import type { ReactNode } from "react";
import { getView } from "@/lib/plugins/view-registry";
import type { ViewRegistration, ViewSlot } from "@/lib/plugins/view-registry";
import {
  usePluginViewTabs,
  useActivePluginViewTabId,
  setPluginViewTabTitle,
  setPluginViewTabDirty,
} from "@/lib/plugins/plugin-view-tab-store";
import type { PluginViewTab } from "@/lib/plugins/plugin-view-tab-store";

// ---------------------------------------------------------------------------
// Default no-op storage (matches view-container.tsx)
// ---------------------------------------------------------------------------

const NO_OP_STORAGE = {
  get: (_key: string): unknown => undefined,
  set: (_key: string, _value: unknown): void => {},
};

// ---------------------------------------------------------------------------
// EditorTabErrorFallback (internal)
// ---------------------------------------------------------------------------

function EditorTabErrorFallback({
  viewId,
  error,
  resetError,
}: {
  viewId: string;
  error: Error;
  resetError: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-4 h-full">
      <span className="text-[#c45c5c] text-sm font-medium">
        Plugin view crashed
      </span>
      <span className="text-[#6f7f9a] text-xs max-w-md truncate">
        {error.message}
      </span>
      <button
        onClick={resetError}
        className="text-[#d4a84b] text-xs hover:underline mt-1"
      >
        Reload View
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorTabErrorBoundary (class component)
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  viewId: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

class EditorTabErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo): void {
    // Error captured by getDerivedStateFromError. Could log externally.
  }

  private handleReset = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  render() {
    const { hasError, error, resetKey } = this.state;
    const { viewId, children } = this.props;

    if (hasError && error) {
      return (
        <EditorTabErrorFallback
          viewId={viewId}
          error={error}
          resetError={this.handleReset}
        />
      );
    }

    return <div key={resetKey}>{children}</div>;
  }
}

// ---------------------------------------------------------------------------
// EditorTabLoadingFallback (internal)
// ---------------------------------------------------------------------------

function EditorTabLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full">
      <div className="w-5 h-5 border-2 border-[#6f7f9a]/30 border-t-[#6f7f9a] rounded-full animate-spin" />
      <span className="text-[#6f7f9a] text-xs">Loading plugin view...</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PluginEditorTabBridge (internal)
// ---------------------------------------------------------------------------

function PluginEditorTabBridge({
  registration,
  viewId,
  isActive,
}: {
  registration: ViewRegistration;
  viewId: string;
  isActive: boolean;
}) {
  const handleSetTitle = useCallback(
    (title: string) => {
      setPluginViewTabTitle(viewId, title);
    },
    [viewId],
  );

  const handleSetDirty = useCallback(
    (dirty: boolean) => {
      setPluginViewTabDirty(viewId, dirty);
    },
    [viewId],
  );

  const PluginComponent = registration.component;

  return (
    <EditorTabErrorBoundary viewId={viewId}>
      <Suspense fallback={<EditorTabLoadingFallback />}>
        <PluginComponent
          viewId={viewId}
          isActive={isActive}
          storage={NO_OP_STORAGE}
          setTitle={handleSetTitle}
          setDirty={handleSetDirty}
        />
      </Suspense>
    </EditorTabErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// ViewTabRenderer (exported)
// ---------------------------------------------------------------------------

/**
 * Keep-alive renderer for plugin editor tabs.
 *
 * Renders a wrapper div for each open plugin view tab:
 * - Active tab: `display: block`
 * - Hidden tabs: `display: none` (preserves component state)
 *
 * Each plugin component receives full EditorTabProps:
 * viewId, isActive, storage, setTitle, setDirty
 */
export function ViewTabRenderer() {
  const tabs = usePluginViewTabs();
  const activeTabId = useActivePluginViewTabId();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <>
      {tabs.map((tab) => {
        const registration = getView(tab.viewId);
        if (!registration) {
          // Plugin may have been unloaded
          return null;
        }

        const isActive = tab.viewId === activeTabId;

        return (
          <div
            key={tab.viewId}
            data-plugin-tab-id={tab.viewId}
            className="h-full w-full"
            style={{ display: isActive ? "block" : "none" }}
          >
            <PluginEditorTabBridge
              registration={registration}
              viewId={tab.viewId}
              isActive={isActive}
            />
          </div>
        );
      })}
    </>
  );
}

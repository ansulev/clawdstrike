/**
 * ViewContainer - Wraps plugin-contributed views in ErrorBoundary + Suspense.
 *
 * Every plugin view renders through this component, ensuring:
 * 1. A crashing plugin view does not take down the workbench (ErrorBoundary)
 * 2. Lazy-loaded plugin components show an appropriate loading skeleton (Suspense)
 * 3. Slot-appropriate fallbacks (full-panel spinner vs. inline skeleton)
 */
import { Component, Suspense } from "react";
import type { ReactNode } from "react";
import type { ViewRegistration, ViewSlot } from "@/lib/plugins/view-registry";

// ---------------------------------------------------------------------------
// Default no-op storage
// ---------------------------------------------------------------------------

const NO_OP_STORAGE = {
  get: (_key: string): unknown => undefined,
  set: (_key: string, _value: unknown): void => {},
};

// ---------------------------------------------------------------------------
// ViewErrorFallback (internal)
// ---------------------------------------------------------------------------

function ViewErrorFallback({
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
// ViewErrorBoundary (class component)
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

class ViewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo): void {
    // Error is already captured via getDerivedStateFromError.
    // Could log to an external service here in the future.
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
        <ViewErrorFallback
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
// ViewLoadingFallback (internal)
// ---------------------------------------------------------------------------

function ViewLoadingFallback({ slotType }: { slotType: ViewSlot }) {
  if (slotType === "editorTab" || slotType === "activityBarPanel") {
    // Full height centered spinner with text
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full">
        <div className="w-5 h-5 border-2 border-[#6f7f9a]/30 border-t-[#6f7f9a] rounded-full animate-spin" />
        <span className="text-[#6f7f9a] text-xs">Loading plugin view...</span>
      </div>
    );
  }

  if (slotType === "statusBarWidget") {
    // Inline small spinner, no text
    return (
      <span className="inline-flex items-center">
        <span className="w-[10px] h-[10px] border border-[#6f7f9a]/30 border-t-[#6f7f9a] rounded-full animate-spin" />
      </span>
    );
  }

  // All others: medium spinner with short text
  return (
    <div className="flex items-center justify-center gap-2 p-3">
      <div className="w-4 h-4 border-2 border-[#6f7f9a]/30 border-t-[#6f7f9a] rounded-full animate-spin" />
      <span className="text-[#6f7f9a] text-xs">Loading...</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ViewContainer (exported)
// ---------------------------------------------------------------------------

interface ViewContainerProps {
  registration: ViewRegistration;
  isActive?: boolean;
  slotType?: ViewSlot;
  storage?: {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
  };
}

export function ViewContainer({
  registration,
  isActive = true,
  slotType,
  storage,
}: ViewContainerProps) {
  const effectiveSlotType = slotType ?? registration.slot;
  const effectiveStorage = storage ?? NO_OP_STORAGE;
  const PluginComponent = registration.component;

  return (
    <ViewErrorBoundary viewId={registration.id}>
      <Suspense fallback={<ViewLoadingFallback slotType={effectiveSlotType} />}>
        <PluginComponent
          viewId={registration.id}
          isActive={isActive}
          storage={effectiveStorage}
        />
      </Suspense>
    </ViewErrorBoundary>
  );
}

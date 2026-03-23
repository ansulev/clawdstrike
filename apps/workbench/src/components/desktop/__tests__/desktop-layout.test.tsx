import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DesktopLayout } from "../desktop-layout";

let hasDirtyBackgroundTabs = false;

vi.mock("@/lib/tauri-bridge", () => ({
  isDesktop: vi.fn(() => false),
  isMacOS: vi.fn(() => false),
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
}));

vi.mock("@/lib/commands/init-commands", () => ({
  InitCommands: () => null,
}));

vi.mock("@/features/policy/hooks/use-policy-actions", () => ({
  usePolicyTabs: () => ({
    tabs: hasDirtyBackgroundTabs ? [{ id: "dirty", dirty: true }] : [{ id: "clean", dirty: false }],
  }),
}));

vi.mock("@/lib/workbench/use-auto-save", () => ({
  useAutoSave: () => ({
    pendingRecovery: [],
    dismissRecovery: vi.fn(),
    restoreRecovery: vi.fn(),
  }),
}));

vi.mock("@/components/desktop/titlebar", () => ({
  Titlebar: () => (
    <header>
      <span>Clawdstrike</span>
      <span>Workbench</span>
    </header>
  ),
}));

vi.mock("@/features/activity-bar/components/activity-bar", () => ({
  ActivityBar: () => (
    <aside role="complementary">
      <span>Editor</span>
      <span>Lab</span>
    </aside>
  ),
}));

vi.mock("@/features/activity-bar/components/sidebar-panel", () => ({
  SidebarPanel: () => null,
}));

vi.mock("@/features/activity-bar/components/sidebar-resize-handle", () => ({
  SidebarResizeHandle: () => null,
}));

vi.mock("@/features/navigation/quick-open-dialog", () => ({
  QuickOpenDialog: () => null,
}));

vi.mock("@/features/right-sidebar/components/right-sidebar", () => ({
  RightSidebar: () => null,
}));

vi.mock("@/features/right-sidebar/components/right-sidebar-resize-handle", () => ({
  RightSidebarResizeHandle: () => null,
}));

vi.mock("@/features/right-sidebar/stores/right-sidebar-store", () => ({
  useRightSidebarStore: () => ({ visible: false }),
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => null,
}));

vi.mock("@/features/panes/pane-session", () => ({
  savePaneSession: vi.fn(),
  loadPaneSession: () => null,
}));

vi.mock("@/features/bottom-pane/bottom-pane-store", () => ({
  useBottomPaneStore: Object.assign(() => ({ isOpen: false, size: 30 }), {
    getState: () => ({ isOpen: false, activeTab: "terminal", setSize: vi.fn() }),
    subscribe: () => () => {},
  }),
}));

vi.mock("@/components/desktop/status-bar", () => ({
  StatusBar: () => <footer role="contentinfo">Status</footer>,
}));

vi.mock("@/components/desktop/shortcut-provider", () => ({
  ShortcutProvider: () => null,
}));

vi.mock("@/components/desktop/command-palette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/desktop/crash-recovery-banner", () => ({
  CrashRecoveryBanner: () => null,
}));

vi.mock("@/features/bottom-pane/bottom-pane", () => ({
  BottomPane: () => <div data-testid="bottom-pane">Bottom Pane</div>,
}));

vi.mock("@/features/panes/pane-root", () => ({
  PaneRoot: () => <div data-testid="pane-root">Pane Root</div>,
}));

afterEach(() => {
  hasDirtyBackgroundTabs = false;
  cleanup();
});

function renderLayout(route = "/editor", withDirtyBackgroundTab = false) {
  hasDirtyBackgroundTabs = withDirtyBackgroundTab;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <DesktopLayout />
    </MemoryRouter>,
  );
}

describe("DesktopLayout", () => {
  it("renders the titlebar", () => {
    renderLayout();

    // The titlebar renders a header with the brand name (split into two spans)
    expect(screen.getByText("Clawdstrike")).toBeInTheDocument();
    expect(screen.getByText("Workbench")).toBeInTheDocument();
  });

  it("renders the sidebar", () => {
    renderLayout();

    // Sidebar renders navigation items
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByText("Lab")).toBeInTheDocument();
  });

  it("renders the status bar", () => {
    renderLayout();

    // Status bar renders as a footer
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("renders the pane root", () => {
    renderLayout("/editor");

    expect(screen.getByTestId("pane-root")).toBeInTheDocument();
    expect(screen.getByText("Pane Root")).toBeInTheDocument();
  });

  it("keeps the pane root mounted across routes", () => {
    renderLayout("/simulator");

    expect(screen.getByTestId("pane-root")).toBeInTheDocument();
  });

  it("has a flex column layout structure", () => {
    renderLayout();

    // The root div should have flex flex-col
    const root = screen.getByText("Clawdstrike").closest("div.flex.flex-col");
    expect(root).toBeInTheDocument();
  });

  it("has a flex row section for sidebar + content", () => {
    renderLayout();

    // The sidebar and content area should be in a flex row container
    const sidebar = screen.getByRole("complementary");
    const flexRow = sidebar.parentElement;
    expect(flexRow).toBeInTheDocument();
    expect(flexRow!.className).toContain("flex");
    expect(flexRow!.className).toContain("flex-1");
  });

  it("warns before unload when a background tab is dirty", () => {
    renderLayout("/editor", true);

    const event = new Event("beforeunload", { cancelable: true });
    const preventDefault = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
  });
});

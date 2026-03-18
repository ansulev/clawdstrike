import type { PaneFocusDirection } from "@/features/panes/pane-types";
import { commandRegistry } from "@/lib/command-registry";
import type { Command } from "@/lib/command-registry";

export interface ViewCommandDeps {
  toggleShortcutHelp: () => void;
  splitVertical: () => void;
  splitHorizontal: () => void;
  closePane: () => void;
  focusPane: (direction: PaneFocusDirection) => void;
  hasMultiplePanes: () => boolean;
  toggleTerminal: () => void;
  toggleProblems: () => void;
  toggleOutput: () => void;
  newTerminal: () => Promise<void>;
  closeTerminal: () => Promise<void>;
  hasActiveTerminal: () => boolean;
  toggleSidebar: () => void;
  showExplorer: () => void;
}

export function registerViewCommands(deps: ViewCommandDeps): void {
  const commands: Command[] = [
    {
      id: "view.shortcuts",
      title: "Show Keyboard Shortcuts",
      category: "Help",
      keybinding: "Meta+/",
      context: "global",
      execute: () => deps.toggleShortcutHelp(),
    },
    {
      id: "view.splitVertical",
      title: "Split Pane Vertically",
      category: "View",
      keybinding: "Meta+\\",
      context: "pane",
      execute: () => deps.splitVertical(),
    },
    {
      id: "view.splitHorizontal",
      title: "Split Pane Horizontally",
      category: "View",
      keybinding: "Meta+Shift+\\",
      context: "pane",
      execute: () => deps.splitHorizontal(),
    },
    {
      id: "view.closePane",
      title: "Close Active Pane",
      category: "View",
      keybinding: "Meta+Shift+W",
      context: "pane",
      when: () => deps.hasMultiplePanes(),
      execute: () => deps.closePane(),
    },
    {
      id: "view.focusLeft",
      title: "Focus Left Pane",
      category: "View",
      keybinding: "Meta+Alt+ArrowLeft",
      context: "pane",
      when: () => deps.hasMultiplePanes(),
      execute: () => deps.focusPane("left"),
    },
    {
      id: "view.focusRight",
      title: "Focus Right Pane",
      category: "View",
      keybinding: "Meta+Alt+ArrowRight",
      context: "pane",
      when: () => deps.hasMultiplePanes(),
      execute: () => deps.focusPane("right"),
    },
    {
      id: "view.focusUp",
      title: "Focus Upper Pane",
      category: "View",
      keybinding: "Meta+Alt+ArrowUp",
      context: "pane",
      when: () => deps.hasMultiplePanes(),
      execute: () => deps.focusPane("up"),
    },
    {
      id: "view.focusDown",
      title: "Focus Lower Pane",
      category: "View",
      keybinding: "Meta+Alt+ArrowDown",
      context: "pane",
      when: () => deps.hasMultiplePanes(),
      execute: () => deps.focusPane("down"),
    },
    {
      id: "view.toggleTerminal",
      title: "Toggle Terminal Panel",
      category: "View",
      keybinding: "Meta+J",
      context: "global",
      execute: () => deps.toggleTerminal(),
    },
    {
      id: "view.toggleProblems",
      title: "Toggle Problems Panel",
      category: "View",
      keybinding: "Meta+Shift+M",
      context: "global",
      execute: () => deps.toggleProblems(),
    },
    {
      id: "view.toggleOutput",
      title: "Toggle Output Panel",
      category: "View",
      context: "global",
      execute: () => deps.toggleOutput(),
    },
    {
      id: "terminal.new",
      title: "New Terminal Session",
      category: "View",
      keybinding: "Meta+Shift+`",
      context: "global",
      execute: () => deps.newTerminal(),
    },
    {
      id: "terminal.close",
      title: "Close Active Terminal Session",
      category: "View",
      context: "terminal",
      when: () => deps.hasActiveTerminal(),
      execute: () => deps.closeTerminal(),
    },
    {
      id: "sidebar.toggle",
      title: "Toggle Sidebar",
      category: "View",
      keybinding: "Meta+B",
      context: "global",
      execute: () => deps.toggleSidebar(),
    },
    {
      id: "sidebar.explorer",
      title: "Show Explorer",
      category: "Sidebar",
      keybinding: "Meta+Shift+E",
      context: "global",
      execute: () => deps.showExplorer(),
    },
  ];

  commandRegistry.registerAll(commands);
}

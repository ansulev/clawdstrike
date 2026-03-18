import { commandRegistry } from "@/lib/command-registry";
import type { Command } from "@/lib/command-registry";
import { usePaneStore } from "@/features/panes/pane-store";

export function registerNavigateCommands(): void {
  const commands: Command[] = [
    // ---- Existing nav.* commands (openApp pattern) ----
    {
      id: "nav.home",
      title: "Home",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/home", "Home"),
    },
    {
      id: "nav.editor",
      title: "Policy Editor",
      category: "Navigate",
      keybinding: "Meta+1",
      execute: () => usePaneStore.getState().openApp("/editor", "Editor"),
    },
    {
      id: "nav.lab",
      title: "Lab",
      category: "Navigate",
      keybinding: "Meta+2",
      execute: () => usePaneStore.getState().openApp("/lab", "Lab"),
    },
    {
      id: "nav.sentinels",
      title: "Sentinels",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/sentinels", "Sentinels"),
    },
    {
      id: "nav.findings",
      title: "Findings & Intel",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/findings", "Findings"),
    },
    {
      id: "nav.fleet",
      title: "Fleet Dashboard",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/fleet", "Fleet"),
    },
    {
      id: "nav.approvals",
      title: "Approvals",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/approvals", "Approvals"),
    },
    {
      id: "nav.audit",
      title: "Audit Log",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/audit", "Audit"),
    },
    {
      id: "nav.compliance",
      title: "Compliance",
      category: "Navigate",
      keybinding: "Meta+3",
      execute: () =>
        usePaneStore.getState().openApp("/compliance", "Compliance"),
    },
    {
      id: "nav.receipts",
      title: "Receipts",
      category: "Navigate",
      keybinding: "Meta+4",
      execute: () => usePaneStore.getState().openApp("/receipts", "Receipts"),
    },
    {
      id: "nav.topology",
      title: "Topology",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/topology", "Topology"),
    },
    {
      id: "nav.swarms",
      title: "Swarms",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/swarms", "Swarms"),
    },
    {
      id: "nav.library",
      title: "Policy Library",
      category: "Navigate",
      keybinding: "Meta+5",
      execute: () => usePaneStore.getState().openApp("/library", "Library"),
    },
    {
      id: "nav.settings",
      title: "Settings",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/settings", "Settings"),
    },
    {
      id: "nav.missions",
      title: "Mission Control",
      category: "Navigate",
      execute: () =>
        usePaneStore.getState().openApp("/missions", "Mission Control"),
    },
    {
      id: "nav.simulator",
      title: "Threat Simulator",
      category: "Navigate",
      keybinding: "Meta+6",
      execute: () =>
        usePaneStore.getState().openApp("/simulator", "Simulator"),
    },

    // ---- New app.* commands (CMD-06) ----
    {
      id: "app.missions",
      title: "Open Mission Control",
      category: "Navigate",
      execute: () =>
        usePaneStore.getState().openApp("/missions", "Mission Control"),
    },
    {
      id: "app.approvals",
      title: "Open Approvals",
      category: "Navigate",
      execute: () =>
        usePaneStore.getState().openApp("/approvals", "Approvals"),
    },
    {
      id: "app.audit",
      title: "Open Audit Log",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/audit", "Audit"),
    },
    {
      id: "app.receipts",
      title: "Open Receipts",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/receipts", "Receipts"),
    },
    {
      id: "app.topology",
      title: "Open Topology",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/topology", "Topology"),
    },
    {
      id: "app.swarmBoard",
      title: "Open Swarm Board",
      category: "Navigate",
      execute: () =>
        usePaneStore.getState().openApp("/swarm-board", "Swarm Board"),
    },
    {
      id: "app.hunt",
      title: "Open Threat Hunt",
      category: "Navigate",
      execute: () => usePaneStore.getState().openApp("/hunt", "Hunt"),
    },
    {
      id: "app.simulator",
      title: "Open Simulator",
      category: "Navigate",
      execute: () =>
        usePaneStore.getState().openApp("/simulator", "Simulator"),
    },
  ];

  commandRegistry.registerAll(commands);
}

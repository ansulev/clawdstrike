import type { NavigateFunction } from "react-router-dom";
import { commandRegistry } from "@/lib/command-registry";
import type { Command } from "@/lib/command-registry";

export function registerNavigateCommands(navigate: NavigateFunction): void {
  const commands: Command[] = [
    {
      id: "nav.home",
      title: "Home",
      category: "Navigate",
      execute: () => navigate("/home"),
    },
    {
      id: "nav.editor",
      title: "Policy Editor",
      category: "Navigate",
      keybinding: "Meta+1",
      execute: () => navigate("/editor"),
    },
    {
      id: "nav.lab",
      title: "Lab",
      category: "Navigate",
      keybinding: "Meta+2",
      execute: () => navigate("/lab"),
    },
    {
      id: "nav.sentinels",
      title: "Sentinels",
      category: "Navigate",
      execute: () => navigate("/sentinels"),
    },
    {
      id: "nav.findings",
      title: "Findings & Intel",
      category: "Navigate",
      execute: () => navigate("/findings"),
    },
    {
      id: "nav.fleet",
      title: "Fleet Dashboard",
      category: "Navigate",
      execute: () => navigate("/fleet"),
    },
    {
      id: "nav.approvals",
      title: "Approvals",
      category: "Navigate",
      execute: () => navigate("/approvals"),
    },
    {
      id: "nav.audit",
      title: "Audit Log",
      category: "Navigate",
      execute: () => navigate("/audit"),
    },
    {
      id: "nav.compliance",
      title: "Compliance",
      category: "Navigate",
      keybinding: "Meta+3",
      execute: () => navigate("/compliance"),
    },
    {
      id: "nav.receipts",
      title: "Receipts",
      category: "Navigate",
      keybinding: "Meta+4",
      execute: () => navigate("/receipts"),
    },
    {
      id: "nav.topology",
      title: "Topology",
      category: "Navigate",
      execute: () => navigate("/topology"),
    },
    {
      id: "nav.swarms",
      title: "Swarms",
      category: "Navigate",
      execute: () => navigate("/swarms"),
    },
    {
      id: "nav.library",
      title: "Policy Library",
      category: "Navigate",
      keybinding: "Meta+5",
      execute: () => navigate("/library"),
    },
    {
      id: "nav.settings",
      title: "Settings",
      category: "Navigate",
      execute: () => navigate("/settings"),
    },
    {
      id: "nav.missions",
      title: "Mission Control",
      category: "Navigate",
      execute: () => navigate("/missions"),
    },
    {
      id: "nav.simulator",
      title: "Threat Simulator",
      category: "Navigate",
      keybinding: "Meta+6",
      execute: () => navigate("/simulator"),
    },
  ];

  commandRegistry.registerAll(commands);
}

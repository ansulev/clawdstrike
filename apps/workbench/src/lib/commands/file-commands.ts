import type { NavigateFunction } from "react-router-dom";
import { commandRegistry } from "@/lib/command-registry";
import type { Command } from "@/lib/command-registry";

export interface FileCommandDeps {
  navigate: NavigateFunction;
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  newPolicy: () => void;
  openFile: () => Promise<void>;
  exportYaml: () => void;
  copyYaml: () => void;
}

export function registerFileCommands(deps: FileCommandDeps): void {
  const { navigate, saveFile, saveFileAs, newPolicy, openFile, exportYaml, copyYaml } = deps;

  const commands: Command[] = [
    {
      id: "file.save",
      title: "Save",
      category: "File",
      keybinding: "Meta+S",
      context: "editor",
      execute: () => void saveFile(),
    },
    {
      id: "file.saveAs",
      title: "Save As",
      category: "File",
      keybinding: "Meta+Shift+S",
      context: "editor",
      execute: () => void saveFileAs(),
    },
    {
      id: "file.new",
      title: "New Policy",
      category: "File",
      keybinding: "Meta+N",
      execute: () => {
        newPolicy();
        navigate("/editor");
      },
    },
    {
      id: "file.open",
      title: "Open Detection File",
      category: "File",
      keybinding: "Meta+O",
      execute: async () => {
        await openFile();
        navigate("/editor");
      },
    },
    {
      id: "file.export",
      title: "Export Current Source",
      category: "File",
      keybinding: "Meta+E",
      context: "editor",
      execute: () => exportYaml(),
    },
    {
      id: "file.copySource",
      title: "Copy Current Source",
      category: "File",
      keybinding: "Meta+Shift+Y",
      context: "editor",
      execute: () => copyYaml(),
    },
  ];

  commandRegistry.registerAll(commands);
}

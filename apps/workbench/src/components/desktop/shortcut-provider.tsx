/**
 * ShortcutProvider — reads all commands with keybindings from the registry
 * and wires them to a single global keydown listener.
 *
 * The SHORTCUT_DEFINITIONS export is preserved (derived from the registry)
 * so that ShortcutHelpDialog continues to work unchanged.
 */
import { useEffect, useSyncExternalStore, useMemo } from "react";
import { useBottomPaneStore } from "@/features/bottom-pane/bottom-pane-store";
import { getActivePaneRoute, usePaneStore } from "@/features/panes/pane-store";
import {
  commandRegistry,
  type Command,
  type CommandContext,
} from "@/lib/command-registry";
import { normalizeWorkbenchRoute } from "./workbench-routes";

// ---- Keybinding parser ----

interface ParsedKeybinding {
  key: string;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

/**
 * Parse a keybinding string like "Meta+Shift+V" into a matcher object.
 */
function parseKeybinding(binding: string): ParsedKeybinding {
  const parts = binding.split("+");
  const key = parts[parts.length - 1].toLowerCase();
  const meta = parts.some((p) => p === "Meta");
  const shift = parts.some((p) => p === "Shift");
  const alt = parts.some((p) => p === "Alt");
  return { key, meta, shift, alt };
}

// ---- Shortcut definition type (for help dialog compatibility) ----

export interface ShortcutDefinition {
  key: string;
  meta: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: string;
}

function getCommandContexts(command: Command): CommandContext[] {
  if (!command.context) {
    return ["global"];
  }
  return Array.isArray(command.context) ? command.context : [command.context];
}

function resolveActiveShortcutContexts(target: EventTarget | null): Set<CommandContext> {
  const contexts = new Set<CommandContext>(["global"]);
  const element = target instanceof Element ? target : null;

  if (element?.closest('[data-shortcut-context="terminal"]')) {
    contexts.add("terminal");
    return contexts;
  }

  contexts.add("pane");

  const route = normalizeWorkbenchRoute(
    getActivePaneRoute(usePaneStore.getState().root, usePaneStore.getState().activePaneId),
  );
  if (route.startsWith("/editor")) {
    contexts.add("editor");
  }

  if (useBottomPaneStore.getState().isOpen && useBottomPaneStore.getState().activeTab === "terminal") {
    const activeElement = document.activeElement;
    if (activeElement instanceof Element && activeElement.closest('[data-shortcut-context="terminal"]')) {
      contexts.add("terminal");
      contexts.delete("pane");
      contexts.delete("editor");
    }
  }

  return contexts;
}

function commandMatchesShortcutContext(command: Command, target: EventTarget | null): boolean {
  const activeContexts = resolveActiveShortcutContexts(target);
  return getCommandContexts(command).some((context) => activeContexts.has(context));
}

/**
 * Derive SHORTCUT_DEFINITIONS from the current registry snapshot.
 * This is exported so ShortcutHelpDialog can import it.
 *
 * Note: since this is derived dynamically, the help dialog must live inside
 * the ShortcutProvider tree (which it already does via InitCommands).
 */
export function getShortcutDefinitions(): ShortcutDefinition[] {
  return commandRegistry
    .getAll()
    .filter((cmd): cmd is Command & { keybinding: string } => !!cmd.keybinding)
    .map((cmd) => {
      const parsed = parseKeybinding(cmd.keybinding);
      return {
        key: parsed.key,
        meta: parsed.meta,
        shift: parsed.shift || undefined,
        alt: parsed.alt || undefined,
        description: cmd.title,
        category: cmd.category,
      };
    });
}

// SHORTCUT_DEFINITIONS removed — was always empty at module load time
// (registry not populated yet). Use getShortcutDefinitions() for live data.

// ---- Component ----

/**
 * Registers a single global keydown listener that dispatches to command.execute()
 * for any command whose keybinding matches the pressed keys.
 *
 * Renders nothing — visual output (ShortcutHelpDialog) is now handled
 * by InitCommands which manages the dialog open/close state.
 */
export function ShortcutProvider() {
  // Subscribe to registry changes so the keydown handler always has fresh commands.
  const registryVersion = useSyncExternalStore(
    (cb) => commandRegistry.subscribe(cb),
    () => commandRegistry.getVersion(),
  );

  // Build sorted bindings: shift-modified entries first for same key (so Meta+Shift+Z
  // matches before Meta+Z).
  const bindings = useMemo(() => {
    const all = commandRegistry.getAll();
    const withBindings = all
      .filter((cmd): cmd is Command & { keybinding: string } => !!cmd.keybinding)
      .map((cmd) => ({
        cmd,
        parsed: parseKeybinding(cmd.keybinding),
      }));

    // Sort: shift=true entries first for same key, so Shift variants match before non-Shift
    withBindings.sort((a, b) => {
      if (a.parsed.key === b.parsed.key) {
        return (b.parsed.shift ? 1 : 0) - (a.parsed.shift ? 1 : 0);
      }
      return 0;
    });

    return withBindings;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryVersion]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const modifierPressed = e.metaKey || e.ctrlKey;

      for (const { cmd, parsed } of bindings) {
        if (!commandMatchesShortcutContext(cmd, e.target)) {
          continue;
        }

        const keyMatches = e.key.toLowerCase() === parsed.key;
        const metaMatches = parsed.meta ? modifierPressed : !modifierPressed;
        const shiftMatches = parsed.shift ? e.shiftKey : !e.shiftKey;
        const altMatches = parsed.alt ? e.altKey : !e.altKey;

        if (keyMatches && metaMatches && shiftMatches && altMatches) {
          e.preventDefault();
          e.stopPropagation();
          void commandRegistry.execute(cmd.id);
          return;
        }
      }

      // Handle Cmd+Shift+/ which produces "?" as e.key on many keyboards
      // Match it to the Meta+/ binding (shortcuts help)
      if (modifierPressed && e.shiftKey && e.key === "?") {
        const slashCmd = bindings.find(
          (binding) =>
            binding.parsed.key === "/" &&
            commandMatchesShortcutContext(binding.cmd, e.target),
        );
        if (slashCmd) {
          e.preventDefault();
          e.stopPropagation();
          void commandRegistry.execute(slashCmd.cmd.id);
        }
      }
    }

    window.addEventListener("keydown", handleKeydown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeydown, { capture: true });
    };
  }, [bindings]);

  // ShortcutHelpDialog is now rendered by InitCommands.
  return null;
}

import { IconPlus, IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import { TerminalRenderer } from "@/components/workbench/swarm-board/terminal-renderer";
import { cn } from "@/lib/utils";
import { useBottomPaneStore } from "./bottom-pane-store";

export function TerminalPanel() {
  const terminalSessions = useBottomPaneStore((state) => state.terminalSessions);
  const activeTerminalId = useBottomPaneStore((state) => state.activeTerminalId);

  useEffect(() => {
    if (terminalSessions.length === 0) {
      void useBottomPaneStore.getState().newTerminal();
    }
  }, [terminalSessions.length]);

  const activeSession =
    terminalSessions.find((session) => session.id === activeTerminalId)
    ?? terminalSessions[0]
    ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col" data-shortcut-context="terminal">
      <div className="flex items-center gap-1 border-b border-[#202531] px-2 py-2">
        {terminalSessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              "flex items-center rounded-md text-[11px] transition-colors",
              session.id === activeSession?.id
                ? "bg-[#131721] text-[#ece7dc]"
                : "text-[#6f7f9a] hover:bg-[#0f1219] hover:text-[#ece7dc]",
            )}
          >
            <button
              type="button"
              className="px-2.5 py-1"
              onClick={() => useBottomPaneStore.getState().setActiveTerminal(session.id)}
            >
              {session.title}
            </button>
            <button
              type="button"
              className="rounded-r-md px-1.5 py-1 text-[#6f7f9a] transition-colors hover:bg-[#2a1115] hover:text-[#ffb8b8]"
              onClick={() => void useBottomPaneStore.getState().closeTerminal(session.id)}
              aria-label={`Close ${session.title}`}
            >
              <IconX size={11} stroke={1.8} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ml-1 rounded-md p-1.5 text-[#6f7f9a] transition-colors hover:bg-[#0f1219] hover:text-[#ece7dc]"
          onClick={() => void useBottomPaneStore.getState().newTerminal()}
          aria-label="New terminal session"
        >
          <IconPlus size={13} stroke={1.8} />
        </button>
      </div>

      <div className="min-h-0 flex-1 bg-[#06080d]">
        {!activeSession ? null : activeSession.ptySessionId ? (
          <TerminalRenderer sessionId={activeSession.ptySessionId} active width={800} height={240} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-[#6f7f9a]">
            {activeSession.error ?? "Terminal unavailable in this environment."}
          </div>
        )}
      </div>
    </div>
  );
}

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTerminalSessions } from "../use-terminal-sessions";

const mockSpawnSession = vi.fn();
const mockSpawnClaudeSession = vi.fn();
const mockSpawnWorktreeSession = vi.fn();
const mockKillSession = vi.fn();
const mockRemoveNode = vi.fn();
const mockSpawnEngineSession = vi.fn();
const mockSpawnEngineClaudeSession = vi.fn();
const mockSpawnEngineWorktreeSession = vi.fn();

vi.mock("../swarm-board-store", () => ({
  MAX_ACTIVE_TERMINALS: 8,
  useSwarmBoard: () => ({
    state: {
      repoRoot: "/repo",
      nodes: [],
    },
    spawnSession: mockSpawnSession,
    spawnClaudeSession: mockSpawnClaudeSession,
    spawnWorktreeSession: mockSpawnWorktreeSession,
    killSession: mockKillSession,
    removeNode: mockRemoveNode,
  }),
}));

vi.mock("@/features/swarm/stores/swarm-engine-provider", () => ({
  useOptionalSwarmEngine: () => ({
    mode: "engine",
    spawnEngineSession: mockSpawnEngineSession,
    spawnEngineClaudeSession: mockSpawnEngineClaudeSession,
    spawnEngineWorktreeSession: mockSpawnEngineWorktreeSession,
  }),
}));

describe("useTerminalSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes terminal session spawns through the engine wrapper when engine mode is enabled", async () => {
    mockSpawnEngineSession.mockResolvedValue({ id: "node_terminal" });

    const { result } = renderHook(() => useTerminalSessions());
    await result.current.spawnSession({ cwd: "/repo", title: "Terminal" });

    expect(mockSpawnEngineSession).toHaveBeenCalledWith(
      mockSpawnSession,
      expect.objectContaining({ cwd: "/repo", title: "Terminal" }),
    );
    expect(mockSpawnSession).not.toHaveBeenCalled();
  });

  it("routes Claude and worktree spawns through the engine wrapper when engine mode is enabled", async () => {
    mockSpawnEngineClaudeSession.mockResolvedValue({ id: "node_claude" });
    mockSpawnEngineWorktreeSession.mockResolvedValue({ id: "node_worktree" });

    const { result } = renderHook(() => useTerminalSessions());
    await result.current.spawnClaudeSession({ prompt: "review" });
    await result.current.spawnWorktreeSession({ branch: "feat/test" });

    expect(mockSpawnEngineClaudeSession).toHaveBeenCalledWith(
      mockSpawnClaudeSession,
      expect.objectContaining({ prompt: "review" }),
    );
    expect(mockSpawnEngineWorktreeSession).toHaveBeenCalledWith(
      mockSpawnWorktreeSession,
      expect.objectContaining({ branch: "feat/test" }),
    );
    expect(mockSpawnClaudeSession).not.toHaveBeenCalled();
    expect(mockSpawnWorktreeSession).not.toHaveBeenCalled();
  });
});

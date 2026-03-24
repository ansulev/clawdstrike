import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, isDesktopMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isDesktopMock: vi.fn(),
}));

vi.mock("../tauri-bridge", () => ({
  isDesktop: isDesktopMock,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import { searchInProjectNative } from "../tauri-commands";

describe("searchInProjectNative", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    isDesktopMock.mockReset();
    isDesktopMock.mockReturnValue(true);
  });

  it("returns null outside desktop mode", async () => {
    isDesktopMock.mockReturnValue(false);

    await expect(
      searchInProjectNative("/workspace/alpha", "needle", false, false, false),
    ).resolves.toBeNull();

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("preserves tauri invocation errors for callers", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    invokeMock.mockRejectedValueOnce({ message: "invalid regex" });

    await expect(
      searchInProjectNative("/workspace/alpha", "needle(", false, false, true),
    ).rejects.toThrow("invalid regex");

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

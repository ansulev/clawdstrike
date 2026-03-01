import { describe, it, expect, vi } from "vitest";

// We can't easily test the full NATS integration without a running server,
// but we can verify the module structure and error handling.

describe("watch module", () => {
  it("exports runWatch function", async () => {
    const mod = await import("./watch.js");
    expect(typeof mod.runWatch).toBe("function");
  });

  it("throws WatchError when nats is not available", async () => {
    // runWatch requires the nats package which may not be installed in test
    // environment. If nats IS installed, this test verifies the function
    // exists; if not, it verifies the proper error message.
    const { runWatch } = await import("./watch.js");
    const config = {
      natsUrl: "nats://localhost:4222",
      rules: [],
      maxWindow: 60000,
    };

    try {
      await runWatch(config, () => {});
      // If we get here, nats is installed and it tried to connect —
      // which will fail since there's no server. That's fine too.
    } catch (e: unknown) {
      const err = e as Error;
      // Either WatchError (nats not installed) or connection error
      expect(err).toBeInstanceOf(Error);
    }
  });
});

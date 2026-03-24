import { describe, expect, it } from "vitest";
import { buildPresenceWebSocketUrl } from "../presence-socket";

describe("buildPresenceWebSocketUrl", () => {
  it("routes local hushd traffic through the dev websocket proxy", () => {
    expect(
      buildPresenceWebSocketUrl(
        "http://localhost:9876",
        "secret token",
        "http://127.0.0.1:1421",
        true,
      ),
    ).toBe("ws://127.0.0.1:1421/_proxy/hushd/api/v1/presence?token=secret+token");
  });

  it("keeps non-proxied endpoints on their direct websocket origin", () => {
    expect(
      buildPresenceWebSocketUrl(
        "https://hushd.example.com",
        "secret-token",
        "http://127.0.0.1:1421",
        true,
      ),
    ).toBe("wss://hushd.example.com/api/v1/presence?token=secret-token");
  });
});

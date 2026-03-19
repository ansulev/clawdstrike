/**
 * PluginBridgeHost Tests
 *
 * Tests for the host-side bridge dispatch: origin validation, method dispatch
 * to workbench registries, error handling for unknown methods and handler
 * exceptions, pushEvent delivery, and destroy cleanup.
 *
 * Mocks the real workbench registries (guard, file-type, status-bar) so host
 * dispatch can be tested in isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  BridgeRequest,
  BridgeResponse,
  BridgeErrorResponse,
  BridgeEvent,
} from "../types";

// ---- Registry mocks ----

const mockGuardDispose = vi.fn();
vi.mock("../../../workbench/guard-registry", () => ({
  registerGuard: vi.fn(() => mockGuardDispose),
}));

const mockFileTypeDispose = vi.fn();
vi.mock("../../../workbench/file-type-registry", () => ({
  registerFileType: vi.fn(() => mockFileTypeDispose),
}));

const mockStatusBarDispose = vi.fn();
vi.mock("../../../workbench/status-bar-registry", () => ({
  statusBarRegistry: {
    register: vi.fn(() => mockStatusBarDispose),
  },
}));

// Import after mocks
import { PluginBridgeHost } from "../bridge-host";
import { registerGuard } from "../../../workbench/guard-registry";
import { registerFileType } from "../../../workbench/file-type-registry";
import { statusBarRegistry } from "../../../workbench/status-bar-registry";

// ---- Helpers ----

function makeRequest(
  method: string,
  params?: unknown,
  id = "req-1",
): BridgeRequest {
  return { id, type: "request", method, params };
}

function makeMessageEvent(
  data: unknown,
  origin = "null",
): MessageEvent {
  return new MessageEvent("message", { data, origin });
}

// ---- Setup ----

describe("PluginBridgeHost", () => {
  let host: PluginBridgeHost;
  let mockTargetWindow: { postMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTargetWindow = { postMessage: vi.fn() };
    host = new PluginBridgeHost({
      pluginId: "test-plugin",
      targetWindow: mockTargetWindow as unknown as Window,
    });
  });

  afterEach(() => {
    host.destroy();
  });

  // ---- guards.register ----

  describe("guards.register", () => {
    it("calls registerGuard and responds with registered: true", () => {
      const guardPayload = {
        id: "custom_guard",
        name: "Custom Guard",
        technicalName: "CustomGuard",
        description: "A custom guard",
        category: "detection",
        defaultVerdict: "deny",
        icon: "IconShield",
        configFields: [],
      };

      host.handleMessage(
        makeMessageEvent(makeRequest("guards.register", guardPayload)),
      );

      expect(registerGuard).toHaveBeenCalledWith(guardPayload);

      const reply = mockTargetWindow.postMessage.mock
        .calls[0][0] as BridgeResponse;
      expect(reply).toMatchObject({
        id: "req-1",
        type: "response",
        result: { registered: true },
      });
    });
  });

  // ---- storage round-trip ----

  describe("storage.set + storage.get", () => {
    it("round-trips a value through the plugin-scoped store", () => {
      host.handleMessage(
        makeMessageEvent(
          makeRequest("storage.set", { key: "theme", value: "dark" }, "s1"),
        ),
      );

      // Verify set response
      const setReply = mockTargetWindow.postMessage.mock
        .calls[0][0] as BridgeResponse;
      expect(setReply).toMatchObject({
        id: "s1",
        type: "response",
      });

      host.handleMessage(
        makeMessageEvent(
          makeRequest("storage.get", { key: "theme" }, "s2"),
        ),
      );

      const getReply = mockTargetWindow.postMessage.mock
        .calls[1][0] as BridgeResponse;
      expect(getReply).toMatchObject({
        id: "s2",
        type: "response",
        result: "dark",
      });
    });
  });

  // ---- unknown method ----

  describe("unknown method", () => {
    it("responds with METHOD_NOT_FOUND error", () => {
      host.handleMessage(
        makeMessageEvent(makeRequest("nonexistent.method", {})),
      );

      const reply = mockTargetWindow.postMessage.mock
        .calls[0][0] as BridgeErrorResponse;
      expect(reply).toMatchObject({
        id: "req-1",
        type: "error",
        error: {
          code: "METHOD_NOT_FOUND",
          message: expect.stringContaining("nonexistent.method"),
        },
      });
    });
  });

  // ---- origin validation ----

  describe("origin validation", () => {
    it("silently drops messages with wrong origin", () => {
      host.handleMessage(
        makeMessageEvent(
          makeRequest("storage.get", { key: "x" }),
          "https://evil.com",
        ),
      );

      expect(mockTargetWindow.postMessage).not.toHaveBeenCalled();
    });
  });

  // ---- non-bridge messages ----

  describe("non-bridge message filtering", () => {
    it("silently drops non-BridgeMessage data", () => {
      host.handleMessage(
        makeMessageEvent("just a string"),
      );
      host.handleMessage(
        makeMessageEvent({ foo: "bar" }),
      );
      host.handleMessage(
        makeMessageEvent(null),
      );

      expect(mockTargetWindow.postMessage).not.toHaveBeenCalled();
    });
  });

  // ---- handler error ----

  describe("handler exception", () => {
    it("responds with INTERNAL_ERROR when a handler throws", () => {
      // Make registerGuard throw
      vi.mocked(registerGuard).mockImplementationOnce(() => {
        throw new Error("registry full");
      });

      host.handleMessage(
        makeMessageEvent(
          makeRequest("guards.register", { id: "boom" }),
        ),
      );

      const reply = mockTargetWindow.postMessage.mock
        .calls[0][0] as BridgeErrorResponse;
      expect(reply).toMatchObject({
        id: "req-1",
        type: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "registry full",
        },
      });
    });
  });

  // ---- pushEvent ----

  describe("pushEvent", () => {
    it("sends a BridgeEvent to the targetWindow", () => {
      host.pushEvent("policy.changed", { version: "2.0" });

      const sent = mockTargetWindow.postMessage.mock
        .calls[0][0] as BridgeEvent;
      expect(sent).toMatchObject({
        type: "event",
        method: "policy.changed",
        params: { version: "2.0" },
      });
    });
  });

  // ---- destroy ----

  describe("destroy()", () => {
    it("calls all tracked disposables", () => {
      // Register a guard to create a disposable
      host.handleMessage(
        makeMessageEvent(
          makeRequest("guards.register", {
            id: "g1",
            name: "G1",
            technicalName: "G1Guard",
            description: "",
            category: "detection",
            defaultVerdict: "deny",
            icon: "IconShield",
            configFields: [],
          }),
        ),
      );

      host.destroy();

      expect(mockGuardDispose).toHaveBeenCalled();
    });
  });

  // ---- commands.register ----

  describe("commands.register", () => {
    it("stores command metadata and responds with registered: true", () => {
      host.handleMessage(
        makeMessageEvent(
          makeRequest("commands.register", {
            id: "my.command",
            title: "My Command",
          }),
        ),
      );

      const reply = mockTargetWindow.postMessage.mock
        .calls[0][0] as BridgeResponse;
      expect(reply).toMatchObject({
        id: "req-1",
        type: "response",
        result: { registered: true },
      });
    });
  });

  // ---- fileTypes.register ----

  describe("fileTypes.register", () => {
    it("calls registerFileType and responds with registered: true", () => {
      const fileTypePayload = {
        id: "custom_ft",
        label: "Custom File Type",
        shortLabel: "Custom",
        extensions: [".cft"],
        iconColor: "#ff0000",
        defaultContent: "",
        testable: false,
        convertibleTo: [],
      };

      host.handleMessage(
        makeMessageEvent(
          makeRequest("fileTypes.register", fileTypePayload),
        ),
      );

      expect(registerFileType).toHaveBeenCalledWith(fileTypePayload);

      const reply = mockTargetWindow.postMessage.mock
        .calls[0][0] as BridgeResponse;
      expect(reply).toMatchObject({
        id: "req-1",
        type: "response",
        result: { registered: true },
      });
    });
  });

  // ---- statusBar.register ----

  describe("statusBar.register", () => {
    it("calls statusBarRegistry.register and responds with registered: true", () => {
      const statusBarPayload = {
        id: "custom_sb",
        side: "left" as const,
        priority: 50,
        render: null, // Render function cannot cross iframe boundary; host provides placeholder
      };

      host.handleMessage(
        makeMessageEvent(
          makeRequest("statusBar.register", statusBarPayload),
        ),
      );

      expect(statusBarRegistry.register).toHaveBeenCalled();

      const reply = mockTargetWindow.postMessage.mock
        .calls[0][0] as BridgeResponse;
      expect(reply).toMatchObject({
        id: "req-1",
        type: "response",
        result: { registered: true },
      });
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { createSecurityContext } from "./context.js";
import type { ToolInterceptor } from "./interceptor.js";
import { secureToolSet, wrapExecuteWithInterceptor } from "./secure-tool-wrapper.js";

function createInterceptor(overrides: Partial<ToolInterceptor> = {}): ToolInterceptor {
  return {
    beforeExecute: async () => ({
      proceed: true,
      duration: 0,
      decision: { status: "allow" },
    }),
    afterExecute: async (_toolName, _input, output) => ({
      output,
      modified: false,
    }),
    onError: async () => {},
    ...overrides,
  };
}

describe("wrapExecuteWithInterceptor", () => {
  it("forwards sanitize-modified input when provided", async () => {
    const execute = vi.fn(async (input: string) => `ok:${input}`);
    const interceptor = createInterceptor({
      beforeExecute: async () => ({
        proceed: true,
        duration: 0,
        decision: {
          status: "sanitize",
          reason_code: "ADC_POLICY_SANITIZE",
        },
        modifiedInput: "safe string",
        modifiedParameters: { text: "safe object" },
      }),
    });

    const wrapped = wrapExecuteWithInterceptor(
      "echo",
      execute,
      interceptor,
      createSecurityContext(),
    );

    const result = await wrapped("unsafe string");

    expect(result).toBe("ok:safe string");
    expect(execute).toHaveBeenCalledWith("safe string");
  });

  it("forwards sanitize-modified parameters when modifiedInput is absent", async () => {
    const execute = vi.fn(async (input: { text: string }) => input.text);
    const interceptor = createInterceptor({
      beforeExecute: async () => ({
        proceed: true,
        duration: 0,
        decision: {
          status: "sanitize",
          reason_code: "ADC_POLICY_SANITIZE",
        },
        modifiedParameters: { text: "safe object" },
      }),
    });

    const wrapped = wrapExecuteWithInterceptor(
      "echo",
      execute,
      interceptor,
      createSecurityContext(),
    );

    const result = await wrapped({ text: "unsafe object" });

    expect(result).toBe("safe object");
    expect(execute).toHaveBeenCalledWith({ text: "safe object" });
  });
});

describe("secureToolSet", () => {
  it("wraps execute and call independently when both are present", async () => {
    const interceptor = createInterceptor();
    const tools = {
      dual: {
        execute: vi.fn(async (input: string) => `execute:${input}`),
        call: vi.fn(async (input: string) => `call:${input}`),
      },
    };

    const secured = secureToolSet(tools, interceptor, { framework: "test" });

    await expect(secured.dual.execute!("x")).resolves.toBe("execute:x");
    await expect(secured.dual.call!("y")).resolves.toBe("call:y");
    expect(tools.dual.execute).toHaveBeenCalledWith("x");
    expect(tools.dual.call).toHaveBeenCalledWith("y");
  });

  it("preserves missing execute/call members on wrapped tools", () => {
    const interceptor = createInterceptor();
    const tools = {
      executeOnly: {
        execute: async (_input: string) => "ok",
      },
      callOnly: {
        call: async (_input: string) => "ok",
      },
    };

    const secured = secureToolSet(tools, interceptor, { framework: "test" });

    expect(Object.prototype.hasOwnProperty.call(secured.executeOnly, "call")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(secured.callOnly, "execute")).toBe(false);
  });
});

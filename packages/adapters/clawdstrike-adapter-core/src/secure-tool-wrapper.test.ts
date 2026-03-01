import { describe, expect, it, vi } from "vitest";
import { createSecurityContext } from "./context.js";
import type { ToolInterceptor } from "./interceptor.js";
import { wrapExecuteWithInterceptor } from "./secure-tool-wrapper.js";

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

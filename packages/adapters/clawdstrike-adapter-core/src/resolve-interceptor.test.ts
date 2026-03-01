import { describe, expect, it, vi } from "vitest";

import type { AdapterConfig } from "./adapter.js";
import { BaseToolInterceptor } from "./base-tool-interceptor.js";
import { resolveInterceptor } from "./resolve-interceptor.js";

describe("resolveInterceptor", () => {
  it("returns ToolInterceptor inputs unchanged", () => {
    const interceptor = {
      beforeExecute: vi.fn(async () => ({
        proceed: true,
        decision: { status: "allow" as const },
        duration: 0,
      })),
      afterExecute: vi.fn(async (_tool, _input, output) => ({ output, modified: false })),
      onError: vi.fn(async () => undefined),
    };

    expect(resolveInterceptor(interceptor)).toBe(interceptor);
  });

  it("passes AdapterConfig through to ClawdstrikeLike.createInterceptor", () => {
    const config: AdapterConfig = {
      translateToolCall: vi.fn(() => null),
    };

    const created = {
      beforeExecute: vi.fn(async () => ({
        proceed: true,
        decision: { status: "allow" as const },
        duration: 0,
      })),
      afterExecute: vi.fn(async (_tool, _input, output) => ({ output, modified: false })),
      onError: vi.fn(async () => undefined),
    };
    const createInterceptor = vi.fn(() => created);

    const resolved = resolveInterceptor({ createInterceptor }, config);
    expect(resolved.beforeExecute).toBe(created.beforeExecute);
    expect(resolved.afterExecute).toBe(created.afterExecute);
    expect(resolved.onError).toBe(created.onError);
    expect(createInterceptor).toHaveBeenCalledWith(config);
  });

  it("adds a no-op onError for legacy createInterceptor outputs", async () => {
    const resolved = resolveInterceptor({
      createInterceptor: () => ({
        beforeExecute: async () => ({
          proceed: true,
          decision: { status: "allow" as const },
          duration: 0,
        }),
        afterExecute: async (_tool, _input, output) => ({ output, modified: false }),
      }),
    });

    await expect(resolved.onError("tool", {}, new Error("x"), {} as never)).resolves.toBeUndefined();
  });

  it("wraps PolicyEngineLike inputs in BaseToolInterceptor", () => {
    const engine = {
      evaluate: vi.fn(async () => ({ status: "allow" as const })),
    };

    const resolved = resolveInterceptor(engine);
    expect(resolved).toBeInstanceOf(BaseToolInterceptor);
  });
});

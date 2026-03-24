import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// ResizeObserver polyfill for jsdom — prevents "ResizeObserver is not defined"
// crashes in any test that renders components using ResizablePanelGroup.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}

function createStorageMock(): Storage {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

Object.defineProperty(globalThis, "localStorage", {
  value: createStorageMock(),
  configurable: true,
});

beforeEach(() => {
  globalThis.localStorage.clear();
});

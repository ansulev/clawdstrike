import { describe, expect, it } from "vitest";
import { getTrackedPresenceFilePath } from "../use-presence-file-tracking";

describe("getTrackedPresenceFilePath", () => {
  it("ignores draft file routes by prefix only", () => {
    expect(getTrackedPresenceFilePath("/file/__new__/draft-1")).toBeNull();
  });

  it("keeps real file paths that happen to contain __new__", () => {
    expect(getTrackedPresenceFilePath("/file/rules/__new__/policy.yaml")).toBe(
      "rules/__new__/policy.yaml",
    );
  });
});

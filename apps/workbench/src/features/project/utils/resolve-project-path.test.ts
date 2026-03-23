import { describe, expect, it } from "vitest";
import {
  deriveSearchRootPath,
  getProjectPathDirname,
  replaceProjectPathBasename,
  resolveProjectPath,
  stripProjectRoot,
} from "./resolve-project-path";

describe("resolve-project-path", () => {
  it("derives a real search root from absolute workspace file paths", () => {
    expect(
      deriveSearchRootPath("workspace", [
        "/repo/policies/example.yml",
        "/repo/rules/detections.yml",
      ]),
    ).toBe("/repo");
  });

  it("preserves Windows absolute paths when replacing a file basename", () => {
    expect(
      replaceProjectPathBasename("C:\\repo\\rules\\example.yml", "renamed.yml"),
    ).toBe("C:\\repo\\rules\\renamed.yml");
  });

  it("returns a parent directory for mixed-separator paths", () => {
    expect(getProjectPathDirname("rules/example.yml")).toBe("rules");
    expect(getProjectPathDirname("C:\\repo\\rules\\example.yml")).toBe("C:\\repo\\rules");
  });

  it("normalizes relative paths when stripping the project root", () => {
    expect(
      stripProjectRoot("C:\\repo", "C:\\repo\\rules\\example.yml"),
    ).toBe("rules/example.yml");
  });

  it("resolves relative project paths against Windows roots", () => {
    expect(
      resolveProjectPath("C:\\repo", "rules/example.yml"),
    ).toBe("C:\\repo\\rules\\example.yml");
  });
});

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const distAssetsDir = join(process.cwd(), "dist/assets");
const runSmoke = existsSync(distAssetsDir);
const describeIfBuild = runSmoke ? describe : describe.skip;

function findAssetByPrefix(prefix: string) {
  const assetName = readdirSync(distAssetsDir).find((entry) => entry.startsWith(prefix));
  if (!assetName) {
    throw new Error(`Could not find a built asset with prefix "${prefix}" in ${distAssetsDir}`);
  }

  return join(distAssetsDir, assetName);
}

describeIfBuild("observatory bundle graph smoke", () => {
  it("keeps vendor-physics off the eager ObservatoryWorldCanvas path", () => {
    const worldCanvasAsset = readFileSync(findAssetByPrefix("ObservatoryWorldCanvas-"), "utf8");
    expect(worldCanvasAsset).not.toContain("vendor-physics");
    expect(worldCanvasAsset).toContain("ObservatoryFlowRuntimeScene");
  });

  it("retains vendor-physics behind the lazy flow runtime edge", () => {
    const flowRuntimeAsset = readFileSync(findAssetByPrefix("ObservatoryFlowRuntimeScene-"), "utf8");
    expect(flowRuntimeAsset).toContain("vendor-physics");
    expect(flowRuntimeAsset).toContain("ObservatoryFlowPhysicsBootstrap");
  });
});

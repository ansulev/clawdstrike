import type { NavigateFunction } from "react-router-dom";
import type React from "react";
import { commandRegistry } from "@/lib/command-registry";
import type { Command } from "@/lib/command-registry";
import type { WorkbenchAction } from "@/features/policy/stores/policy-store";
import type { WorkbenchPolicy } from "@/lib/workbench/types";
import type { PolicyTab } from "@/features/policy/stores/multi-policy-store";
import { isDesktop } from "@/lib/tauri-bridge";
import { isPolicyFileType } from "@/lib/workbench/file-type-registry";
import { policyToYaml } from "@/features/policy/yaml-utils";
import { triggerNativeValidation } from "@/features/policy/use-native-validation";

export interface PolicyCommandDeps {
  navigate: NavigateFunction;
  dispatch: React.Dispatch<WorkbenchAction>;
  getActiveTab: () => PolicyTab | undefined;
  getActivePolicy: () => WorkbenchPolicy;
  getYaml: () => string;
  getDirty: () => boolean;
}

export function registerPolicyCommands(deps: PolicyCommandDeps): void {
  const { navigate, dispatch, getActiveTab, getActivePolicy, getYaml, getDirty } = deps;

  const commands: Command[] = [
    {
      id: "policy.validate",
      title: "Validate Current File",
      category: "Policy",
      keybinding: "Meta+Shift+V",
      context: "editor",
      execute: () => {
        const tab = getActiveTab();
        if (!tab) return;

        const source = isPolicyFileType(tab.fileType)
          ? policyToYaml(getActivePolicy())
          : getYaml();

        const shouldSyncYaml =
          isPolicyFileType(tab.fileType) && (getDirty() || source !== getYaml());

        if (shouldSyncYaml) {
          dispatch({ type: "SET_YAML", yaml: source });
        }

        if (isDesktop()) {
          void triggerNativeValidation(tab.fileType, source, dispatch);
        }

        navigate("/editor");
      },
    },
    {
      id: "policy.createSentinel",
      title: "Create Sentinel",
      category: "Sentinel",
      execute: () => navigate("/sentinels/create"),
    },
    {
      id: "policy.connectFleet",
      title: "Connect to Fleet",
      category: "Fleet",
      execute: () => navigate("/settings"),
    },
  ];

  commandRegistry.registerAll(commands);
}

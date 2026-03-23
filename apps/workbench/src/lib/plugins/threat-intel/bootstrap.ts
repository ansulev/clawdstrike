/**
 * Threat Intel Plugin Bootstrap
 *
 * Registers all 6 built-in threat intel sources with the
 * ThreatIntelSourceRegistry at app startup. For each plugin, reads
 * the operator's API key from secureStore. Sources without a
 * configured key are skipped (logged as info, not errors).
 *
 * This module is imported from App.tsx during initialization, after
 * secureStore.init() completes.
 */

import { secureStore } from "@/lib/workbench/secure-store";
import { registerThreatIntelSource } from "@/lib/workbench/threat-intel-registry";

// Manifests (used for plugin IDs)
import { VIRUSTOTAL_MANIFEST } from "./virustotal-plugin";
import { GREYNOISE_MANIFEST } from "./greynoise-plugin";
import { SHODAN_MANIFEST } from "./shodan-plugin";
import { ABUSEIPDB_MANIFEST } from "./abuseipdb-plugin";
import { OTX_MANIFEST } from "./otx-plugin";
import { MISP_MANIFEST } from "./misp-plugin";

// Factories
import { createVirusTotalSource } from "./virustotal-plugin";
import { createGreyNoiseSource } from "./greynoise-plugin";
import { createShodanSource } from "./shodan-plugin";
import { createAbuseIPDBSource } from "./abuseipdb-plugin";
import { createOtxSource } from "./otx-plugin";
import { createMispSource } from "./misp-plugin";

// ---------------------------------------------------------------------------
// Plugin descriptors
// ---------------------------------------------------------------------------

interface PluginDescriptor {
  pluginId: string;
  displayName: string;
  /** Secret keys to read from secureStore (prefixed with plugin:{id}:) */
  secretKeys: string[];
  /** Factory that receives the resolved secret values in order */
  create: (secrets: (string | null)[]) => ReturnType<typeof createVirusTotalSource>;
}

const PLUGINS: PluginDescriptor[] = [
  {
    pluginId: VIRUSTOTAL_MANIFEST.id,
    displayName: VIRUSTOTAL_MANIFEST.displayName ?? "VirusTotal",
    secretKeys: ["api_key"],
    create: ([apiKey]) => createVirusTotalSource(apiKey!),
  },
  {
    pluginId: GREYNOISE_MANIFEST.id,
    displayName: GREYNOISE_MANIFEST.displayName ?? "GreyNoise",
    secretKeys: ["api_key"],
    create: ([apiKey]) => createGreyNoiseSource(apiKey!),
  },
  {
    pluginId: SHODAN_MANIFEST.id,
    displayName: SHODAN_MANIFEST.displayName ?? "Shodan",
    secretKeys: ["api_key"],
    create: ([apiKey]) => createShodanSource(apiKey!),
  },
  {
    pluginId: ABUSEIPDB_MANIFEST.id,
    displayName: ABUSEIPDB_MANIFEST.displayName ?? "AbuseIPDB",
    secretKeys: ["api_key"],
    create: ([apiKey]) => createAbuseIPDBSource(apiKey!),
  },
  {
    pluginId: OTX_MANIFEST.id,
    displayName: OTX_MANIFEST.displayName ?? "AlienVault OTX",
    secretKeys: ["api_key"],
    create: ([apiKey]) => createOtxSource(apiKey!),
  },
  {
    pluginId: MISP_MANIFEST.id,
    displayName: MISP_MANIFEST.displayName ?? "MISP",
    secretKeys: ["api_key", "base_url"],
    create: ([apiKey, baseUrl]) =>
      createMispSource(apiKey!, baseUrl ?? "https://localhost"),
  },
];

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Register all built-in threat intel sources whose API keys are
 * already configured in secureStore.
 *
 * @returns The number of sources successfully registered.
 */
export async function bootstrapThreatIntelPlugins(): Promise<number> {
  let registered = 0;

  for (const plugin of PLUGINS) {
    try {
      // Read all required secrets
      const secrets = await Promise.all(
        plugin.secretKeys.map((key) =>
          secureStore.get(`plugin:${plugin.pluginId}:${key}`),
        ),
      );

      // The first secret (api_key) is always required
      const primarySecret = secrets[0];
      if (!primarySecret) {
        console.info(
          `[threat-intel-bootstrap] Skipping ${plugin.displayName} -- no API key configured`,
        );
        continue;
      }

      const source = plugin.create(secrets);
      registerThreatIntelSource(source);
      registered++;
      console.info(
        `[threat-intel-bootstrap] Registered ${plugin.displayName} (${source.id})`,
      );
    } catch (err: unknown) {
      console.warn(
        `[threat-intel-bootstrap] Failed to register ${plugin.displayName}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.info(
    `[threat-intel-bootstrap] ${registered}/${PLUGINS.length} threat intel sources registered`,
  );
  return registered;
}

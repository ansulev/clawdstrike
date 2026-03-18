# Plugin Trust & Distribution: Cryptographic Primitives Inventory

**Analysis Date:** 2026-03-18

This document maps the existing cryptographic, identity, and distribution infrastructure in ClawdStrike that can underpin plugin signing, trust, and marketplace distribution. For each area it documents what exists, what can be reused, and what needs to be built.

---

## 1. Ed25519 Signing Primitives

### What Exists

The `hush-core` crate provides a complete Ed25519 signing stack built on `ed25519-dalek` with `OsRng`.

**Key files:**
- `crates/libs/hush-core/src/signing.rs` -- `Keypair`, `PublicKey`, `Signature`, `Signer` trait
- `crates/libs/hush-core/src/hashing.rs` -- `Hash`, `sha256()`, `keccak256()`
- `crates/libs/hush-core/src/canonical.rs` -- RFC 8785 JCS canonical JSON
- `crates/libs/hush-core/src/merkle.rs` -- RFC 6962 Merkle tree with inclusion proofs

**Core APIs:**

```rust
// Key generation
Keypair::generate() -> Keypair         // OsRng
Keypair::from_seed(&[u8; 32]) -> Self  // deterministic
Keypair::from_hex(&str) -> Result<Self>

// Signing
keypair.sign(&[u8]) -> Signature       // infallible
keypair.public_key() -> PublicKey

// Verification
public_key.verify(&[u8], &Signature) -> bool

// Serialization (hex-encoded, 0x-prefixed in JSON via serde)
PublicKey::from_hex() / to_hex() / to_hex_prefixed()
Signature::from_hex() / to_hex()
Hash::from_hex() / to_hex() / to_hex_prefixed()

// Signer trait (for TPM-backed or abstract signers)
pub trait Signer {
    fn public_key(&self) -> PublicKey;
    fn sign(&self, message: &[u8]) -> Result<Signature>;
}
```

**Security properties:**
- `SigningKey` implements `ZeroizeOnDrop` (private key material auto-zeroed)
- `deny_unknown_fields` on all serde types
- Canonical JSON via RFC 8785 for cross-language determinism (Rust/TS/Python)
- All hex representations accept with or without `0x` prefix

### What Can Be Reused for Plugins

Everything. The signing primitives are the exact same Ed25519 curve and encoding already used by:
- Receipt signing (`SignedReceipt::sign()`)
- Package signing (`pkg::integrity::sign_package()`)
- Registry attestations (`attestation::sign_attestation()`)
- Operator identity in the workbench

A plugin manifest signature is `Keypair::sign(sha256(canonical_json(manifest)).as_bytes())` -- the same pattern used everywhere else.

### What Needs to Be Built

Nothing at the primitive layer. The existing `hush-core` signing surface is complete and production-ready for plugin manifest signing.

---

## 2. Operator Identity

### What Exists

The workbench has a full operator identity system with Ed25519 keypair management, persistence, and signing.

**Key files:**
- `apps/workbench/src/lib/workbench/operator-store.tsx` -- React context provider, state management
- `apps/workbench/src/lib/workbench/operator-crypto.ts` -- Web Crypto Ed25519 key generation, signing, verification
- `apps/workbench/src/lib/workbench/operator-types.ts` -- `OperatorIdentity`, `IdpClaims`, `SignedInvitation`
- `apps/workbench/src/lib/workbench/signature-adapter.ts` -- Detached Ed25519 signature boundary

**Operator Identity shape:**

```typescript
interface OperatorIdentity {
  publicKey: string;        // 64-char hex (32 bytes Ed25519)
  fingerprint: string;      // 16-char hex (SHA-256 of pubkey, first 8 bytes)
  sigil: string;            // visual identifier derived from fingerprint
  nickname: string;
  displayName: string;
  idpClaims: IdpClaims | null;  // OIDC/SAML/Okta/Auth0/AzureAD binding
  createdAt: number;
  originDeviceId: string;
  devices: OperatorDevice[];
  revokedAt?: number;
  revocationReason?: string;
}
```

**Key operations available:**
- `createIdentity(displayName)` -- generates Ed25519 keypair, stores secret in secure store
- `signPayload(data: Uint8Array)` -- signs with operator's secret key
- `signData(data: Uint8Array)` -- legacy path, returns hex signature or null
- `exportKey(passphrase)` -- PBKDF2 (600K iterations) + AES-256-GCM encrypted export
- `importKey(encoded, passphrase)` -- decrypt and reconstruct identity
- `signOwnershipProof(sentinelPublicKey, operatorSecretKey)` -- time-bounded ownership proof
- `verifyOwnershipProof(...)` -- verify with max age (default 24h)
- `signCanonical(obj, secretKeyHex)` -- canonicalize JSON + sign
- `verifyCanonical(obj, signatureHex, publicKeyHex)` -- canonicalize + verify
- `revokeIdentity(reason)` -- marks identity as revoked

**Identity persistence:** Public identity stored in `localStorage` (`clawdstrike_workbench_operator`). Private key stored via `secureStore` (see section 4).

### What Can Be Reused for Plugin Publishing

The operator identity **is** the plugin publisher identity. When an operator publishes a plugin:

1. Their `publicKey` (64-char hex) is the publisher key
2. Their `fingerprint` (16-char hex) is the publisher fingerprint
3. `signPayload()` signs the plugin manifest/archive hash
4. The `IdpClaims` binding provides verified publisher attribution (e.g., "this operator authenticated via Okta as user@company.com")

The invitation system (`SignedInvitation`, `AcceptedInvitation`) demonstrates the pattern for signed claims between operators -- directly reusable for plugin review attestations or co-signing.

### What Needs to Be Built

1. **Publisher profile persistence** -- Currently operator identities are local-only. A plugin marketplace needs server-side publisher profiles linking public keys to display names and verified email claims.

2. **Publisher key rotation** -- The operator system supports revocation (`revokedAt`) but not key rotation with overlap windows. The registry's `RegistryKeyManager` has this pattern (see section 5) and should be adapted.

3. **Multi-device signing** -- The `devices` array exists but cross-device key synchronization is not implemented.

---

## 3. Receipt System

### What Exists

The receipt system provides Ed25519-signed attestations with canonical JSON, versioned schemas, and dual-signature support.

**Key files:**
- `crates/libs/hush-core/src/receipt.rs` -- `Receipt`, `SignedReceipt`, `Verdict`, `Provenance`, `VerificationResult`

**Receipt structure:**

```rust
struct Receipt {
    version: String,              // "1.0.0" (fail-closed version check)
    receipt_id: Option<String>,
    timestamp: String,            // ISO-8601
    content_hash: Hash,           // SHA-256 of what was attested
    verdict: Verdict,             // passed: bool + gate_id + scores
    provenance: Option<Provenance>,  // clawdstrike_version, policy_hash, violations
    metadata: Option<JsonValue>,  // extensible key-value
}

struct SignedReceipt {
    receipt: Receipt,
    signatures: Signatures {
        signer: Signature,           // primary (required)
        cosigner: Option<Signature>, // co-signer (optional)
    },
}
```

**Key operations:**
- `SignedReceipt::sign(receipt, &keypair)` -- sign with concrete keypair
- `SignedReceipt::sign_with(receipt, &dyn Signer)` -- sign with abstract signer (TPM-backed)
- `signed.add_cosigner(&keypair)` -- add co-signer signature
- `signed.verify(&PublicKeySet)` -- verify primary + optional co-signer
- `receipt.to_canonical_json()` -- deterministic serialization for signing
- `receipt.hash_sha256()` / `hash_keccak256()` -- content hashing
- Fail-closed version validation: unsupported versions reject before signature check

**Verification result includes stable error codes:**
- `VFY_SIGNATURE_INVALID`
- `VFY_COSIGNATURE_INVALID`
- `VFY_RECEIPT_VERSION_UNSUPPORTED`
- `VFY_RECEIPT_VERSION_INVALID`

### How This Maps to Plugin Installation Receipts

An "installation receipt" is a receipt where:
- `content_hash` = SHA-256 of the plugin archive (`.cpkg`)
- `verdict.passed` = trust verification passed (publisher sig + registry counter-sig + Merkle proof)
- `verdict.gate_id` = `"plugin-install"`
- `provenance.ruleset` = the trust requirement level (`"signed"`, `"verified"`, `"certified"`)
- `metadata` = `{ "plugin": { "name": "...", "version": "...", "publisher_key": "..." } }`

The co-signer field enables the registry to counter-sign the installation receipt, creating a dual-attested record: "operator X installed plugin Y at trust level Z, and the registry confirms the stated provenance."

### What Needs to Be Built

1. **Installation receipt schema** -- Define the `metadata` schema for plugin installation events. The receipt system is generic; we need a structured convention for plugin installs.

2. **Receipt chain for plugin lifecycle** -- Extend the existing receipt chain verification (`verifyReceiptChainNative`) to cover install -> update -> uninstall lifecycle.

3. **TS-side receipt creation** -- The workbench currently creates receipts via Tauri commands (`signReceiptNative`, `signReceiptPersistentNative`). A pure-TS receipt creation path using Web Crypto would enable browser-only mode.

---

## 4. Secure Store (Stronghold Vault)

### What Exists

A tiered secret storage system with Tauri Stronghold as the primary backend and graceful degradation.

**Key file:** `apps/workbench/src/lib/workbench/secure-store.ts`

**Architecture:**

```
Tier 1: Tauri Stronghold (desktop only)
  └── init_stronghold → store_credential / get_credential / delete_credential / has_credential
  └── 5-second init timeout with retry

Tier 2: In-memory Map (ephemeral, tab-scoped)
  └── Sensitive keys (tokens, secrets, passwords, private keys, API keys)
  └── Lost on tab close (intentional security behavior)

Tier 3: sessionStorage (non-sensitive only)
  └── Explicitly allowlisted keys: hushd_url, control_api_url
  └── Never used for sensitive data
```

**Key sensitivity classification:**
- Explicit sensitive keys: `api_key`, `control_api_token`, `token`, `secret`, `password`, `private_key`, `signing_key`
- Heuristic patterns: contains `token`, `secret`, `password`, `api_key`, `apikey`, `private_key`
- Deny-by-default: only `SESSION_STORAGE_FALLBACK_KEYS` may use sessionStorage

**Legacy migration:** `migrateCredentialsToStronghold()` migrates from plaintext localStorage to Stronghold.

**Current usage:**
- Operator secret key: stored as `operator_secret_key` in secure store
- API keys, tokens: stored with appropriate sensitivity classification
- Persistent Ed25519 keypair: managed via Tauri commands (`generate_persistent_keypair`, `sign_with_persistent_key`)

### How Plugin Secrets/API Keys Could Be Stored

Plugin secrets fit naturally into the existing secure store:

```typescript
// Plugin API key storage
await secureStore.set(`plugin_${pluginId}_api_key`, apiKeyValue);
// Automatically classified as sensitive (contains "api_key")
// → In-memory only in browser, Stronghold in desktop

// Plugin secret retrieval
const key = await secureStore.get(`plugin_${pluginId}_api_key`);
```

The broker subsystem (`clawdstrike-brokerd`) already solves the harder problem of proxied secret injection: plugins that need API keys never touch raw credentials. The broker issues time-bounded, path-scoped capabilities and injects secrets at the proxy layer.

### What Needs to Be Built

1. **Plugin secret namespace** -- Convention for plugin secret keys (e.g., `plugin:{pluginId}:{secretName}`) to avoid collisions.

2. **Secret provisioning UI** -- A settings panel for operators to configure per-plugin secrets. The secure store provides the backend; the UI is missing.

3. **Secret access audit** -- Log when plugins access secrets. The secure store is silent today.

---

## 5. Registry & Distribution Infrastructure

### What Exists

A complete package registry service with signing, attestation, transparency log, and organization management.

**Key files:**
- `crates/services/clawdstrike-registry/src/main.rs` -- Axum HTTP server
- `crates/services/clawdstrike-registry/src/api/mod.rs` -- Full REST API
- `crates/services/clawdstrike-registry/src/attestation.rs` -- `PublishAttestation`, `SignedAttestation`
- `crates/services/clawdstrike-registry/src/keys.rs` -- `RegistryKeyManager` with key rotation
- `crates/services/clawdstrike-registry/src/storage.rs` -- Content-addressed blob storage
- `crates/services/clawdstrike-registry/src/index.rs` -- Sparse index (one JSON per package)
- `crates/services/clawdstrike-registry/src/db.rs` -- SQLite database
- `crates/libs/clawdstrike/src/pkg/` -- Package format, manifest, signing, trust

**Registry API endpoints (already implemented):**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/packages` | Publish package (auth required) |
| GET | `/api/v1/packages/{name}` | Package info |
| GET | `/api/v1/packages/{name}/{version}` | Version info |
| GET | `/api/v1/packages/{name}/{version}/download` | Download `.cpkg` |
| DELETE | `/api/v1/packages/{name}/{version}` | Yank version (auth) |
| GET | `/api/v1/search?q=...` | Search packages |
| GET | `/api/v1/index/{name}` | Sparse index (with ETag/304) |
| GET | `/api/v1/packages/{name}/{version}/attestation` | Publish attestation |
| GET | `/api/v1/packages/{name}/{version}/proof` | Merkle inclusion proof |
| GET | `/api/v1/transparency/checkpoint` | Transparency log checkpoint |
| GET | `/api/v1/transparency/consistency` | Consistency proof |
| GET | `/api/v1/audit/{name}` | Audit log |
| GET | `/api/v1/packages/{name}/stats` | Download statistics |
| GET | `/api/v1/popular` | Popular packages |
| POST | `/api/v1/orgs` | Create organization (auth) |
| GET/POST | `/api/v1/orgs/{name}/members` | Organization members (auth) |
| POST/DELETE | `/api/v1/packages/{name}/trusted-publishers` | Trusted publishers (auth) |

**Publish flow:**

1. Client computes `SHA-256(archive_bytes)` and signs with publisher Ed25519 key
2. Sends `{ archive_base64, publisher_key, publisher_sig, manifest_toml }` to POST `/api/v1/packages`
3. Registry verifies: signature, manifest consistency (body vs embedded), scoped org membership
4. Registry counter-signs with its own Ed25519 key
5. Creates `PublishAttestation` (canonical JSON, signed envelope)
6. Appends to Merkle tree, assigns leaf index
7. Stores blob in content-addressed storage
8. Updates sparse index

**Auth model:** Ed25519 signed requests with `X-Clawdstrike-Caller-Key`, `X-Clawdstrike-Caller-Sig`, `X-Clawdstrike-Caller-Ts` headers. Timing-safe signature verification with timestamp replay protection.

**Package manifest format (`clawdstrike-pkg.toml`):**

```toml
[package]
name = "@acme/my-guard"
version = "1.0.0"
pkg_type = "guard"          # guard | policy-pack | adapter | engine | template | bundle
description = "..."
authors = ["..."]
license = "MIT"
repository = "https://..."
keywords = ["..."]

[clawdstrike]
min_version = "0.1.0"

[capabilities]
filesystem = { read = ["/etc/hosts"], write = [] }
secrets = { allowed_keys = ["API_KEY"] }

[resources]
max_memory_mb = 64
max_execution_ms = 5000

[trust]
level = "trusted"
sandbox = "wasm"

[dependencies]
other-guard = "^1.0"
```

**Trust levels (monotonically increasing):**
- `Unverified` (0) -- no signature
- `Signed` (1) -- publisher Ed25519 signature
- `Verified` (2) -- publisher + registry counter-signature
- `Certified` (3) -- publisher + registry + Merkle inclusion proof

**Key rotation:** `RegistryKeyManager` supports:
- Active/Deprecated/Revoked key states
- Overlap windows during rotation (configurable days)
- Dual-signing of rotation events (old + new key)
- Fail-closed: revoked keys reject verification, expired deprecated keys skip

**Package signing (`pkg/integrity.rs`):**

```rust
sign_package(archive_path, &keypair) -> PackageSignature { hash, signature, public_key }
verify_package(archive_path, &signature, &public_key) -> bool
verify_package_embedded(archive_path, &signature) -> bool  // uses embedded key
```

### What Can Be Reused for Plugin Marketplace

Nearly everything. The registry is designed for exactly this use case. The package types already include `Guard`, `PolicyPack`, `Adapter`, `Engine`, `Template`, `Bundle` -- which map directly to plugin types.

### What Needs to Be Built

1. **Workbench registry client** -- TypeScript client for the registry API. The registry server exists; the workbench needs a client to browse, search, install, and publish from the UI.

2. **Plugin install flow** -- `download -> verify signature -> verify trust level -> unpack -> register`. The Rust primitives exist (`verify_package`, `check_trust`, `unpack`); needs TS orchestration.

3. **Workbench plugin loader** -- The plugin system has `PluginLoader` and `WasmGuard` for Rust-side guard execution. Needs a workbench-side equivalent that loads plugins from the local store and registers them with the guard pipeline.

---

## 6. MCP Plugin Architecture

### What Exists

The workbench has a functioning MCP server with dual transport support.

**Key files:**
- `apps/workbench/mcp-server/index.ts` -- MCP server implementation (14 tools, 5 prompts, 3 resources)
- `apps/workbench/src/lib/tauri-commands.ts` -- Tauri commands including `get_mcp_status`, `stop_mcp_server`, `restart_mcp_server`
- `apps/workbench/src/lib/workbench/use-mcp-status.ts` -- React hook for MCP sidecar status polling
- `apps/workbench/src/lib/workbench/detection-mcp-tools.ts` -- MCP tool definitions for detection rules

**Transport modes:**
- **stdio** (default): `bun run apps/workbench/mcp-server/index.ts` -- Claude Code spawns the process
- **SSE**: `--sse` flag or `MCP_TRANSPORT=sse` env var -- embedded in Tauri desktop app
  - Listens on `MCP_PORT` (default 9877)
  - Bearer token auth from `MCP_AUTH_TOKEN` (rotates per session)
  - Timing-safe token comparison

**Existing MCP tools (14):** Policy validation, simulation, compliance scoring, guard coverage analysis, scenario testing, policy hardening, diff, format conversion, event log synthesis, policy generation from events, MITRE ATT&CK coverage.

**MCP config for Claude Code (from library-gallery.tsx):**

```json
{
  "mcpServers": {
    "clawdstrike-workbench": {
      "url": "http://localhost:9877/sse",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Or stdio mode:
```json
{
  "mcpServers": {
    "clawdstrike-workbench": {
      "command": "bun",
      "args": ["run", "apps/workbench/mcp-server/index.ts"]
    }
  }
}
```

**Detection MCP tools (`detection-mcp-tools.ts`):**

Defines tool schemas for `create_sigma_rule`, `create_yara_rule`, `validate_detection_rule`, `list_detection_rules`, `get_attack_coverage`, `convert_sigma_rule`. These demonstrate the pattern for exposing workbench functionality as MCP tools.

### How "MCP Plugin Is the Right Model" Maps in Practice

An MCP plugin in this context means:

1. **Plugin exposes tools via MCP protocol** -- Each plugin is an MCP server that provides `tools/list` and `tools/call` endpoints. The workbench discovers available tools and renders them in the UI.

2. **Plugin transport is stdio or SSE** -- For local plugins, stdio (workbench spawns the process); for remote/cloud plugins, SSE with auth.

3. **Plugin discovery via manifest** -- The `clawdstrike-pkg.toml` declares what MCP tools the plugin provides, what capabilities it needs, and what sandbox constraints apply.

4. **Security boundary is the MCP protocol** -- The plugin runs in its own process (stdio) or server (SSE). The workbench communicates only via structured JSON-RPC messages. The `McpToolGuard` (built-in guard #7) can restrict which MCP tools are callable.

5. **Existing MCP server is the template** -- New plugins follow the same pattern as `mcp-server/index.ts`: create an `McpServer`, register tools with schemas, connect transport.

### What Needs to Be Built

1. **Plugin MCP client** -- The workbench needs to connect to multiple MCP servers simultaneously (one per active plugin). The current code only manages a single built-in MCP server.

2. **Plugin tool registration** -- When a plugin is installed, its MCP tools need to be discovered and registered in the workbench's command palette and guard pipeline.

3. **Plugin lifecycle management** -- Start/stop/restart individual plugin MCP servers. The existing `use-mcp-status` hook manages only the built-in sidecar.

4. **Sandbox enforcement** -- The `McpToolGuard` restricts tool calls at the policy level, but the workbench needs to enforce the `[capabilities]` and `[resources]` sections from the manifest before allowing a plugin to start.

---

## 7. Library/Catalog Pattern

### What Exists

The workbench has a policy catalog/library with browsing, search, categorization, and import/export.

**Key files:**
- `apps/workbench/src/lib/workbench/policy-catalog.ts` -- `CatalogEntry` type, category system, curated policy templates
- `apps/workbench/src/components/workbench/library/library-gallery.tsx` -- Library page with tabs: My Policies, Catalog, SigmaHQ
- `apps/workbench/src/components/workbench/library/catalog-browser.tsx` -- Catalog browser component

**Catalog entry shape:**

```typescript
interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: CatalogCategory;  // general | ai-agent | cicd | healthcare | finance | remote-desktop | enterprise | minimal
  tags: string[];
  author: string;
  version: string;
  extends?: string;           // base ruleset
  yaml: string;               // full policy YAML
  guardSummary: string[];     // list of guards included
  useCases: string[];         // example use cases
  compliance: string[];       // compliance frameworks covered
  difficulty: CatalogDifficulty;  // beginner | intermediate | advanced
  popularity: number;
  createdAt: string;
  updatedAt: string;
}
```

**Library gallery features:**
- Tab navigation: My Policies / Catalog / SigmaHQ
- Built-in rulesets (loaded from Rust engine via Tauri or client-side fallback)
- User saved policies
- Recent files (desktop only)
- MCP server status and connection config
- AI integration prompt cards (copy-to-clipboard MCP prompts)
- Import/Export
- YAML preview dialog

**Pattern for builtin rulesets merging (`useBuiltinRulesets`):**
1. Try to load from native Rust engine via `listBuiltinRulesets()` + `loadBuiltinRuleset()`
2. Merge with client-side fallback `BUILTIN_RULESETS`
3. Native entries override client entries by ID
4. Client-only entries preserved

### How a Plugin Marketplace/Catalog Could Reuse This

The `CatalogEntry` shape maps almost 1:1 to a plugin listing:

| CatalogEntry field | Plugin listing equivalent |
|---|---|
| `id` | package name |
| `name` | display name |
| `description` | description |
| `category` | plugin category (guard, adapter, engine, etc.) |
| `tags` | keywords from manifest |
| `author` | publisher display name |
| `version` | latest version |
| `yaml` | N/A (replaced by install action) |
| `guardSummary` | capabilities summary |
| `useCases` | use cases |
| `compliance` | compliance frameworks |
| `difficulty` | N/A |
| `popularity` | download count from registry stats |
| `createdAt` / `updatedAt` | publish timestamps |

The library gallery tab system extends naturally: add a "Plugins" or "Marketplace" tab alongside My Policies / Catalog / SigmaHQ.

The native/fallback merge pattern (`useBuiltinRulesets`) is directly reusable for plugin discovery: try registry API first, fall back to bundled/cached index.

### What Needs to Be Built

1. **Plugin catalog data source** -- Replace hardcoded `POLICY_CATALOG` with registry API queries (`/api/v1/search`, `/api/v1/popular`).

2. **Plugin card component** -- Adapt `PolicyCard` to show trust level badge, download count, install button instead of "open in editor".

3. **Install/uninstall actions** -- The catalog currently only has "open" and "view YAML". Plugins need install/uninstall with trust verification.

4. **Installed plugins view** -- A "My Plugins" section analogous to "Your Policies", showing installed plugins with version, trust level, and update status.

---

## Summary: Build vs. Reuse Matrix

| Component | Status | Reuse | Build |
|-----------|--------|-------|-------|
| Ed25519 signing | Complete | 100% | Nothing |
| SHA-256/Keccak hashing | Complete | 100% | Nothing |
| Canonical JSON (RFC 8785) | Complete | 100% | Nothing |
| Merkle tree + proofs | Complete | 100% | Nothing |
| Operator identity | Complete | 90% | Server-side publisher profiles, key rotation |
| Secure store (Stronghold) | Complete | 90% | Plugin secret namespace, provisioning UI |
| Receipt system | Complete | 80% | Installation receipt schema, TS-side creation |
| Package format (.cpkg) | Complete | 100% | Nothing |
| Package manifest | Complete | 100% | Nothing |
| Package signing/verification | Complete | 100% | Nothing |
| Trust level computation | Complete | 100% | Nothing |
| Registry server | Complete | 95% | Plugin-specific metadata fields |
| Registry auth (Ed25519 signed requests) | Complete | 100% | Nothing |
| Attestation + transparency log | Complete | 100% | Nothing |
| Organization/scoped packages | Complete | 100% | Nothing |
| Sparse index | Complete | 100% | Nothing |
| Content-addressed blob storage | Complete | 100% | Nothing |
| MCP server pattern | Complete | 80% | Multi-server client, plugin lifecycle |
| Library/catalog UI | Complete | 70% | Plugin cards, install actions, marketplace tab |
| **Workbench registry client** | Missing | 0% | Full TypeScript client for registry API |
| **Plugin MCP multiplexer** | Missing | 0% | Connect to N plugin MCP servers |
| **Plugin lifecycle manager** | Missing | 0% | Install/start/stop/update/uninstall |

The cryptographic and distribution infrastructure is overwhelmingly complete. The primary gaps are in the workbench's client-side orchestration: connecting the existing registry server to the workbench UI, and managing multiple MCP plugin servers simultaneously.

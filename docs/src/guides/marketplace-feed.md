# Marketplace Feed (Signed, IPFS-hostable)

Clawdstrike defines signed feed and bundle formats for policy distribution over untrusted transport.
Feeds and bundles can be hosted on HTTPS, mirrored, or published over IPFS. Consumers must verify signatures before accepting content.

## Prerequisites

- `clawdstrike` CLI available locally (`clawdstrike --help`) or runnable from this repo.
- `openssl` for curator key generation.
- Optional: `ipfs` CLI daemon/access for IPFS publishing examples.
- A consuming client/service with a trusted curator public-key allowlist.

## Files and signatures

- **Feed:** `SignedMarketplaceFeed` JSON signed by a curator key.
- **Bundle:** `SignedPolicyBundle` JSON signed by the bundle publisher (`public_key` embedded for verification).

Recommended verification order for consumers:

1. Verify feed signature against a trusted curator key.
2. Verify each referenced bundle signature.
3. Apply local policy on provenance/revocations before install.

## Generate signed bundles

Create a working directory and build signed bundles:

```bash
mkdir -p ./marketplace/bundles
openssl rand -hex 32 > curator.key

clawdstrike policy bundle build rulesets/default.yaml \
  --resolve \
  --key curator.key \
  --output ./marketplace/bundles/default.signed_bundle.json \
  --embed-pubkey
```

Repeat for additional policies/rulesets. Bundle files should end with `.signed_bundle.json`.

## Generate and sign a feed

Set the feed signing key and run the helper script:

```bash
export MARKETPLACE_FEED_SIGNING_KEY="$(cat curator.key)"

tools/scripts/build-marketplace-feed \
  --bundles-dir ./marketplace/bundles \
  --output ./marketplace/feed.signed.json \
  --seq 1
```

To emit IPFS bundle URIs:

```bash
tools/scripts/build-marketplace-feed \
  --bundles-dir ./marketplace/bundles \
  --output ./marketplace/feed.signed.json \
  --seq 1 \
  --bundle-uri-prefix "ipfs://<BUNDLES_CID>/"
```

## Publish on IPFS (optional)

```bash
ipfs add -r ./marketplace/bundles
ipfs add ./marketplace/feed.signed.json
```

Use the resulting feed URI (`ipfs://<FEED_CID>`) in your consuming service or client.

## Provenance / attestations (optional)

Feed entries may include provenance pointers (for example an EAS attestation UID):

```json
{
  "provenance": {
    "attestation_uid": "0x...",
    "notary_url": "https://notary.example.com"
  }
}
```

The provenance object is covered by the feed signature. Consumers can optionally call a notary endpoint:

- `GET {notary_url}/verify/{attestation_uid}`

and enforce local trust policy on `valid`, `attester`, and timestamp fields.

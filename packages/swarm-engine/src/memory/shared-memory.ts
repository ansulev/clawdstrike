/**
 * SharedMemory -- unified memory manager wrapping HNSW, KnowledgeGraph, and
 * IdbBackend with namespace scoping, tag-based search, TTL expiration, and
 * ClawdStrike guard pipeline integration.
 *
 * Memory writes pass through the guard pipeline as `file_write` actions with
 * `memory://{namespace}/{key}` targets. Deny verdicts block the write and
 * return false. When no guard evaluator is configured, writes are denied
 * (fail-closed), consistent with the orchestrator's guard pipeline.
 *
 * Does NOT call events.dispose() on dispose (Pitfall 7).
 *
 * @module
 */

import { HnswLite } from "./hnsw.js";
import { KnowledgeGraph } from "./graph.js";
import type { Entity, Relation } from "./graph.js";
import { IdbBackend } from "./idb-backend.js";
import type { TypedEventEmitter } from "../events.js";
import type { SwarmEngineEventMap } from "../events.js";
import type { GuardEvaluator, GuardedAction } from "../types.js";

// ============================================================================
// Types
// ============================================================================

export interface SharedMemoryConfig {
  guardEvaluator?: GuardEvaluator;
  idbName?: string;
  dimensions?: number;
  enableIdb?: boolean;
}

export interface MemoryEntry {
  value: unknown;
  tags: string[];
  ttlMs: number | null;
  storedAt: number;
  namespace: string;
  vector?: Float32Array;
  /** Internal key (namespace:key) for search result identification. */
  _key?: string;
}

export interface StoreOptions {
  agentId?: string;
  taskId?: string;
  tags?: string[];
  ttlMs?: number;
  vector?: Float32Array;
}

export interface SearchOptions {
  tags?: string[];
  vector?: Float32Array;
  k?: number;
}

// ============================================================================
// SharedMemory
// ============================================================================

export class SharedMemory {
  private readonly events: TypedEventEmitter<SwarmEngineEventMap>;
  private readonly guardEvaluator: GuardEvaluator | undefined;
  private readonly hnsw: HnswLite;
  private readonly graph: KnowledgeGraph;
  private readonly idb: IdbBackend | null;
  private readonly data = new Map<string, MemoryEntry>();

  constructor(
    events: TypedEventEmitter<SwarmEngineEventMap>,
    config?: SharedMemoryConfig,
  ) {
    this.events = events;
    this.guardEvaluator = config?.guardEvaluator;
    this.hnsw = new HnswLite(config?.dimensions ?? 128, 16, 200, "cosine");
    this.graph = new KnowledgeGraph();

    if (config?.enableIdb) {
      this.idb = new IdbBackend(config.idbName ?? "swarm-memory");
    } else {
      this.idb = null;
    }
  }

  // --------------------------------------------------------------------------
  // Store
  // --------------------------------------------------------------------------

  async store(
    namespace: string,
    key: string,
    value: unknown,
    options?: StoreOptions,
  ): Promise<boolean> {
    // Guard check -- fail-closed: no evaluator means deny all writes
    if (!this.guardEvaluator) {
      return false;
    }

    const action: GuardedAction = {
      agentId: options?.agentId ?? "system",
      taskId: options?.taskId ?? null,
      actionType: "file_write",
      target: `memory://${namespace}/${key}`,
      context: {
        namespace,
        key,
        sizeBytes: JSON.stringify(value).length,
      },
      requestedAt: Date.now(),
    };

    const result = await this.guardEvaluator.evaluate(action);
    if (!result.allowed) {
      return false;
    }

    // Store entry
    const compositeKey = `${namespace}:${key}`;
    const entry: MemoryEntry = {
      value,
      tags: options?.tags ?? [],
      ttlMs: options?.ttlMs ?? null,
      storedAt: Date.now(),
      namespace,
      vector: options?.vector,
      _key: compositeKey,
    };

    this.data.set(compositeKey, entry);

    // Index vector in HNSW if provided
    if (options?.vector) {
      this.hnsw.add(compositeKey, options.vector);
    }

    // Persist to IDB if available
    if (this.idb?.isAvailable) {
      await this.idb.put(compositeKey, { ...entry, vector: undefined });
    }

    // Emit event
    this.events.emit("memory.store", {
      kind: "memory.store",
      sourceAgentId: options?.agentId ?? null,
      timestamp: Date.now(),
      namespace,
      key,
      sizeBytes: JSON.stringify(value).length,
    });

    return true;
  }

  // --------------------------------------------------------------------------
  // Get (with lazy TTL eviction)
  // --------------------------------------------------------------------------

  get(namespace: string, key: string): MemoryEntry | undefined {
    const compositeKey = `${namespace}:${key}`;
    const entry = this.data.get(compositeKey);
    if (!entry) return undefined;

    // Lazy TTL eviction
    if (entry.ttlMs !== null && Date.now() - entry.storedAt > entry.ttlMs) {
      this.data.delete(compositeKey);
      if (entry.vector) {
        this.hnsw.remove(compositeKey);
      }
      return undefined;
    }

    return entry;
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  search(namespace: string, options: SearchOptions): MemoryEntry[] {
    const start = Date.now();

    let results: MemoryEntry[];

    if (options.vector) {
      // Vector similarity search via HNSW
      const k = options.k ?? 10;
      const hnswResults = this.hnsw.search(options.vector, k);

      results = [];
      for (const hr of hnswResults) {
        const entry = this.data.get(hr.id);
        if (!entry) continue;
        if (entry.namespace !== namespace) continue;

        // Lazy TTL eviction during search
        if (
          entry.ttlMs !== null &&
          Date.now() - entry.storedAt > entry.ttlMs
        ) {
          this.data.delete(hr.id);
          this.hnsw.remove(hr.id);
          continue;
        }

        // Tag filter
        if (options.tags && options.tags.length > 0) {
          if (!options.tags.some((t) => entry.tags.includes(t))) continue;
        }

        results.push(entry);
      }
    } else {
      // Tag-based or full-namespace scan
      results = [];
      for (const [_compositeKey, entry] of this.data) {
        if (entry.namespace !== namespace) continue;

        // Lazy TTL eviction
        if (
          entry.ttlMs !== null &&
          Date.now() - entry.storedAt > entry.ttlMs
        ) {
          this.data.delete(_compositeKey);
          if (entry.vector) this.hnsw.remove(_compositeKey);
          continue;
        }

        // Tag filter
        if (options.tags && options.tags.length > 0) {
          if (!options.tags.some((t) => entry.tags.includes(t))) continue;
        }

        results.push(entry);
      }
    }

    const durationMs = Date.now() - start;

    this.events.emit("memory.search", {
      kind: "memory.search",
      sourceAgentId: null,
      timestamp: Date.now(),
      namespace,
      query: options.vector ? "vector" : options.tags?.join(",") ?? "*",
      resultCount: results.length,
      durationMs,
    });

    return results;
  }

  // --------------------------------------------------------------------------
  // Delete
  // --------------------------------------------------------------------------

  delete(namespace: string, key: string): void {
    const compositeKey = `${namespace}:${key}`;
    const entry = this.data.get(compositeKey);
    if (entry?.vector) {
      this.hnsw.remove(compositeKey);
    }
    this.data.delete(compositeKey);
  }

  // --------------------------------------------------------------------------
  // KnowledgeGraph delegation
  // --------------------------------------------------------------------------

  addEntity(entity: Entity): void {
    this.graph.addEntity(entity);
  }

  addRelation(relation: Relation): void {
    this.graph.addRelation(relation);
  }

  queryEntities(
    type: string,
    properties?: Record<string, unknown>,
  ): Entity[] {
    return this.graph.query(type, properties);
  }

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  getState(): {
    entries: Record<string, MemoryEntry>;
    graph: ReturnType<KnowledgeGraph["getState"]>;
    vectorCount: number;
  } {
    const entries: Record<string, MemoryEntry> = {};
    for (const [key, entry] of this.data) {
      entries[key] = entry;
    }
    return {
      entries,
      graph: this.graph.getState(),
      vectorCount: this.hnsw.size,
    };
  }

  // --------------------------------------------------------------------------
  // Dispose
  // --------------------------------------------------------------------------

  /**
   * Release resources. Closes IDB, clears data.
   * Does NOT call events.dispose() (Pitfall 7).
   */
  dispose(): void {
    this.idb?.close();
    this.data.clear();
    this.graph.clear();
  }
}

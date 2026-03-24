/**
 * KnowledgeGraph -- entity-relationship storage with Map-based backing.
 *
 * Provides typed entity/relation CRUD, query-by-type with optional property
 * matching, and a serializable getState() that returns Records (not Maps).
 *
 * @module
 */

// ============================================================================
// Types
// ============================================================================

export interface Entity {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: number;
}

export interface Relation {
  from: string;
  to: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: number;
}

// ============================================================================
// KnowledgeGraph
// ============================================================================

export class KnowledgeGraph {
  private entities = new Map<string, Entity>();
  private relations = new Map<string, Relation[]>();

  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
    // Remove outgoing relations
    this.relations.delete(id);
    // Remove incoming relations from all other entities
    for (const [sourceId, rels] of this.relations) {
      const filtered = rels.filter((r) => r.to !== id);
      if (filtered.length === 0) {
        this.relations.delete(sourceId);
      } else {
        this.relations.set(sourceId, filtered);
      }
    }
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  addRelation(relation: Relation): void {
    const existing = this.relations.get(relation.from) ?? [];
    existing.push(relation);
    this.relations.set(relation.from, existing);
  }

  getRelations(entityId: string): Relation[] {
    return this.relations.get(entityId) ?? [];
  }

  /**
   * Query entities by type, optionally filtering by partial property match.
   * Every key in `properties` must match the entity's corresponding value.
   */
  query(type: string, properties?: Record<string, unknown>): Entity[] {
    const results: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.type !== type) continue;
      if (properties) {
        let match = true;
        for (const [key, val] of Object.entries(properties)) {
          if (entity.properties[key] !== val) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }
      results.push(entity);
    }
    return results;
  }

  /**
   * Returns a serializable snapshot (Records, not Maps).
   */
  getState(): {
    entities: Record<string, Entity>;
    relations: Record<string, Relation[]>;
  } {
    const entities: Record<string, Entity> = {};
    for (const [id, entity] of this.entities) {
      entities[id] = entity;
    }
    const relations: Record<string, Relation[]> = {};
    for (const [id, rels] of this.relations) {
      relations[id] = rels;
    }
    return { entities, relations };
  }

  clear(): void {
    this.entities.clear();
    this.relations.clear();
  }
}

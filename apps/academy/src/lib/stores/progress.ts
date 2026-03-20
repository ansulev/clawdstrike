import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

interface ProgressState {
  completedLessons: string[];
  completedChallenges: string[];
  markLessonComplete: (slug: string) => void;
  markChallengeComplete: (id: string) => void;
  isLessonComplete: (slug: string) => boolean;
  isChallengeComplete: (id: string) => boolean;
  reset: () => void;
}

/**
 * Browser-safe JSON storage adapter. Wraps localStorage with JSON
 * serialization. Returns a no-op store during SSR or in test environments
 * where localStorage methods may not be directly accessible.
 */
function createBrowserStorage(): StateStorage {
  const canUse =
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined' &&
    typeof window.localStorage.getItem === 'function';

  if (!canUse) {
    // In-memory fallback for SSR and environments with incomplete localStorage
    const mem = new Map<string, string>();
    return {
      getItem: (name: string) => mem.get(name) ?? null,
      setItem: (name: string, value: string) => { mem.set(name, value); },
      removeItem: (name: string) => { mem.delete(name); },
    };
  }

  return {
    getItem: (name: string) => window.localStorage.getItem(name),
    setItem: (name: string, value: string) => window.localStorage.setItem(name, value),
    removeItem: (name: string) => window.localStorage.removeItem(name),
  };
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      completedLessons: [],
      completedChallenges: [],

      markLessonComplete: (slug: string) => {
        const current = get().completedLessons;
        if (!current.includes(slug)) {
          set({ completedLessons: [...current, slug] });
        }
      },

      markChallengeComplete: (id: string) => {
        const current = get().completedChallenges;
        if (!current.includes(id)) {
          set({ completedChallenges: [...current, id] });
        }
      },

      isLessonComplete: (slug: string) => {
        return get().completedLessons.includes(slug);
      },

      isChallengeComplete: (id: string) => {
        return get().completedChallenges.includes(id);
      },

      reset: () => {
        set({ completedLessons: [], completedChallenges: [] });
      },
    }),
    {
      name: 'clawdstrike-academy-progress',
      version: 1,
      storage: createBrowserStorage(),
    },
  ),
);

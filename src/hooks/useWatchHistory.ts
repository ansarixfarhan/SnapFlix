"use client";

import { getUserHistories } from "@/actions/histories";
import type { HistoryDetail } from "@/types/movie";
import { useQuery } from "@tanstack/react-query";

/** localStorage key guests (and logged in users, as an offline fallback) use. */
export const GUEST_HISTORY_KEY = "snapflix_guest_history";

/** Shared React Query key so every reader/writer of watch history stays in sync. */
export const WATCH_HISTORY_QUERY_KEY = ["continue-watching"] as const;

/** Reads the guest/local watch history straight from localStorage. Never throws. */
export const readGuestHistory = (): HistoryDetail[] => {
  try {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(GUEST_HISTORY_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Persists the guest/local watch history back to localStorage. Never throws. */
export const writeGuestHistory = (list: HistoryDetail[]): void => {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // Storage can be unavailable (private browsing, quota, ...) - fail silently.
  }
};

const historyKey = (item: Pick<HistoryDetail, "type" | "media_id" | "season" | "episode">) =>
  `${item.type}_${item.media_id}_${item.season || 0}_${item.episode || 0}`;

/**
 * Combined watch history used by "Continue watching", the personalized home
 * billboard and the "mark as watched" control.
 *
 * Merges Supabase history (signed in users) with localStorage history
 * (guests, offline, or simply not synced yet), preferring whichever record
 * is most recent, then keeps only the most recently updated entry per show
 * so a series only shows its latest watched episode.
 */
export function useWatchHistory() {
  return useQuery({
    queryKey: WATCH_HISTORY_QUERY_KEY,
    queryFn: async (): Promise<HistoryDetail[]> => {
      // 1. Fetch Supabase histories (for logged in users)
      let serverItems: HistoryDetail[] = [];
      try {
        const res = await getUserHistories();
        if (res?.success && Array.isArray(res.data)) {
          serverItems = res.data;
        }
      } catch {}

      // 2. Fetch localStorage histories (for guests & offline)
      const guestItems = readGuestHistory();

      // 3. Merge: prefer whichever record has the latest updated_at
      const map = new Map<string, HistoryDetail>();
      for (const item of serverItems) {
        map.set(historyKey(item), item);
      }
      for (const item of guestItems) {
        const key = historyKey(item);
        const existing = map.get(key);
        if (!existing || new Date(item.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
          map.set(key, item);
        }
      }

      // 4. Sort by latest updated_at
      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

      // 5. Deduplicate by show so each series displays its most recently watched episode
      const showMap = new Map<string, HistoryDetail>();
      for (const item of combined) {
        const key = `${item.type}_${item.media_id}`;
        if (!showMap.has(key)) {
          showMap.set(key, item);
        }
      }

      return Array.from(showMap.values());
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

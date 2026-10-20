import { syncHistory } from "@/actions/histories";
import { ContentType } from "@/types";
import { diff } from "@/utils/helpers";
import { useDocumentVisibility } from "@mantine/hooks";
import { useEffect, useRef, useState } from "react";
import useSupabaseUser from "./useSupabaseUser";
import { queryClient } from "@/app/providers";
import { tmdb } from "@/api/tmdb";
import { GUEST_HISTORY_KEY, WATCH_HISTORY_QUERY_KEY } from "./useWatchHistory";

export type PlayerEventType = "play" | "pause" | "seeked" | "ended" | "timeupdate" | "episodechange";

export interface BasePlayerEventEnvelope<T> {
  type: "PLAYER_EVENT" | "MEDIA_DATA";
  data: T;
}

export interface VidlinkEventData {
  event: PlayerEventType;
  currentTime: number;
  duration: number;
  mtmdbId: number;
  mediaType: ContentType;
  season?: number;
  episode?: number;
}

export type VidlinkPlayerMessage = BasePlayerEventEnvelope<VidlinkEventData>;

export interface VidkingEventData {
  event: PlayerEventType;
  currentTime: number;
  duration: number;
  id: string | number;
  mediaType: ContentType;
  season?: number;
  episode?: number;
  progress?: number;
}

export type VidkingPlayerMessage = BasePlayerEventEnvelope<VidkingEventData>;

export interface UnifiedPlayerEventData {
  event: PlayerEventType;
  currentTime: number;
  duration: number;
  mediaId: string | number;
  mediaType: ContentType;
  season?: number;
  episode?: number;
  progress?: number;
}

export interface PlayerAdapter<RawMessage extends BasePlayerEventEnvelope<any>> {
  /** Domain origin for identifying source */
  origin: `https://${string}`;
  /** Converts raw → unified structure */
  parse: (raw: RawMessage) => UnifiedPlayerEventData | null;
}

export type AdapterMap = Record<string, PlayerAdapter<any>>;

export const playerAdapters = {
  vidlink: {
    origin: "https://vidlink.pro",
    parse: (raw) => {
      if (raw.type !== "PLAYER_EVENT") return null;
      const d = raw.data;
      return {
        ...d,
        mediaId: d.mtmdbId,
      };
    },
  } satisfies PlayerAdapter<VidlinkPlayerMessage>,

  vidking: {
    origin: "https://www.vidking.net",
    parse: (raw) => {
      if (raw.type !== "PLAYER_EVENT") return null;
      const d = raw.data;
      return {
        ...d,
        mediaId: d.id,
      };
    },
  } satisfies PlayerAdapter<VidkingPlayerMessage>,
} as const satisfies AdapterMap;

export interface UsePlayerEventsOptions {
  mediaId?: string | number;
  mediaType?: ContentType;
  metadata?: { season?: number; episode?: number };
  saveHistory?: boolean;
  onPlay?: (data: UnifiedPlayerEventData) => void;
  onPause?: (data: UnifiedPlayerEventData) => void;
  onSeeked?: (data: UnifiedPlayerEventData) => void;
  onEnded?: (data: UnifiedPlayerEventData) => void;
  onTimeUpdate?: (data: UnifiedPlayerEventData) => void;
  onEpisodeChange?: (data: UnifiedPlayerEventData) => void;
}

export function usePlayerEvents(options: UsePlayerEventsOptions = {}) {
  const { data: user } = useSupabaseUser();
  const documentState = useDocumentVisibility();

  const { mediaId, mediaType, metadata, saveHistory, onPlay, onPause, onSeeked, onEnded, onTimeUpdate, onEpisodeChange } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lastEvent, setLastEvent] = useState<PlayerEventType | null>(null);
  const [lastCurrentTime, setLastCurrentTime] = useState(0);

  const eventDataRef = useRef<UnifiedPlayerEventData | null>(null);
  const lastEpisodeKeyRef = useRef<string>("");

  const syncToServer = async (data: UnifiedPlayerEventData, completed?: boolean) => {
    if (!saveHistory) return;

    const payload: UnifiedPlayerEventData = {
      ...data,
      mediaId: data.mediaId || mediaId || "",
      mediaType: data.mediaType || mediaType || "movie",
      season: data.season !== undefined ? data.season : (metadata?.season || 0),
      episode: data.episode !== undefined ? data.episode : (metadata?.episode || 0),
    };

    if (!payload.mediaId) return;

    const currentKey = `${payload.mediaType}_${payload.mediaId}_${payload.season || 0}_${payload.episode || 0}`;
    const isNewEpisode = lastEpisodeKeyRef.current !== "" && lastEpisodeKeyRef.current !== currentKey;
    if (lastEpisodeKeyRef.current !== currentKey) {
      lastEpisodeKeyRef.current = currentKey;
      setLastCurrentTime(0);
    }

    if (!completed && !isNewEpisode && diff(data.currentTime, lastCurrentTime) < 3) return; // prevent spam

    // Prevent saving if 0 time unless completed or new episode
    if (!isNewEpisode && !completed && payload.currentTime <= 0) return;

    // 1. Always save to LocalStorage (works immediately for guests, offline, and instant display)
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(GUEST_HISTORY_KEY);
        const list: any[] = stored ? JSON.parse(stored) : [];
        const existingIdx = list.findIndex(
          (item) =>
            String(item.media_id) === String(payload.mediaId) &&
            item.type === payload.mediaType &&
            Number(item.season || 0) === Number(payload.season || 0) &&
            Number(item.episode || 0) === Number(payload.episode || 0),
        );

        if (existingIdx >= 0) {
          const item = list[existingIdx];
          item.last_position = payload.currentTime;
          if (payload.duration > 0) item.duration = payload.duration;
          item.completed = completed || false;
          item.updated_at = new Date().toISOString();
          const updated = [item, ...list.filter((_, i) => i !== existingIdx)].slice(0, 20);
          localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(updated));
          queryClient.invalidateQueries({ queryKey: WATCH_HISTORY_QUERY_KEY });
        } else {
          // Fetch title/poster from TMDB
          const fetchPromise =
            payload.mediaType === "movie"
              ? tmdb.movies.details(Number(payload.mediaId))
              : tmdb.tvShows.details(Number(payload.mediaId));

          fetchPromise
            .then((res: any) => {
              const newItem = {
                id: Date.now(),
                user_id: user?.id || "guest",
                media_id: Number(payload.mediaId),
                type: payload.mediaType,
                season: Number(payload.season || 0),
                episode: Number(payload.episode || 0),
                duration: payload.duration || (res.runtime ? res.runtime * 60 : 7200),
                last_position: payload.currentTime,
                completed: completed || false,
                adult: res.adult || false,
                backdrop_path: res.backdrop_path || "",
                poster_path: res.poster_path || "",
                release_date: res.release_date || res.first_air_date || new Date().toISOString(),
                title: res.title || res.name || `Title ${payload.mediaId}`,
                vote_average: res.vote_average || 8.0,
                updated_at: new Date().toISOString(),
              };
              const updated = [newItem, ...list].slice(0, 20);
              localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(updated));
              queryClient.invalidateQueries({ queryKey: WATCH_HISTORY_QUERY_KEY });
            })
            .catch(() => {});
        }
      }
    } catch (e) {}

    // 2. If logged in, also sync to Supabase
    if (user) {
      const { success, message } = await syncHistory(payload, completed);
      if (success) {
        setLastCurrentTime(data.currentTime);
        queryClient.invalidateQueries({ queryKey: WATCH_HISTORY_QUERY_KEY });
      } else {
        console.error("Save history failed:", message);
      }
    } else {
      setLastCurrentTime(data.currentTime);
    }
  };

  // Sync on document tab change / visibility change
  useEffect(() => {
    if (!saveHistory) return;
    if (documentState === "visible") return;
    if (!eventDataRef.current) return;
    syncToServer(eventDataRef.current);
  }, [documentState, lastCurrentTime]);

  // Periodic poll to query iframe player status
  useEffect(() => {
    const interval = setInterval(() => {
      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage({ command: "getStatus" }, "*");
        } catch (e) {}
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!saveHistory || !user) return;
      if (!eventDataRef.current) return;

      const payload = {
        ...eventDataRef.current,
        mediaId: eventDataRef.current.mediaId || mediaId || "",
        mediaType: eventDataRef.current.mediaType || mediaType || "movie",
        season: eventDataRef.current.season || metadata?.season || 0,
        episode: eventDataRef.current.episode || metadata?.episode || 0,
        completed: eventDataRef.current.event === "ended",
      };

      if (payload.mediaId && payload.currentTime > 0) {
        navigator.sendBeacon("/api/player/save-history", JSON.stringify(payload));
      }
    };

    const handleMessage = (event: MessageEvent) => {
      let rawData: any;
      try {
        rawData = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch (err) {
        return;
      }

      if (!rawData || typeof rawData !== "object") return;

      let parsed: UnifiedPlayerEventData | null = null;

      // Handle direct PLAYER_EVENT envelope
      if (rawData.type === "PLAYER_EVENT" && rawData.data) {
        const d = rawData.data;
        const eventName: PlayerEventType =
          d.event === "playerstatus"
            ? (d.playing ? "timeupdate" : "pause")
            : (d.event || "timeupdate");

        parsed = {
          event: eventName,
          currentTime: Number(d.currentTime || 0),
          duration: Number(d.duration || 0),
          mediaId: d.mediaId || mediaId || "",
          mediaType: d.mediaType || mediaType || "movie",
          season: d.season !== undefined ? Number(d.season) : (metadata?.season || 0),
          episode: d.episode !== undefined ? Number(d.episode) : (metadata?.episode || 0),
        };
      } else {
        const adapter = Object.values(playerAdapters).find((a) => a.origin === event.origin);
        if (adapter) {
          parsed = adapter.parse(rawData);
        }
      }

      if (!parsed || !parsed.mediaId) return;

      eventDataRef.current = parsed;
      setLastEvent(parsed.event);

      const parsedSeason = parsed.season ?? metadata?.season ?? 0;
      const parsedEpisode = parsed.episode ?? metadata?.episode ?? 0;
      const prevSeason = metadata?.season ?? 0;
      const prevEpisode = metadata?.episode ?? 0;

      const isEpisodeChange =
        parsed.event === "episodechange" ||
        (parsed.mediaType === "tv" &&
          parsedEpisode > 0 &&
          (parsedSeason !== prevSeason || parsedEpisode !== prevEpisode));

      if (isEpisodeChange) {
        onEpisodeChange?.(parsed);
      }

      switch (parsed.event) {
        case "episodechange":
          setIsPlaying(true);
          syncToServer(parsed);
          break;
        case "play":
          setIsPlaying(true);
          syncToServer(parsed);
          onPlay?.(parsed);
          break;
        case "pause":
          setIsPlaying(false);
          syncToServer(parsed);
          onPause?.(parsed);
          break;
        case "ended":
          setIsPlaying(false);
          syncToServer(parsed, true);
          onEnded?.(parsed);
          break;
        case "seeked":
          setCurrentTime(parsed.currentTime);
          setDuration(parsed.duration);
          syncToServer(parsed);
          onSeeked?.(parsed);
          break;
        case "timeupdate":
          setCurrentTime(parsed.currentTime);
          setDuration(parsed.duration);
          syncToServer(parsed);
          onTimeUpdate?.(parsed);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (eventDataRef.current) handleBeforeUnload();
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [mediaId, mediaType, metadata?.season, metadata?.episode, user, saveHistory, onEpisodeChange]);

  return { isPlaying, currentTime, duration, lastEvent };
}

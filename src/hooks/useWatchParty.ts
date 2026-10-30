"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PartyMember {
  id: string;
  name: string;
  isHost?: boolean;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

interface UseWatchPartyOptions {
  currentUsername?: string;
  onRemotePlay?: (time: number, sender: string) => void;
  onRemotePause?: (time: number, sender: string) => void;
  onRemoteSeek?: (time: number, sender: string) => void;
  onRemoteSyncRequest?: (sender: string) => void;
  onRemoteSyncState?: (time: number, isPlaying: boolean, sender: string) => void;
}

export function useWatchParty({
  currentUsername,
  onRemotePlay,
  onRemotePause,
  onRemoteSeek,
  onRemoteSyncRequest,
  onRemoteSyncState,
}: UseWatchPartyOptions = {}) {
  const [partyRoomId, setPartyRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [partyToast, setPartyToast] = useState<string | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientIdRef = useRef<string>('');

  // Keep callback refs fresh
  const onRemotePlayRef = useRef(onRemotePlay);
  const onRemotePauseRef = useRef(onRemotePause);
  const onRemoteSeekRef = useRef(onRemoteSeek);
  const onRemoteSyncRequestRef = useRef(onRemoteSyncRequest);
  const onRemoteSyncStateRef = useRef(onRemoteSyncState);

  useEffect(() => {
    onRemotePlayRef.current = onRemotePlay;
    onRemotePauseRef.current = onRemotePause;
    onRemoteSeekRef.current = onRemoteSeek;
    onRemoteSyncRequestRef.current = onRemoteSyncRequest;
    onRemoteSyncStateRef.current = onRemoteSyncState;
  });

  // Client ID for presence tracking
  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = 'user_' + Math.random().toString(36).substring(2, 9);
    }
  }, []);

  const displayName = currentUsername || (isHost ? 'Host' : 'Partner');

  const showToast = useCallback((msg: string, duration = 3000) => {
    setPartyToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setPartyToast(null);
    }, duration);
  }, []);

  // Connect to Supabase channel
  const connectToRoom = useCallback(
    (roomId: string, asHost = false) => {
      const cleanRoomId = roomId.trim().toUpperCase();
      if (!cleanRoomId) return;

      // Unsubscribe from previous if any
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      const supabase = createClient();
      const channelName = `snapflix-party-${cleanRoomId.toLowerCase()}`;

      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: clientIdRef.current || 'guest_' + Date.now() },
        },
      });

      // 1. Remote Play
      channel.on('broadcast', { event: 'party-play' }, ({ payload }) => {
        if (typeof payload?.time === 'number') {
          showToast(`▶ ${payload.sender || 'Partner'} played`, 2000);
          onRemotePlayRef.current?.(payload.time, payload.sender || 'Partner');
        }
      });

      // 2. Remote Pause
      channel.on('broadcast', { event: 'party-pause' }, ({ payload }) => {
        if (typeof payload?.time === 'number') {
          showToast(`⏸ ${payload.sender || 'Partner'} paused`, 2000);
          onRemotePauseRef.current?.(payload.time, payload.sender || 'Partner');
        }
      });

      // 3. Remote Seek
      channel.on('broadcast', { event: 'party-seek' }, ({ payload }) => {
        if (typeof payload?.time === 'number') {
          const mins = Math.floor(payload.time / 60);
          const secs = Math.floor(payload.time % 60);
          const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
          showToast(`⏩ ${payload.sender || 'Partner'} jumped to ${timeStr}`, 2500);
          onRemoteSeekRef.current?.(payload.time, payload.sender || 'Partner');
        }
      });

      // 4. Remote Sync Request (someone newly joined)
      channel.on('broadcast', { event: 'party-sync-request' }, ({ payload }) => {
        showToast(`🟢 ${payload.sender || 'Partner'} joined the party!`, 3000);
        onRemoteSyncRequestRef.current?.(payload.sender || 'Partner');
      });

      // 5. Remote Sync State Response
      channel.on('broadcast', { event: 'party-sync-state' }, ({ payload }) => {
        if (typeof payload?.time === 'number') {
          showToast(`⚡ Synced with ${payload.sender || 'Host'}`, 2500);
          onRemoteSyncStateRef.current?.(payload.time, Boolean(payload.isPlaying), payload.sender || 'Host');
        }
      });

      // 6. Remote Reaction
      channel.on('broadcast', { event: 'party-reaction' }, ({ payload }) => {
        if (payload?.emoji) {
          const newReaction: FloatingReaction = {
            id: payload.id || String(Date.now() + Math.random()),
            emoji: payload.emoji,
            x: Math.floor(20 + Math.random() * 60), // 20% to 80% horizontal
          };
          setFloatingReactions((prev) => [...prev.slice(-15), newReaction]);
          setTimeout(() => {
            setFloatingReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
          }, 2200);
        }
      });

      // 7. Presence Tracking (who is currently online in the party)
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const memberList: PartyMember[] = [];
        Object.values(state).forEach((presences: any) => {
          if (Array.isArray(presences)) {
            presences.forEach((p) => {
              if (p && p.name) {
                memberList.push({
                  id: p.id || String(Math.random()),
                  name: p.name,
                  isHost: Boolean(p.isHost),
                });
              }
            });
          }
        });
        setPartyMembers(memberList);
      });

      channel.on('presence', { event: 'join' }, ({ newPresences }: any) => {
        if (newPresences && newPresences[0]?.name) {
          showToast(`👋 ${newPresences[0].name} joined!`, 2500);
        }
      });

      channel.on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
        if (leftPresences && leftPresences[0]?.name) {
          showToast(`🚪 ${leftPresences[0].name} left the party`, 2500);
        }
      });

      // Subscribe and track presence
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: clientIdRef.current,
            name: displayName,
            isHost: asHost,
            joinedAt: Date.now(),
          });

          // If not host, request initial sync from host
          if (!asHost) {
            channel.send({
              type: 'broadcast',
              event: 'party-sync-request',
              payload: { sender: displayName },
            });
          }
        }
      });

      channelRef.current = channel;
      setPartyRoomId(cleanRoomId);
      setIsHost(asHost);

      // Update URL search query without full reload
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('party', cleanRoomId);
        window.history.replaceState({}, '', url.toString());
      }
    },
    [displayName, showToast]
  );

  // Start a new party
  const startParty = useCallback(() => {
    // Generate clean 6-character room code like SF-7K9A
    const randomCode = 'SF-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    connectToRoom(randomCode, true);
    showToast(`🎉 Watch Party started: ${randomCode}!`, 3500);
  }, [connectToRoom, showToast]);

  // Join existing party
  const joinParty = useCallback(
    (code: string) => {
      const cleanCode = code.trim().toUpperCase();
      if (!cleanCode) return;
      connectToRoom(cleanCode, false);
      showToast(`🔗 Joined Watch Party: ${cleanCode}!`, 3000);
    },
    [connectToRoom, showToast]
  );

  // Leave party
  const leaveParty = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setPartyRoomId(null);
    setIsHost(false);
    setPartyMembers([]);
    showToast('Left the Watch Party', 2000);

    // Remove party param from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('party');
      window.history.replaceState({}, '', url.toString());
    }
  }, [showToast]);

  // Copy invite link
  const copyInviteLink = useCallback(() => {
    if (typeof window === 'undefined' || !partyRoomId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('party', partyRoomId);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedLink(true);
      showToast('📋 Invite link copied to clipboard!', 2500);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }, [partyRoomId, showToast]);

  // Broadcast actions
  const broadcastPlay = useCallback(
    (time: number) => {
      if (!partyRoomId || !channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'party-play',
        payload: { time, sender: displayName },
      });
    },
    [partyRoomId, displayName]
  );

  const broadcastPause = useCallback(
    (time: number) => {
      if (!partyRoomId || !channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'party-pause',
        payload: { time, sender: displayName },
      });
    },
    [partyRoomId, displayName]
  );

  const broadcastSeek = useCallback(
    (time: number) => {
      if (!partyRoomId || !channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'party-seek',
        payload: { time, sender: displayName },
      });
    },
    [partyRoomId, displayName]
  );

  const broadcastSyncState = useCallback(
    (time: number, isPlaying: boolean) => {
      if (!partyRoomId || !channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'party-sync-state',
        payload: { time, isPlaying, sender: displayName },
      });
    },
    [partyRoomId, displayName]
  );

  const broadcastReaction = useCallback(
    (emoji: string) => {
      const id = String(Date.now() + Math.random());
      // Show locally immediately
      const newReaction: FloatingReaction = {
        id,
        emoji,
        x: Math.floor(20 + Math.random() * 60),
      };
      setFloatingReactions((prev) => [...prev.slice(-15), newReaction]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2200);

      // Send to room
      if (partyRoomId && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'party-reaction',
          payload: { emoji, id, sender: displayName },
        });
      }
    },
    [partyRoomId, displayName]
  );

  // Auto-join from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const partyCode = params.get('party');
      if (partyCode && !partyRoomId) {
        joinParty(partyCode);
      }
    }
  }, [joinParty, partyRoomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  return {
    partyRoomId,
    isHost,
    isPartyActive: Boolean(partyRoomId),
    partyMembers,
    partyToast,
    floatingReactions,
    copiedLink,
    startParty,
    joinParty,
    leaveParty,
    copyInviteLink,
    broadcastPlay,
    broadcastPause,
    broadcastSeek,
    broadcastSyncState,
    broadcastReaction,
  };
}

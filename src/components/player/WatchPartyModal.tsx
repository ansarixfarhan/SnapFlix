"use client";

import React, { useState } from 'react';
import {
  IoClose,
  IoCopyOutline,
  IoCheckmark,
  IoPeopleOutline,
  IoSparkles,
  IoExitOutline,
} from 'react-icons/io5';
import { Button } from '@heroui/react';
import { cn } from '@/utils/helpers';
import type { useWatchParty } from '@/hooks/useWatchParty';

interface WatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: ReturnType<typeof useWatchParty>;
}

export default function WatchPartyModal({
  isOpen,
  onClose,
  party,
}: WatchPartyModalProps) {
  const [joinCodeInput, setJoinCodeInput] = useState('');

  if (!isOpen) return null;

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCodeInput.trim()) {
      party.joinParty(joinCodeInput.trim());
      setJoinCodeInput('');
    }
  };

  const reactionEmojis = ['❤️', '🔥', '😂', '🥺', '🍿', '✨'];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#111114]/95 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl text-white animate-in zoom-in-95 duration-200 select-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition active:scale-95"
          aria-label="Close"
        >
          <IoClose size={20} />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E50914] to-[#B81D24] flex items-center justify-center shadow-lg shadow-red-900/40">
            <IoPeopleOutline size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
              <span>Watch Party</span>
              {party.isPartyActive && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </h3>
            <p className="text-xs text-white/60 font-medium">
              Real-time synchronized playback with your partner.
            </p>
          </div>
        </div>

        {/* State A: Not In Party */}
        {!party.isPartyActive ? (
          <div className="space-y-5">
            {/* Start Watch Party CTA */}
            <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 text-center space-y-3">
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-normal">
                Start a party and share the link with your girl. Whatever you play, pause, or seek will sync on both devices instantly!
              </p>
              <Button
                size="lg"
                color="danger"
                variant="solid"
                className="w-full bg-[#E50914] hover:bg-[#ff1b26] font-bold text-sm tracking-wide shadow-lg shadow-red-900/40 active:scale-[0.98] transition"
                startContent={<IoSparkles size={18} />}
                onClick={() => party.startParty()}
              >
                Start a Watch Party
              </Button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#111114] px-3 text-[11px] font-bold tracking-wider uppercase text-white/40">
                Or join room
              </span>
            </div>

            {/* Join Room Form */}
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter Code (e.g. SF-7K9A)"
                maxLength={10}
                className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-semibold tracking-wider placeholder:text-white/30 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition"
              />
              <Button
                type="submit"
                variant="flat"
                className="bg-white/15 hover:bg-white/25 text-white font-bold text-sm px-5"
                isDisabled={!joinCodeInput.trim()}
              >
                Join
              </Button>
            </form>
          </div>
        ) : (
          /* State B: Party Active */
          <div className="space-y-4">
            {/* Room Code & Copy Card */}
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/60">Room Code:</span>
                <span className="text-lg font-black tracking-widest text-[#E50914] font-mono">
                  {party.partyRoomId}
                </span>
              </div>

              {/* 1-Click Share Button */}
              <Button
                size="md"
                color="danger"
                variant="solid"
                className="w-full bg-[#E50914] hover:bg-[#ff1b26] font-bold text-xs sm:text-sm tracking-wide shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2"
                onClick={party.copyInviteLink}
              >
                {party.copiedLink ? (
                  <>
                    <IoCheckmark size={18} />
                    <span>Invite Link Copied!</span>
                  </>
                ) : (
                  <>
                    <IoCopyOutline size={18} />
                    <span>Copy Invite Link to Share</span>
                  </>
                )}
              </Button>
            </div>

            {/* Connected Members */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white/70">
                <span>Watching Together:</span>
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {Math.max(party.partyMembers.length, 1)} connected
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {party.partyMembers.length > 0 ? (
                  party.partyMembers.map((m, idx) => (
                    <span
                      key={m.id || idx}
                      className="px-2.5 py-1 rounded-full bg-white/10 text-white/90 text-xs font-medium border border-white/10 flex items-center gap-1.5"
                    >
                      <span>👤 {m.name}</span>
                      {m.isHost && (
                        <span className="text-[10px] text-amber-400 font-bold uppercase">(Host)</span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-white/40 italic">
                    Waiting for partner to join...
                  </span>
                )}
              </div>
            </div>

            {/* Quick Reactions Bar */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                Send Live Reaction:
              </span>
              <div className="flex items-center justify-between gap-1 bg-white/5 border border-white/10 rounded-2xl p-2">
                {reactionEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => party.broadcastReaction(emoji)}
                    className="w-10 h-10 rounded-xl hover:bg-white/15 active:scale-125 transition-transform flex items-center justify-center text-xl cursor-pointer"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Leave Party */}
            <div className="pt-2">
              <Button
                size="sm"
                variant="light"
                color="danger"
                className="w-full text-red-400 hover:text-red-300 font-semibold text-xs flex items-center justify-center gap-1.5"
                startContent={<IoExitOutline size={16} />}
                onClick={() => {
                  party.leaveParty();
                }}
              >
                Leave Watch Party
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

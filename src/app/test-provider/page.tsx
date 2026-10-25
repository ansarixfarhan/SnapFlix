"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Chip, Spinner, Card, CardBody } from '@heroui/react';
import {
  IoPlay,
  IoSearch,
  IoVideocam,
  IoArrowBack,
  IoCheckmarkCircle,
  IoWarning,
  IoDownloadOutline,
  IoCopyOutline,
} from 'react-icons/io5';
import Link from 'next/link';
import Hls from 'hls.js';

interface StreamItem {
  server: string;
  link: string;
  type: string;
  quality?: string;
  headers?: Record<string, string>;
  providerValue?: string;
}

interface ProviderResult {
  providerValue: string;
  providerName: string;
  streams: StreamItem[];
  infoTitle?: string;
}

export default function TestProviderPage() {
  const [query, setQuery] = useState('Inception');
  const [year, setYear] = useState('2010');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [season, setSeason] = useState('1');
  const [episode, setEpisode] = useState('1');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [selectedStream, setSelectedStream] = useState<StreamItem | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const presets = [
    { title: 'Inception', year: '2010', type: 'movie' as const },
    { title: 'Interstellar', year: '2014', type: 'movie' as const },
    { title: 'The Dark Knight', year: '2008', type: 'movie' as const },
    { title: 'Stranger Things', year: '2016', type: 'tv' as const, s: '1', ep: '1' },
    { title: 'Jujutsu Kaisen', year: '2020', type: 'tv' as const, s: '1', ep: '1' },
  ];

  // Helper to get playable stream URL (proxying if m3u8 or headers needed)
  const getPlayableUrl = (stream: StreamItem) => {
    const isHls = stream.type === 'm3u8' || stream.link.includes('.m3u8');
    const hasHeaders = stream.headers && Object.keys(stream.headers).length > 0;

    if (isHls || hasHeaders) {
      const providerApiBase = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.snapflix.indevs.in').replace(/\/$/, '');
      const headersJson = JSON.stringify(stream.headers || {});
      return `${providerApiBase}/api/provider/proxy-stream?url=${encodeURIComponent(
        stream.link
      )}&headers=${encodeURIComponent(headersJson)}`;
    }
    return stream.link;
  };

  // Video playback effect whenever selectedStream changes
  useEffect(() => {
    setPlaybackError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!selectedStream || !videoRef.current) return;

    const streamUrl = getPlayableUrl(selectedStream);
    const isHls = selectedStream.type === 'm3u8' || selectedStream.link.includes('.m3u8');
    const isMkv = selectedStream.type === 'mkv' || selectedStream.link.includes('.mkv');

    if (isMkv) {
      setPlaybackError(
        'MKV is a raw file format that browsers cannot decode directly. Please select an M3U8 or MP4 server below, or copy link to open in VLC.'
      );
      return;
    }

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;

        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch((e) => console.log('Autoplay prevented:', e));
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setPlaybackError('Network error while streaming video segments.');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setPlaybackError('Media decode error. Recovering...');
                hls.recoverMediaError();
                break;
              default:
                setPlaybackError('Stream failed to load on this server.');
                hls.destroy();
                break;
            }
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = streamUrl;
        videoRef.current.play().catch(() => {});
      }
    } else {
      // Direct MP4 or WebM
      videoRef.current.src = streamUrl;
      videoRef.current.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedStream]);

  const handleResolve = async (searchTitle = query, searchYear = year, type = mediaType) => {
    setLoading(true);
    setError(null);
    setPlaybackError(null);
    setResults([]);
    setSelectedStream(null);

    try {
      const params = new URLSearchParams({
        title: searchTitle,
        year: searchYear,
        type,
      });

      if (type === 'tv') {
        params.append('season', season);
        params.append('episode', episode);
      }

      const providerApiBase = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.snapflix.indevs.in').replace(/\/$/, '');
      const res = await fetch(`${providerApiBase}/api/provider/resolve?${params.toString()}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Stream resolution failed');
      }

      setResults(data.results || []);

      if (data.results?.length > 0) {
        // Try to pick an m3u8 or mp4 first so it plays immediately
        let bestStream: StreamItem | null = null;
        let bestProviderName = data.results[0].providerName;

        for (const prov of data.results) {
          const streamable = prov.streams.find(
            (s: StreamItem) =>
              (s.type === 'm3u8' || s.link.includes('.m3u8') || s.type === 'mp4') &&
              (s.server?.toLowerCase().includes('hindi') || prov.infoTitle?.toLowerCase().includes('hindi'))
          );
          if (streamable) {
            bestStream = streamable;
            bestProviderName = prov.providerName;
            break;
          }
        }

        if (!bestStream) {
          for (const prov of data.results) {
            const streamable = prov.streams.find(
              (s: StreamItem) => s.type === 'm3u8' || s.link.includes('.m3u8') || s.type === 'mp4'
            );
            if (streamable) {
              bestStream = streamable;
              bestProviderName = prov.providerName;
              break;
            }
          }
        }

        if (!bestStream && data.results[0].streams?.length > 0) {
          bestStream = data.results[0].streams[0];
        }

        if (bestStream) {
          setSelectedProvider(bestProviderName);
          setSelectedStream(bestStream);
        }
      } else {
        setError('No usable streams returned by active providers for this title.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to connect to provider engine');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-gray-400 hover:text-white transition">
                <IoArrowBack size={20} />
              </Link>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 via-rose-400 to-amber-300 bg-clip-text text-transparent">
                SnapFlix Native Provider Lab
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              HLS.js + Stream Proxy enabled: Web Video Player with App Providers (100% Free)
            </p>
          </div>

          <Chip color="success" variant="flat" size="sm" startContent={<IoCheckmarkCircle />}>
            HLS & Proxy Engine Ready
          </Chip>
        </div>

        {/* Preset Quick Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs text-gray-400 font-medium shrink-0">Try Presets:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(p.title);
                setYear(p.year);
                setMediaType(p.type);
                if (p.type === 'tv' && p.s) {
                  setSeason(p.s);
                  setEpisode(p.ep || '1');
                }
                handleResolve(p.title, p.year, p.type);
              }}
              className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-white/10 transition shrink-0 cursor-pointer"
            >
              {p.title} ({p.year})
            </button>
          ))}
        </div>

        {/* Search Controls */}
        <Card className="bg-[#101014] border border-white/10 shadow-2xl">
          <CardBody className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <Input
                  label="Title"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Inception"
                  variant="bordered"
                  size="sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2010"
                  variant="bordered"
                  size="sm"
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant={mediaType === 'movie' ? 'solid' : 'bordered'}
                  color={mediaType === 'movie' ? 'danger' : 'default'}
                  className="flex-1"
                  onClick={() => setMediaType('movie')}
                >
                  Movie
                </Button>
                <Button
                  size="sm"
                  variant={mediaType === 'tv' ? 'solid' : 'bordered'}
                  color={mediaType === 'tv' ? 'danger' : 'default'}
                  className="flex-1"
                  onClick={() => setMediaType('tv')}
                >
                  TV
                </Button>
              </div>
              <div className="sm:col-span-2">
                <Button
                  color="danger"
                  className="w-full h-full font-bold shadow-lg shadow-red-600/30 min-h-12"
                  isLoading={loading}
                  startContent={!loading && <IoSearch size={18} />}
                  onClick={() => handleResolve()}
                >
                  Resolve
                </Button>
              </div>
            </div>

            {mediaType === 'tv' && (
              <div className="grid grid-cols-2 gap-3 max-w-xs pt-1">
                <Input
                  label="Season"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  variant="bordered"
                  size="sm"
                />
                <Input
                  label="Episode"
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                  variant="bordered"
                  size="sm"
                />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Error message */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Video Player Section */}
        {selectedStream && (
          <div className="space-y-4">
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
              <video
                ref={videoRef}
                controls
                playsInline
                className="w-full h-full object-contain"
                poster="/brand/og-image.png"
              />

              {playbackError && (
                <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                  <IoWarning className="text-amber-400" size={42} />
                  <div className="text-base font-semibold text-white max-w-md">
                    {playbackError}
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      size="sm"
                      variant="flat"
                      color="warning"
                      startContent={<IoCopyOutline />}
                      onClick={() => copyToClipboard(selectedStream.link)}
                    >
                      {isCopied ? 'Copied Link!' : 'Copy Stream Link'}
                    </Button>
                    <a
                      href={selectedStream.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 transition text-white"
                    >
                      <IoDownloadOutline size={14} /> Open Directly
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Stream Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-2">
                <IoVideocam className="text-red-500" size={20} />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {selectedProvider} • {selectedStream.server}
                  </div>
                  <div className="text-xs text-gray-400 break-all line-clamp-1 max-w-lg">
                    {selectedStream.link}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Chip
                  size="sm"
                  variant="flat"
                  color={
                    selectedStream.type === 'm3u8' || selectedStream.link.includes('.m3u8')
                      ? 'success'
                      : selectedStream.type === 'mp4'
                      ? 'primary'
                      : 'warning'
                  }
                >
                  {selectedStream.type.toUpperCase()}
                  {selectedStream.type === 'm3u8' && ' (Web Stream)'}
                  {selectedStream.type === 'mkv' && ' (MKV File)'}
                </Chip>
                {selectedStream.quality && (
                  <Chip size="sm" variant="flat" color="secondary">
                    {selectedStream.quality}
                  </Chip>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resolved Streams & Providers List */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Discovered Provider Streams ({results.length} providers responded)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((res) => (
                <Card key={res.providerValue} className="bg-[#121217] border border-white/10">
                  <CardBody className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-white">{res.providerName}</span>
                      <Chip size="sm" variant="flat" color="primary">
                        {res.streams.length} stream(s)
                      </Chip>
                    </div>

                    {res.infoTitle && (
                      <p className="text-xs text-gray-400 line-clamp-1">Matched: {res.infoTitle}</p>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {res.streams.map((stream, sIdx) => {
                        const isCurrent = selectedStream?.link === stream.link;
                        const isHls = stream.type === 'm3u8' || stream.link.includes('.m3u8');
                        const isMp4 = stream.type === 'mp4' || stream.link.includes('.mp4');

                        return (
                          <button
                            key={sIdx}
                            onClick={() => {
                              setSelectedProvider(res.providerName);
                              setSelectedStream(stream);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                              isCurrent
                                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/40'
                                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <IoPlay size={12} />
                            <span>{stream.server}</span>
                            {stream.quality && (
                              <span className="text-[10px] opacity-75">({stream.quality})</span>
                            )}
                            {isHls && (
                              <span className="text-[9px] px-1 bg-green-500/20 text-green-400 rounded">
                                HLS
                              </span>
                            )}
                            {isMp4 && (
                              <span className="text-[9px] px-1 bg-blue-500/20 text-blue-400 rounded">
                                MP4
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

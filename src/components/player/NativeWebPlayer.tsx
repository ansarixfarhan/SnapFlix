"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  IoPlay,
  IoPause,
  IoVolumeHigh,
  IoVolumeMute,
  IoExpand,
  IoContract,
  IoReload,
  IoArrowBack,
  IoWarning,
  IoLanguageOutline,
  IoCheckmark,
  IoChevronUp,
  IoPlaySkipForward,
  IoTvOutline,
  IoCloudUploadOutline,
  IoSearchOutline,
  IoColorPaletteOutline,
  IoChevronForward,
  IoClose,
} from 'react-icons/io5';
import { MdHighQuality, MdReplay10, MdForward10 } from 'react-icons/md';
import { Spinner, Button } from '@heroui/react';
import { syncHistory } from '@/actions/histories';
import { tmdb } from '@/api/tmdb';

export interface SubtitleItem {
  title: string;
  language: string;
  type?: string;
  uri: string;
}

interface StreamItem {
  server: string;
  link: string;
  type: string;
  quality?: string;
  tag?: string;
  headers?: Record<string, string>;
  providerValue?: string;
  providerName?: string;
  subtitles?: SubtitleItem[];
}

interface ProviderResult {
  providerValue: string;
  providerName: string;
  streams: StreamItem[];
  infoTitle?: string;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  kn: 'Kannada',
  bn: 'Bengali',
  pa: 'Punjabi',
  zh: 'Chinese',
  ru: 'Russian',
  ar: 'Arabic',
  pt: 'Portuguese',
  tr: 'Turkish',
};

export const LANGUAGE_FLAGS: Record<string, string> = {
  English: '🇺🇸',
  Hindi: '🇮🇳',
  Japanese: '🇯🇵',
  Korean: '🇰🇷',
  Spanish: '🇪🇸',
  French: '🇫🇷',
  German: '🇩🇪',
  Italian: '🇮🇹',
  Tamil: '🇮🇳',
  Telugu: '🇮🇳',
  Malayalam: '🇮🇳',
  Kannada: '🇮🇳',
  Bengali: '🇧🇩',
  Punjabi: '🇮🇳',
  Chinese: '🇨🇳',
  Russian: '🇷🇺',
  Arabic: '🇸🇦',
  Turkish: '🇹🇷',
  Portuguese: '🇧🇷',
  Indonesian: '🇮🇩',
  Dutch: '🇳🇱',
  Polish: '🇵🇱',
  Thai: '🇹🇭',
  Vietnamese: '🇻🇳',
  Original: '🇺🇸',
};

export const LANG_CODE_ALIASES: Record<string, string[]> = {
  Hindi: ['hi', 'hin', 'hindi'],
  English: ['en', 'eng', 'english'],
  Tamil: ['ta', 'tam', 'tamil'],
  Telugu: ['te', 'tel', 'telugu'],
  Punjabi: ['pa', 'pan', 'punjabi'],
  Bengali: ['bn', 'ben', 'bengali'],
  Malayalam: ['ml', 'mal', 'malayalam'],
  Kannada: ['kn', 'kan', 'kannada'],
  Japanese: ['ja', 'jpn', 'japanese'],
  Korean: ['ko', 'kor', 'korean'],
  Spanish: ['es', 'spa', 'spanish'],
  French: ['fr', 'fra', 'fre', 'french'],
  German: ['de', 'ger', 'deu', 'german'],
  Italian: ['it', 'ita', 'italian'],
  Russian: ['ru', 'rus', 'russian'],
  Arabic: ['ar', 'ara', 'arabic'],
  Portuguese: ['pt', 'por', 'portuguese'],
  Turkish: ['tr', 'tur', 'turkish'],
  Chinese: ['zh', 'chi', 'zho', 'chinese'],
};

export function parseWordToLanguage(word: string): string | null {
  const s = word.toLowerCase().trim();
  if (!s) return null;
  for (const [lang, aliases] of Object.entries(LANG_CODE_ALIASES)) {
    if (aliases.some((a) => s === a || s.includes(a))) {
      return lang;
    }
  }
  return null;
}

export function getStreamAudioLanguages(
  stream: StreamItem,
  infoTitle?: string,
  originalLanguageCode?: string
): string[] {
  const defaultLang = (originalLanguageCode && LANGUAGE_NAMES[originalLanguageCode]) || 'English';
  const server = (stream.server || '').trim();
  const tag = (stream.tag || '').trim();
  const title = (infoTitle || '').trim().toLowerCase();

  const langs = new Set<string>();

  // 1. Check parentheses in server string: e.g. 'Movy - Delhi (Hindi) (Tamil)' -> ['Hindi', 'Tamil']
  // In MultiStream, the last parenthesis indicates the specific audio track!
  const parenMatches = Array.from(server.matchAll(/\(([^)]+)\)/g)).map((m) => m[1]);
  if (parenMatches.length > 0) {
    // Check if the last parenthesis is a language
    const lastParenLang = parseWordToLanguage(parenMatches[parenMatches.length - 1]);
    if (lastParenLang) {
      langs.add(lastParenLang);
      return Array.from(langs);
    }
    // If last parenthesis was resolution (e.g. '(Hindi) (1080p)' or '(Hindi) (2160p)'), check previous
    for (let i = parenMatches.length - 2; i >= 0; i--) {
      const match = parseWordToLanguage(parenMatches[i]);
      if (match) {
        langs.add(match);
        return Array.from(langs);
      }
    }
  }

  // 2. Direct language check in server name or tag (excluding 'multi' resolution descriptors)
  const directServerLang = parseWordToLanguage(server) || parseWordToLanguage(tag);
  if (directServerLang) {
    langs.add(directServerLang);
    return Array.from(langs);
  }

  // 3. 'Original' / 'Original Audio' -> movie's original language (e.g. MovieBox)
  const sLower = server.toLowerCase();
  if (sLower.includes('original')) {
    langs.add(defaultLang);
    return Array.from(langs);
  }

  // 4. Release title check (e.g. 'Fight Club Dual Audio [Hindi - English]')
  if (title.includes('dual audio') || title.includes('dual-audio')) {
    langs.add('Hindi');
    langs.add('English');
  } else {
    const titleLang = parseWordToLanguage(title);
    if (titleLang) {
      langs.add(titleLang);
    }
  }

  // Fallback to defaultLang if no specific language tag is detected
  if (langs.size === 0) {
    langs.add(defaultLang);
  }

  return Array.from(langs);
}

export interface EpisodeItem {
  episode_number: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  vote_average?: number;
  air_date?: string;
  runtime?: number;
}

interface NativeWebPlayerProps {
  tmdbId: number;
  title: string;
  year?: number | string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  episodeTitle?: string;
  episodes?: EpisodeItem[];
  hasNextEpisode?: boolean;
  onNextEpisode?: () => void;
  onSelectEpisode?: (seasonNum: number, episodeNum: number) => void;
  initialTime?: number;
  originalLanguage?: string;
  contentRating?: string;
  ratingAdvisory?: string;
  onBack?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function NativeWebPlayer({
  tmdbId,
  title,
  year,
  type,
  season,
  episode,
  episodeTitle,
  episodes,
  hasNextEpisode,
  onNextEpisode,
  onSelectEpisode,
  initialTime = 0,
  originalLanguage,
  contentRating,
  ratingAdvisory,
  onBack,
}: NativeWebPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // States
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [providerResults, setProviderResults] = useState<ProviderResult[]>([]);
  const [selectedStream, setSelectedStream] = useState<StreamItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showAudioDrawer, setShowAudioDrawer] = useState(false);
  const [showEpisodesTray, setShowEpisodesTray] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [selectedEpisodeChunk, setSelectedEpisodeChunk] = useState(0);
  const activeEpisodeRef = useRef<HTMLDivElement | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // YouTube-Style Double-Tap Seek States & Timers
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTouchXRef = useRef<number | null>(null);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerDoubleTapFeedback = useCallback((side: 'left' | 'right') => {
    setDoubleTapSide(side);
    if (doubleTapDismissTimerRef.current) clearTimeout(doubleTapDismissTimerRef.current);
    doubleTapDismissTimerRef.current = setTimeout(() => {
      setDoubleTapSide(null);
    }, 650);
  }, []);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      if (doubleTapDismissTimerRef.current) clearTimeout(doubleTapDismissTimerRef.current);
    };
  }, []);

  // Dynamic TMDB Content Rating & Advisory
  const [apiRating, setApiRating] = useState<string | null>(null);
  const [apiAdvisory, setApiAdvisory] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchRatings() {
      if (!tmdbId) return;
      try {
        let cert: string | undefined;
        let genresList: string[] = [];

        if (type === 'tv') {
          const [ratingsRes, detailsRes] = await Promise.allSettled([
            tmdb.tvShows.contentRatings(tmdbId),
            tmdb.tvShows.details(tmdbId),
          ]);

          if (ratingsRes.status === 'fulfilled' && ratingsRes.value?.results) {
            const results = ratingsRes.value.results;
            const inRating = results.find((r) => r.iso_3166_1 === 'IN')?.rating;
            const usRating = results.find((r) => r.iso_3166_1 === 'US')?.rating;
            const gbRating = results.find((r) => r.iso_3166_1 === 'GB')?.rating;
            const anyRating = results.find((r) => Boolean(r.rating?.trim()))?.rating;
            cert = inRating || usRating || gbRating || anyRating;
          }

          if (detailsRes.status === 'fulfilled' && detailsRes.value?.genres) {
            genresList = detailsRes.value.genres.map((g) => g.name);
          }
        } else {
          const [releaseDatesRes, detailsRes] = await Promise.allSettled([
            tmdb.movies.releaseDates(tmdbId),
            tmdb.movies.details(tmdbId),
          ]);

          if (releaseDatesRes.status === 'fulfilled' && releaseDatesRes.value?.results) {
            const results = releaseDatesRes.value.results;
            const getCertForCountry = (cc: string) => {
              const country = results.find((r) => r.iso_3166_1 === cc);
              return country?.release_dates.find((d) => d.certification?.trim())?.certification?.trim();
            };
            cert =
              getCertForCountry('IN') ||
              getCertForCountry('US') ||
              getCertForCountry('GB') ||
              results.flatMap((r) => r.release_dates).find((d) => d.certification?.trim())?.certification?.trim();
          }

          if (detailsRes.status === 'fulfilled' && detailsRes.value?.genres) {
            genresList = detailsRes.value.genres.map((g) => g.name);
          }
        }

        if (isCancelled) return;

        // Build dynamic descriptors based on cert and genres
        const descriptors: string[] = [];
        const isAdultOrMature =
          cert &&
          ['R', 'TV-MA', 'NC-17', '18', '18+', 'A'].some((m) =>
            cert?.toUpperCase().includes(m)
          );
        const isTeen =
          cert &&
          ['PG-13', 'TV-14', '16', '16+', 'U/A 16+'].some((m) =>
            cert?.toUpperCase().includes(m)
          );

        if (genresList.some((g) => ['Action', 'Adventure', 'War'].includes(g))) {
          descriptors.push(isAdultOrMature ? 'Graphic Violence' : 'Intense Action');
        }
        if (genresList.some((g) => ['Horror', 'Thriller', 'Mystery'].includes(g))) {
          descriptors.push('Disturbing Scenes, Fear');
        }
        if (genresList.some((g) => ['Crime', 'Drama'].includes(g))) {
          descriptors.push(isAdultOrMature ? 'Criminal Themes, Substance Use' : 'Mature Themes');
        }
        if (genresList.some((g) => ['Comedy', 'Romance'].includes(g))) {
          descriptors.push(isAdultOrMature ? 'Crude Humor, Coarse Language' : 'Suggestive Dialogue');
        }
        if (genresList.some((g) => ['Animation', 'Family', 'Fantasy'].includes(g))) {
          descriptors.push('Fantasy Peril');
        }

        if (descriptors.length === 0) {
          if (isAdultOrMature) {
            descriptors.push('Mature Themes', 'Coarse Language', 'Violence');
          } else if (isTeen) {
            descriptors.push('Violence', 'Some Language', 'Suggestive Themes');
          } else {
            descriptors.push('Mild Action', 'Thematic Elements');
          }
        }

        if (cert) {
          const formattedCert = cert.startsWith('Rated') ? cert : `Rated ${cert}`;
          setApiRating(formattedCert);
        } else if (isAdultOrMature) {
          setApiRating('Rated 18+');
        } else if (isTeen) {
          setApiRating('Rated 16+');
        } else {
          setApiRating('Rated 13+');
        }

        setApiAdvisory(Array.from(new Set(descriptors)).slice(0, 3).join(', '));
      } catch (err) {
        console.warn('Failed to fetch TMDB rating:', err);
      }
    }

    fetchRatings();
    return () => {
      isCancelled = true;
    };
  }, [tmdbId, type]);

  // Netflix-style Content Rating & Advisory
  const resolvedRating = useMemo(() => {
    if (contentRating) return contentRating.startsWith('Rated') ? contentRating : `Rated ${contentRating}`;
    if (apiRating) return apiRating;
    return 'Rated 16+';
  }, [contentRating, apiRating]);

  const resolvedAdvisory = useMemo(() => {
    if (ratingAdvisory) return ratingAdvisory;
    if (apiAdvisory) return apiAdvisory;
    return 'Violence, Language, Suggestive Themes';
  }, [ratingAdvisory, apiAdvisory]);

  const [loadingQuote, setLoadingQuote] = useState('Body pillow sold separately.');
  useEffect(() => {
    const quotes = [
      'Body pillow sold separately.',
      'Summoning multi-server stream nodes...',
      'Connecting to high-speed cloud clusters...',
      'Optimizing audio streams & video buffers...',
      'Finding the clearest 1080p stream for you...',
    ];
    setLoadingQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, [tmdbId, season, episode]);

  // Sync selected episode chunk and auto-scroll when drawer opens
  useEffect(() => {
    if (episode && episodes && episodes.length > 0) {
      const chunkIdx = Math.max(0, Math.floor((episode - 1) / 25));
      setSelectedEpisodeChunk(chunkIdx);
    }
  }, [episode, episodes, showEpisodesTray]);

  useEffect(() => {
    if (showEpisodesTray && activeEpisodeRef.current) {
      const timer = setTimeout(() => {
        activeEpisodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showEpisodesTray, selectedEpisodeChunk]);

  // Audio & Multi-Track States
  const resumeTimeRef = useRef<number | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<string>('English');
  const [hlsAudioTracks, setHlsAudioTracks] = useState<any[]>([]);
  const [currentHlsAudioTrack, setCurrentHlsAudioTrack] = useState<number>(-1);

  // Subtitle States
  const [hlsSubtitles, setHlsSubtitles] = useState<any[]>([]);
  const [uploadedSubtitles, setUploadedSubtitles] = useState<Array<{ id: string; title: string; uri: string; language?: string }>>([]);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string>('off');
  const [activeSubtitleUri, setActiveSubtitleUri] = useState<string | null>(null);
  const [activeSubtitleLang, setActiveSubtitleLang] = useState<string>('en');
  const [activeSubtitleLabel, setActiveSubtitleLabel] = useState<string>('Subtitles');

  // Subtitle Modal Sub-views ('main' | 'search' | 'appearance')
  const [subModalTab, setSubModalTab] = useState<'main' | 'search' | 'appearance'>('main');
  const [subSearchQuery, setSubSearchQuery] = useState<string>('');
  const [subSearchResults, setSubSearchResults] = useState<any[]>([]);
  const [isSearchingSubs, setIsSearchingSubs] = useState<boolean>(false);

  // Subtitle Appearance Customization
  const [subFontSize, setSubFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [subColor, setSubColor] = useState<'white' | 'yellow'>('white');
  const [subBg, setSubBg] = useState<'dark' | 'transparent'>('dark');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quality & Multi-Bitrate States
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [hlsLevels, setHlsLevels] = useState<any[]>([]);
  const [currentHlsLevel, setCurrentHlsLevel] = useState<number>(-1);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const qualityMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to detect touch devices
  const isTouchDevice = () => {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0 || !window.matchMedia('(hover: hover)').matches);
  };

  const handleQualityMouseEnter = () => {
    if (isTouchDevice()) return;
    if (qualityMenuTimeoutRef.current) clearTimeout(qualityMenuTimeoutRef.current);
    if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
    if (nextEpPreviewTimeoutRef.current) clearTimeout(nextEpPreviewTimeoutRef.current);
    setShowAudioDrawer(false);
    setShowNextEpPreview(false);
    setShowQualityMenu(true);
    triggerControls();
  };

  const handleQualityMouseLeave = () => {
    if (isTouchDevice()) return;
    if (qualityMenuTimeoutRef.current) clearTimeout(qualityMenuTimeoutRef.current);
    qualityMenuTimeoutRef.current = setTimeout(() => {
      setShowQualityMenu(false);
    }, 150);
  };

  // Close quality menu on click outside (support both touch and mouse with pointerdown)
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
    };
    if (showQualityMenu) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showQualityMenu]);

  // Audio Dropdown Popover Ref & Handlers
  const audioMenuRef = useRef<HTMLDivElement>(null);
  const audioMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleAudioMouseEnter = () => {
    if (isTouchDevice()) return;
    if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
    if (qualityMenuTimeoutRef.current) clearTimeout(qualityMenuTimeoutRef.current);
    if (nextEpPreviewTimeoutRef.current) clearTimeout(nextEpPreviewTimeoutRef.current);
    setShowQualityMenu(false);
    setShowNextEpPreview(false);
    setShowAudioDrawer(true);
    triggerControls();
  };

  const handleAudioMouseLeave = () => {
    if (isTouchDevice()) return;
    if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
    audioMenuTimeoutRef.current = setTimeout(() => {
      setShowAudioDrawer(false);
    }, 150);
  };

  // Close audio menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setShowAudioDrawer(false);
      }
    };
    if (showAudioDrawer) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showAudioDrawer]);

  // Next Episode Preview Popover Ref & Handlers
  const nextEpPreviewRef = useRef<HTMLDivElement>(null);
  const nextEpPreviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showNextEpPreview, setShowNextEpPreview] = useState(false);

  const nextEpisodeData = useMemo(() => {
    if (!episodes || !episode) return null;
    return episodes.find((e) => e.episode_number === episode + 1) || null;
  }, [episodes, episode]);

  const handleNextEpMouseEnter = () => {
    if (isTouchDevice()) return;
    if (nextEpPreviewTimeoutRef.current) clearTimeout(nextEpPreviewTimeoutRef.current);
    if (qualityMenuTimeoutRef.current) clearTimeout(qualityMenuTimeoutRef.current);
    if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
    setShowQualityMenu(false);
    setShowAudioDrawer(false);
    setShowNextEpPreview(true);
    triggerControls();
  };

  const handleNextEpMouseLeave = () => {
    if (isTouchDevice()) return;
    if (nextEpPreviewTimeoutRef.current) clearTimeout(nextEpPreviewTimeoutRef.current);
    nextEpPreviewTimeoutRef.current = setTimeout(() => {
      setShowNextEpPreview(false);
    }, 150);
  };

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (nextEpPreviewRef.current && !nextEpPreviewRef.current.contains(e.target as Node)) {
        setShowNextEpPreview(false);
      }
    };
    if (showNextEpPreview) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showNextEpPreview]);

  // Available spoken languages across all servers (e.g. English, Hindi, Japanese)
  const availableLanguages = useMemo(() => {
    const counts = new Map<string, number>();
    providerResults.forEach((prov) => {
      prov.streams.forEach((s) => {
        // Only count playable streams (m3u8 or mp4, not raw mkv)
        const isPlayable =
          (s.type === 'm3u8' || s.link?.includes('.m3u8') || s.type === 'mp4') &&
          s.type !== 'mkv' &&
          !s.link?.toLowerCase().endsWith('.mkv');
        if (!isPlayable) return;

        const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
        langs.forEach((lang) => {
          counts.set(lang, (counts.get(lang) || 0) + 1);
        });
      });
    });

    // Also include live HLS internal audio tracks if available
    if (hlsAudioTracks.length > 0) {
      hlsAudioTracks.forEach((track) => {
        const langName = parseWordToLanguage(track.name || track.lang || '');
        if (langName && !counts.has(langName)) {
          counts.set(langName, 1);
        }
      });
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [providerResults, originalLanguage, hlsAudioTracks]);

  // Keep activeLanguage in sync with current stream
  useEffect(() => {
    if (!selectedStream) return;
    const currentProv = providerResults.find((p) => p.providerName === selectedStream.providerName);
    const langs = getStreamAudioLanguages(selectedStream, currentProv?.infoTitle, originalLanguage);
    if (langs.length > 0 && !langs.includes(activeLanguage)) {
      setActiveLanguage(langs[0]);
    }
  }, [selectedStream, providerResults, originalLanguage]);

  // Instant Audio Switcher Handler: switches audio immediately without redirecting to servers list
  const handleSelectLanguage = (targetLang: string) => {
    setActiveLanguage(targetLang);

    // 1. Check if current playing HLS has an internal multi-track matching targetLang
    if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 1) {
      const aliases = LANG_CODE_ALIASES[targetLang] || [targetLang.toLowerCase()];
      const trackIdx = hlsRef.current.audioTracks.findIndex((t: any) => {
        const tLang = (t.lang || '').toLowerCase();
        const tName = (t.name || '').toLowerCase();
        return aliases.some((a) => tLang === a || tName.includes(a));
      });
      if (trackIdx !== -1) {
        hlsRef.current.audioTrack = trackIdx;
        setCurrentHlsAudioTrack(trackIdx);
        setTimeout(() => setShowAudioDrawer(false), 300);
        return;
      }
    }

    // 2. Check if currently playing stream ALREADY belongs to targetLang
    if (selectedStream) {
      const currentProv = providerResults.find((p) => p.providerName === selectedStream.providerName);
      const currentStreamLangs = getStreamAudioLanguages(
        selectedStream,
        currentProv?.infoTitle,
        originalLanguage
      );
      if (currentStreamLangs.includes(targetLang)) {
        setTimeout(() => setShowAudioDrawer(false), 200);
        return;
      }
    }

    // 3. Find best playable stream supporting targetLang across providers
    let candidateStream: StreamItem | null = null;

    // A. Prioritize CURRENT provider first to avoid unnecessary provider switching
    if (selectedStream) {
      const currentProv = providerResults.find((p) => p.providerName === selectedStream.providerName);
      if (currentProv) {
        const match = currentProv.streams.find((s) => {
          const isPlayable =
            (s.type === 'm3u8' || s.link?.includes('.m3u8') || s.type === 'mp4') &&
            s.type !== 'mkv' &&
            !s.link?.toLowerCase().endsWith('.mkv');
          if (!isPlayable) return false;
          const langs = getStreamAudioLanguages(s, currentProv.infoTitle, originalLanguage);
          return langs.includes(targetLang);
        });
        if (match) {
          candidateStream = { ...match, providerName: currentProv.providerName };
        }
      }
    }

    // B. If current provider doesn't have targetLang, check remaining providers
    if (!candidateStream) {
      for (const prov of providerResults) {
        const match = prov.streams.find((s) => {
          const isPlayable =
            (s.type === 'm3u8' || s.link?.includes('.m3u8') || s.type === 'mp4') &&
            s.type !== 'mkv' &&
            !s.link?.toLowerCase().endsWith('.mkv');
          if (!isPlayable) return false;
          const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
          return langs.includes(targetLang);
        });
        if (match) {
          candidateStream = { ...match, providerName: prov.providerName };
          break;
        }
      }
    }

    if (candidateStream && candidateStream.link !== selectedStream?.link) {
      resumeTimeRef.current = videoRef.current?.currentTime || currentTime || 0;
      setSelectedStream(candidateStream);
      setTimeout(() => setShowAudioDrawer(false), 350);
      return;
    }

    // Close drawer after short visual confirmation so user sees checkmark
    setTimeout(() => {
      setShowAudioDrawer(false);
    }, 350);
  };

  // Aggregated qualities across all providers for CURRENT activeLanguage
  const availableQualities = useMemo(() => {
    const discovered = new Set<string>();

    // 1. Check in-stream HLS levels
    if (hlsLevels.length > 1) {
      hlsLevels.forEach((lvl) => {
        const h = lvl.height || 0;
        if (h >= 2000) discovered.add('2160p');
        else if (h >= 1000) discovered.add('1080p');
        else if (h >= 700) discovered.add('720p');
        else if (h >= 450) discovered.add('480p');
        else if (h > 0) discovered.add('360p');
      });
    }

    // 2. Check all playable streams matching activeLanguage
    providerResults.forEach((prov) => {
      prov.streams.forEach((s) => {
        const isPlayable =
          (s.type === 'm3u8' || s.link?.includes('.m3u8') || s.type === 'mp4') &&
          s.type !== 'mkv' &&
          !s.link?.toLowerCase().endsWith('.mkv');
        if (!isPlayable) return;

        const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
        if (!langs.includes(activeLanguage)) return;

        const q = (s.quality || '').toLowerCase();
        const serverText = (s.server || '').toLowerCase();

        if (q.includes('2160') || q.includes('4k') || serverText.includes('4k') || serverText.includes('2160')) {
          discovered.add('2160p');
        }
        if (q.includes('1080') || serverText.includes('1080')) {
          discovered.add('1080p');
        }
        if (q.includes('720') || serverText.includes('720')) {
          discovered.add('720p');
        }
        if (q.includes('480') || serverText.includes('480')) {
          discovered.add('480p');
        }
        if (q.includes('360') || serverText.includes('360')) {
          discovered.add('360p');
        }
      });
    });

    const options: { key: string; label: string; badge?: string }[] = [
      { key: 'auto', label: 'Auto', badge: 'Optimal' },
    ];

    if (discovered.has('2160p')) {
      options.push({ key: '2160p', label: '4K', badge: 'Ultra HD' });
    }
    if (discovered.has('1080p') || options.length === 1) {
      options.push({ key: '1080p', label: '1080p', badge: 'FHD' });
    }
    if (discovered.has('720p')) {
      options.push({ key: '720p', label: '720p', badge: 'HD' });
    }
    if (discovered.has('480p')) {
      options.push({ key: '480p', label: '480p', badge: 'SD' });
    } else if (discovered.has('360p')) {
      options.push({ key: '360p', label: '360p', badge: 'Data Saver' });
    }

    return options;
  }, [hlsLevels, providerResults, activeLanguage, originalLanguage]);

  // Handle Quality Selection (Strictly preserves currently active audio language)
  const handleSelectQuality = (targetQuality: string) => {
    setSelectedQuality(targetQuality);
    setShowQualityMenu(false);

    if (targetQuality === 'auto') {
      if (hlsRef.current) {
        hlsRef.current.currentLevel = -1; // Auto ABR
        setCurrentHlsLevel(-1);
      }
      return;
    }

    const targetHeight = parseInt(targetQuality.replace('p', ''), 10);
    if (isNaN(targetHeight)) return;

    // 1. In-stream HLS level switch (instant, zero reload)
    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 1) {
      const levelIdx = hlsRef.current.levels.findIndex(
        (lvl: any) => lvl.height === targetHeight || Math.abs((lvl.height || 0) - targetHeight) <= 50
      );
      if (levelIdx !== -1) {
        hlsRef.current.currentLevel = levelIdx;
        setCurrentHlsLevel(levelIdx);
        return;
      }
    }

    // 2. Cross-server switch: find best stream matching ACTIVE AUDIO LANGUAGE + target quality
    let candidate: StreamItem | null = null;
    for (const prov of providerResults) {
      const match = prov.streams.find((s) => {
        const isPlayable =
          (s.type === 'm3u8' || s.link?.includes('.m3u8') || s.type === 'mp4') &&
          s.type !== 'mkv' &&
          !s.link?.toLowerCase().endsWith('.mkv');
        if (!isPlayable) return false;

        // STRICT AUDIO LANGUAGE MATCH:
        const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
        if (!langs.includes(activeLanguage)) return false;

        // Quality match:
        const qNum = parseInt(s.quality || '', 10);
        const serverHasQ =
          s.server?.toLowerCase().includes(`${targetHeight}p`) ||
          s.server?.toLowerCase().includes(String(targetHeight));
        return qNum === targetHeight || serverHasQ;
      });

      if (match) {
        candidate = { ...match, providerName: prov.providerName };
        break;
      }
    }

    if (candidate && candidate.link !== selectedStream?.link) {
      resumeTimeRef.current = videoRef.current?.currentTime || currentTime || 0;
      setSelectedStream(candidate);
    }
  };

  // Aggregated Subtitles across active provider stream + HLS tracks + uploaded tracks
  const availableSubtitles = useMemo(() => {
    const list: Array<{ id: string; title: string; language?: string; uri?: string; hlsIndex?: number }> = [];

    // 1. From active provider's stream
    if (selectedStream?.subtitles && Array.isArray(selectedStream.subtitles)) {
      selectedStream.subtitles.forEach((s, idx) => {
        list.push({
          id: `provider-${idx}-${s.uri || s.language}`,
          title: s.title || s.language || `Subtitle ${idx + 1}`,
          language: s.language,
          uri: s.uri,
        });
      });
    }

    // 2. From HLS stream internal tracks
    hlsSubtitles.forEach((track, idx) => {
      const name = track.name || track.lang || `Track ${idx + 1}`;
      if (!list.some(s => s.title.toLowerCase() === name.toLowerCase())) {
        list.push({
          id: `hls-${idx}`,
          title: name,
          language: track.lang,
          hlsIndex: idx,
        });
      }
    });

    // 3. User uploaded / searched subtitles
    uploadedSubtitles.forEach(s => list.push(s));

    return list;
  }, [selectedStream, hlsSubtitles, uploadedSubtitles]);

  // Handle Subtitle Selection
  const handleSelectSubtitle = (subId: string) => {
    setActiveSubtitleId(subId);

    if (subId === 'off') {
      setActiveSubtitleUri(null);
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = -1;
        hlsRef.current.subtitleDisplay = false;
      }
      if (videoRef.current) {
        for (let i = 0; i < videoRef.current.textTracks.length; i++) {
          videoRef.current.textTracks[i].mode = 'disabled';
        }
      }
      return;
    }

    const targetSub = availableSubtitles.find(s => s.id === subId);
    if (!targetSub) return;

    if (targetSub.hlsIndex !== undefined && hlsRef.current) {
      setActiveSubtitleUri(null);
      hlsRef.current.subtitleTrack = targetSub.hlsIndex;
      hlsRef.current.subtitleDisplay = true;
    } else if (targetSub.uri) {
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = -1;
        hlsRef.current.subtitleDisplay = false;
      }
      let playableUri = targetSub.uri;
      if (playableUri.includes('.opensubtitles.org') || playableUri.endsWith('.srt') || playableUri.endsWith('.gz')) {
        playableUri = `/api/subtitles/download?url=${encodeURIComponent(targetSub.uri)}`;
      }
      setActiveSubtitleUri(playableUri);
      setActiveSubtitleLang(targetSub.language || 'en');
      setActiveSubtitleLabel(targetSub.title);

      setTimeout(() => {
        if (videoRef.current && videoRef.current.textTracks.length > 0) {
          videoRef.current.textTracks[0].mode = 'showing';
        }
      }, 100);
    }
  };

  // Upload Subtitle File (.srt or .vtt)
  const handleUploadSubtitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let content = event.target?.result as string;
      if (!content) return;

      if (file.name.endsWith('.srt')) {
        content = 'WEBVTT\n\n' + content
          .replace(/\r\n|\r/g, '\n')
          .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      }

      const blob = new Blob([content], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      const newSub = {
        id: `upload-${Date.now()}`,
        title: file.name.replace(/\.(srt|vtt)$/i, ''),
        uri: url,
        language: 'Custom',
      };

      setUploadedSubtitles(prev => [...prev, newSub]);
      handleSelectSubtitle(newSub.id);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Search Online Subtitles
  const handleSearchSubtitles = async (q: string) => {
    if (!q.trim()) return;
    setIsSearchingSubs(true);
    try {
      const params = new URLSearchParams({
        query: q,
      });
      if (type === 'tv') {
        if (season) params.append('season', String(season));
        if (episode) params.append('episode', String(episode));
      }
      const res = await fetch(`/api/subtitles/search?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setSubSearchResults(data.results);
      } else {
        setSubSearchResults([]);
      }
    } catch (err) {
      setSubSearchResults([]);
    } finally {
      setIsSearchingSubs(false);
    }
  };

  // Smart Auto Failover to alternative server if current server fails or stalls
  const handleAutoFailover = useCallback(() => {
    if (!selectedStream || providerResults.length === 0) return false;

    for (const prov of providerResults) {
      const altMatch = prov.streams.find((s) => {
        const isPlayable =
          (s.type === 'm3u8' || s.link?.includes('.m3u8') || s.type === 'mp4') &&
          s.type !== 'mkv' &&
          !s.link?.toLowerCase().endsWith('.mkv') &&
          s.link !== selectedStream.link;
        if (!isPlayable) return false;

        const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
        return langs.includes(activeLanguage);
      });

      if (altMatch) {
        console.log(`[Player] Auto-failover to alternative server: ${prov.providerName} (${altMatch.server})`);
        resumeTimeRef.current = videoRef.current?.currentTime || currentTime || 0;
        setSelectedStream({ ...altMatch, providerName: prov.providerName });
        return true;
      }
    }
    return false;
  }, [selectedStream, providerResults, activeLanguage, originalLanguage, currentTime]);

  // Compute first playable stream (for quick-switch when MKV or error occurs)
  const firstPlayableStream = useMemo(() => {
    for (const prov of providerResults) {
      const match = prov.streams.find(
        (s) =>
          (s.type === 'm3u8' || s.link?.includes('.m3u8') || s.type === 'mp4') &&
          s.type !== 'mkv' &&
          !s.link?.toLowerCase().endsWith('.mkv')
      );
      if (match) {
        return { ...match, providerName: prov.providerName };
      }
    }
    return null;
  }, [providerResults]);

  // 1. Fetch available streams on mount
  useEffect(() => {
    let active = true;
    const fetchStreams = async () => {
      setLoadingStreams(true);
      setError(null);
      setSelectedStream(null);

      try {
        const params = new URLSearchParams({
          tmdbId: String(tmdbId),
          title: title || '',
          year: year ? String(year) : '',
          type,
        });

        if (type === 'tv') {
          if (season) params.append('season', String(season));
          if (episode) params.append('episode', String(episode));
        }

        const res = await fetch(`/api/provider/resolve?${params.toString()}`);
        const data = await res.json();

        if (!active) return;

        if (!data.success || !data.results || data.results.length === 0) {
          throw new Error(data.message || 'No stream available from active providers.');
        }

        setProviderResults(data.results);

        // Pick the best streamable stream (m3u8 or mp4) - strictly ignore mkv
        let chosen: StreamItem | null = null;
        for (const prov of data.results) {
          const match = prov.streams.find(
            (s: StreamItem) =>
              (s.type === 'm3u8' || s.link?.includes('.m3u8') || s.type === 'mp4') &&
              s.type !== 'mkv' &&
              !s.link?.toLowerCase().endsWith('.mkv')
          );
          if (match) {
            chosen = { ...match, providerName: prov.providerName };
            break;
          }
        }

        if (!chosen && data.results[0]?.streams?.length > 0) {
          chosen = {
            ...data.results[0].streams[0],
            providerName: data.results[0].providerName,
          };
        }

        setSelectedStream(chosen);

        // Background progressive resolver: continues testing and resolving remaining providers in the background while video is playing
        setTimeout(async () => {
          if (!active) return;
          try {
            const bgParams = new URLSearchParams(params);
            bgParams.append('refresh', 'true');
            const bgRes = await fetch(`/api/provider/resolve?${bgParams.toString()}`);
            const bgData = await bgRes.json();
            if (active && bgData.success && Array.isArray(bgData.results)) {
              setProviderResults((prev) => {
                const merged = [...prev];
                for (const newP of bgData.results) {
                  const existingIdx = merged.findIndex((m) => m.providerValue === newP.providerValue);
                  if (existingIdx === -1) {
                    merged.push(newP);
                  } else {
                    const existingStreams = merged[existingIdx].streams;
                    const added = newP.streams.filter(
                      (ns: any) => !existingStreams.some((es: any) => es.link === ns.link)
                    );
                    if (added.length > 0) {
                      merged[existingIdx] = {
                        ...merged[existingIdx],
                        streams: [...existingStreams, ...added],
                      };
                    }
                  }
                }
                return merged;
              });
            }
          } catch (bgErr) {
            console.warn('[Player] Background provider resolution check:', bgErr);
          }
        }, 3000);
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Failed to discover provider streams.');
        }
      } finally {
        if (active) setLoadingStreams(false);
      }
    };

    fetchStreams();
    return () => {
      active = false;
    };
  }, [tmdbId, title, year, type, season, episode]);

  // 2. Playable URL with Proxy rewrite
  const getPlayableUrl = useCallback((stream: StreamItem) => {
    const isHls = stream.type === 'm3u8' || stream.link.includes('.m3u8');
    const hasHeaders = stream.headers && Object.keys(stream.headers).length > 0;

    if (isHls || hasHeaders) {
      const headersJson = JSON.stringify(stream.headers || {});
      return `/api/provider/proxy-stream?url=${encodeURIComponent(
        stream.link
      )}&headers=${encodeURIComponent(headersJson)}`;
    }
    return stream.link;
  }, []);

  // 3. Attach stream to Video element
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

    const seekTo = resumeTimeRef.current !== null ? resumeTimeRef.current : (initialTime || 0);
    resumeTimeRef.current = null;

    if (isMkv) {
      setPlaybackError(
        'MKV format detected. Web browsers cannot decode raw MKV files. Please choose another server from the Servers menu below.'
      );
      return;
    }

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          capLevelToPlayerSize: true,
          startLevel: -1,
          autoStartLoad: true,
          maxBufferLength: 15,
          maxMaxBufferLength: 30,
          maxBufferSize: 30 * 1000 * 1000,
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 5,
        });
        hlsRef.current = hls;

        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (seekTo > 0 && videoRef.current) {
            videoRef.current.currentTime = seekTo;
          }
          videoRef.current?.play().catch(() => { });

          if (data?.levels && data.levels.length > 0) {
            setHlsLevels(data.levels);
            setCurrentHlsLevel(hls.currentLevel);
          } else if (hls.levels && hls.levels.length > 0) {
            setHlsLevels(hls.levels);
            setCurrentHlsLevel(hls.currentLevel);
          }

          if (hls.audioTracks && hls.audioTracks.length > 0) {
            setHlsAudioTracks(hls.audioTracks);
            setCurrentHlsAudioTrack(hls.audioTrack);
          }

          if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
            setHlsSubtitles(hls.subtitleTracks);
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          setCurrentHlsLevel(data.level);
        });

        hls.on(Hls.Events.LEVELS_UPDATED, (_event, data) => {
          if (data.levels) {
            setHlsLevels(data.levels);
          }
        });

        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => {
          setCurrentHlsAudioTrack(data.id);
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
          if (data.audioTracks) {
            setHlsAudioTracks(data.audioTracks);
            setCurrentHlsAudioTrack(hls.audioTrack);
          }
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
          if (data?.subtitleTracks) {
            setHlsSubtitles(data.subtitleTracks);
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (!handleAutoFailover()) {
                  hls.startLoad();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                if (!handleAutoFailover()) {
                  setPlaybackError('Stream failed to load on this server. Please choose another server or player.');
                  hls.destroy();
                }
                break;
            }
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = streamUrl;
        if (seekTo > 0) videoRef.current.currentTime = seekTo;
        videoRef.current.play().catch(() => { });
      }
    } else {
      videoRef.current.src = streamUrl;
      if (seekTo > 0) videoRef.current.currentTime = seekTo;
      videoRef.current.play().catch(() => { });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedStream, getPlayableUrl, initialTime]);

  // 4. Supabase Watch History Periodic Sync
  useEffect(() => {
    if (!isPlaying || currentTime <= 5 || duration <= 0) return;

    const syncInterval = setInterval(() => {
      syncHistory({
        event: 'timeupdate',
        mediaId: tmdbId,
        mediaType: type,
        currentTime: Math.floor(currentTime),
        duration: Math.floor(duration),
        season: type === 'tv' ? season : undefined,
        episode: type === 'tv' ? episode : undefined,
      }).catch(() => { });
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [isPlaying, currentTime, duration, tmdbId, type, season, episode]);

  // 5. Controls Visibility Auto-hide & Screen Tap Toggle
  const triggerControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  }, [isPlaying]);

  // Skip Seconds
  const skip = (sec: number, autoTriggerControls: boolean = true) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + sec));
    if (autoTriggerControls) {
      triggerControls();
    }
  };

  // Screen click toggles player buttons visibility (hide if visible, show if hidden) - NEVER plays/pauses on screen tap
  // YouTube-Style: Double-tap on right half skips +10s, double-tap on left half rewinds -10s
  const handleContainerClick = (e: React.MouseEvent) => {
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    const clientX =
      e.clientX > 0
        ? e.clientX
        : lastTouchXRef.current ?? (rect ? rect.left + rect.width / 2 : 0);
    const containerWidth = rect?.width || (typeof window !== 'undefined' ? window.innerWidth : 800);
    const isRightHalf = rect ? clientX - rect.left > containerWidth / 2 : true;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    // Double tap detected (< 320ms between taps) -> Seek 10s and keep all player buttons hidden
    if (timeSinceLastTap < 320) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      // Keep player buttons hidden on double-tap
      setShowControls(false);
      setShowQualityMenu(false);
      setShowAudioDrawer(false);
      setShowNextEpPreview(false);

      if (isRightHalf) {
        skip(10, false);
        triggerDoubleTapFeedback('right');
      } else {
        skip(-10, false);
        triggerDoubleTapFeedback('left');
      }
      return;
    }

    // Single tap -> wait 260ms before toggling controls to allow double-tap detection
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }
    singleTapTimerRef.current = setTimeout(() => {
      setShowControls((prev) => {
        const next = !prev;
        if (next) {
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
          }, 3500);
        } else {
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          setShowQualityMenu(false);
          setShowAudioDrawer(false);
          setShowNextEpPreview(false);
        }
        return next;
      });
    }, 260);
  };

  // Toggle Play / Pause with interruption protection
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Gracefully ignore AbortError caused by quick play/pause toggles
          if (err.name !== 'AbortError') {
            console.warn('Playback play() was interrupted:', err);
          }
        });
      }
    } else {
      videoRef.current.pause();
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
        triggerControls();
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        skip(-10);
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        skip(10);
      } else if (e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          setIsMuted(videoRef.current.muted);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerControls]);

  return (
    <div
      ref={containerRef}
      onMouseMove={() => {
        if (isTouchDevice()) return;
        triggerControls();
      }}
      onTouchStart={(e) => {
        if (e.touches && e.touches[0]) {
          lastTouchXRef.current = e.touches[0].clientX;
        }
      }}
      onClick={handleContainerClick}
      className="relative w-full h-full bg-black select-none overflow-hidden flex items-center justify-center group touch-manipulation"
    >
      {/* 1. Underlying Video Element */}
      <video
        ref={videoRef}
        playsInline
        crossOrigin="anonymous"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            if (videoRef.current.buffered.length > 0) {
              setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
            }
          }
        }}
        onDurationChange={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={() => {
          if (autoPlayNext && hasNextEpisode && onNextEpisode) {
            onNextEpisode();
          }
        }}
        className="w-full h-full object-contain"
      >
        {activeSubtitleUri && (
          <track
            key={activeSubtitleUri}
            kind="subtitles"
            src={activeSubtitleUri}
            srcLang={activeSubtitleLang || 'en'}
            label={activeSubtitleLabel || 'Subtitle'}
            default
          />
        )}
      </video>

      {/* 2. Loading State (Netflix-Themed with Top-Left Content Rating Badge) */}
      {loadingStreams && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-40 select-none overflow-hidden animate-in fade-in duration-300">
          
          {/* Top-Left: Rated Badge with Back Button Overlay */}
          <div className="absolute top-3 left-3 sm:top-5 sm:left-6 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="relative">
              {/* Back Button (Overlaid on top of the text) */}
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="absolute -top-1 -left-1 sm:-top-1.5 sm:-left-1.5 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer backdrop-blur-md shadow-lg z-20"
                  title="Go Back"
                >
                  <IoArrowBack size={18} />
                </button>
              )}

              {/* Non-clickable Rated Badge (Underneath the back button) */}
              <div className="flex items-start gap-2.5 sm:gap-3 select-none">
                <div className="w-1 self-stretch bg-[#E50914] rounded-full shadow-[0_0_10px_#E50914] shrink-0" />
                <div className="flex flex-col">
                  <h3 className="text-xs sm:text-base md:text-lg font-black text-white tracking-wide">
                    {resolvedRating}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-gray-300 font-medium max-w-[155px] sm:max-w-xs md:max-w-sm leading-snug mt-0.5 line-clamp-2 sm:line-clamp-3">
                    {resolvedAdvisory}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Sleek Spinner & Quote / Status */}
          <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 z-10 px-4 text-center mt-6 sm:mt-0">
            <Spinner size="md" className="sm:scale-125" color="danger" />
            <div className="space-y-1">
              <div className="text-xs sm:text-base font-semibold text-white/90">
                {loadingQuote}
              </div>
              <div className="text-[11px] sm:text-xs text-gray-400 font-normal">
                Resolving best streams across cloud nodes...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Global Error State */}
      {error && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center space-y-4 z-40">
          <IoWarning className="text-red-500" size={48} />
          <div className="text-base font-bold text-white max-w-md">{error}</div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              color="danger"
              startContent={<IoReload />}
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
            {onBack && (
              <Button size="sm" variant="bordered" onClick={onBack}>
                Go Back
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 4. Playback / Format Warning */}
      {playbackError && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4 z-30">
          <IoWarning className="text-amber-400" size={44} />
          <div className="text-sm sm:text-base font-semibold text-white max-w-lg">{playbackError}</div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {firstPlayableStream && selectedStream?.link !== firstPlayableStream.link && (
              <Button
                size="sm"
                color="danger"
                variant="solid"
                onClick={() => {
                  setPlaybackError(null);
                  setSelectedStream(firstPlayableStream);
                }}
              >
                Switch to {firstPlayableStream.providerName} ({firstPlayableStream.server})
              </Button>
            )}
            <Button
              size="sm"
              variant="flat"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/10"
              startContent={<IoLanguageOutline />}
              onClick={() => setShowAudioDrawer(true)}
            >
              Audio Languages
            </Button>
          </div>
        </div>
      )}

      {/* 5. Center Buffering Indicator */}
      {isBuffering && !loadingStreams && !playbackError && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
          <Spinner size="lg" color="danger" />
        </div>
      )}

      {/* 5.1 Center YouTube-Style Transport Controls (Rewind 10s | Large Play/Pause | Forward 10s) */}
      {!loadingStreams && !playbackError && (
        <div
          className={`absolute inset-0 pointer-events-none flex items-center justify-center z-20 transition-opacity duration-300 ${
            showControls && !isBuffering ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className={`flex items-center gap-6 sm:gap-10 ${showControls && !isBuffering ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            {/* Rewind 10s */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                skip(-10);
              }}
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/55 hover:bg-black/75 text-white/90 hover:text-white flex items-center justify-center transition active:scale-90 cursor-pointer backdrop-blur-md border border-white/10 shadow-2xl"
              title="Rewind 10s"
              aria-label="Rewind 10 seconds"
            >
              <MdReplay10 size={26} />
            </button>

            {/* Center Large Play / Pause */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center transition active:scale-90 cursor-pointer backdrop-blur-md border border-white/15 shadow-[0_0_35px_rgba(0,0,0,0.85)]"
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <IoPause size={34} />
              ) : (
                <IoPlay size={36} className="ml-1" />
              )}
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                skip(10);
              }}
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/55 hover:bg-black/75 text-white/90 hover:text-white flex items-center justify-center transition active:scale-90 cursor-pointer backdrop-blur-md border border-white/10 shadow-2xl"
              title="Forward 10s"
              aria-label="Forward 10 seconds"
            >
              <MdForward10 size={26} />
            </button>
          </div>
        </div>
      )}

      {/* 5.2 YouTube-Style Double-Tap Seek Ripple Overlay */}
      {doubleTapSide && (
        <div
          className={`absolute inset-y-0 w-1/2 pointer-events-none select-none z-25 overflow-hidden flex items-center justify-center transition-opacity duration-300 ${
            doubleTapSide === 'left'
              ? 'left-0 rounded-r-full bg-gradient-to-r from-white/[0.06] to-transparent'
              : 'right-0 rounded-l-full bg-gradient-to-l from-white/[0.06] to-transparent'
          }`}
        >
          {/* Moving Expanding Ripple Wave */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-white/15 animate-ping opacity-60 duration-500" />
          </div>

          {/* Minimalist White +10 / -10 Seconds Indicator */}
          <div className="relative z-10 flex flex-col items-center justify-center space-y-1 text-white">
            <div className="flex items-center text-xs sm:text-sm font-black text-white/90 tracking-widest">
              {doubleTapSide === 'left' ? '◀◀' : '▶▶'}
            </div>
            <span className="text-xs sm:text-sm font-extrabold tracking-wider text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              {doubleTapSide === 'left' ? '-10 seconds' : '+10 seconds'}
            </span>
          </div>
        </div>
      )}

      {/* 6. Top Bar (Title & Episode on Left | Quality, CC Audio & Subtitles, Next Episode on Right) */}
      <div
        className={`absolute top-0 inset-x-0 px-3 sm:px-6 pt-2.5 sm:pt-4 pb-4 sm:pb-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Left: Back Button + Title + Subtitle/Episode */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white/90 hover:text-white flex items-center justify-center transition cursor-pointer backdrop-blur-md active:scale-95 shrink-0"
              title="Go Back"
            >
              <IoArrowBack size={19} />
            </button>
          )}
          <div className="flex flex-col">
            <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-white line-clamp-1 drop-shadow-md">
              {title}
            </h1>
            <span className="text-xs text-gray-300 font-medium line-clamp-1">
              {type === 'tv'
                ? `S${season || 1} E${episode || 1}${episodeTitle ? ` ${episodeTitle}` : ''}`
                : year ? `${year}` : 'Movie'}
            </span>
          </div>
        </div>

        {/* Top-Right Actions: Quality + Audio & Subtitles + Next Episode */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quality Button with Popover */}
          <div
            className="relative"
            ref={qualityMenuRef}
            onMouseEnter={handleQualityMouseEnter}
            onMouseLeave={handleQualityMouseLeave}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (qualityMenuTimeoutRef.current) clearTimeout(qualityMenuTimeoutRef.current);
                setShowAudioDrawer(false);
                setShowNextEpPreview(false);
                setShowQualityMenu((prev) => !prev);
                triggerControls();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-xs font-semibold text-white/90 hover:text-white transition cursor-pointer backdrop-blur-md active:scale-95 shadow-md shrink-0 pointer-events-auto"
              title="Change Video Quality"
            >
              <IoTvOutline size={15} className="text-white/80" />
              <span className="hidden sm:inline">Quality</span>
              <span className="hidden sm:inline text-gray-300 font-normal">
                {selectedQuality === 'auto' ? 'Auto' : selectedQuality}
              </span>
            </button>

            {/* Quality Popover (Netflix Theme Matching Audio & Subtitles) */}
            {showQualityMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full right-0 mt-2.5 w-52 bg-[#141414]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.95)] ring-1 ring-white/5 p-2 z-50 flex flex-col overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-2 text-[10.5px] font-bold text-gray-300 uppercase tracking-wider border-b border-white/10 flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] shrink-0" />
                  <span>Video Quality</span>
                </div>
                <div className="space-y-0.5">
                  {availableQualities.map((q) => {
                    const isSelected = selectedQuality === q.key;
                    return (
                      <button
                        key={q.key}
                        onClick={() => {
                          handleSelectQuality(q.key);
                          setShowQualityMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer ${isSelected
                          ? 'bg-red-600/15 text-white font-semibold border border-red-500/30'
                          : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3.5 text-center shrink-0">
                            {isSelected && <IoCheckmark size={14} className="text-[#E50914] inline font-bold" />}
                          </span>
                          <span className="font-medium text-[11px] truncate">{q.label}</span>
                          {q.badge && (
                            <span className="px-1.5 py-0.2 bg-white/10 text-[9px] text-gray-400 rounded font-normal shrink-0">
                              {q.badge}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Audio Track Button with Popover */}
          <div
            className="relative"
            ref={audioMenuRef}
            onMouseEnter={handleAudioMouseEnter}
            onMouseLeave={handleAudioMouseLeave}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
                setShowQualityMenu(false);
                setShowNextEpPreview(false);
                setShowAudioDrawer((prev) => !prev);
                triggerControls();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-xs font-semibold text-white/90 hover:text-white transition cursor-pointer backdrop-blur-md active:scale-95 shadow-md shrink-0 pointer-events-auto"
              title="Change Audio Track"
            >
              <IoLanguageOutline size={15} className="text-white/80" />
              <span className="hidden sm:inline">Audio</span>
              <span className="hidden sm:inline text-gray-300 font-normal truncate max-w-[80px]">
                {activeLanguage || 'Default'}
              </span>
            </button>

            {/* Netflix-style Single-Column Audio Popover Window */}
            {showAudioDrawer && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full right-0 mt-2.5 w-56 sm:w-60 bg-[#141414]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.95)] ring-1 ring-white/5 p-2 z-50 flex flex-col overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-2 text-[10.5px] font-bold text-gray-300 uppercase tracking-wider border-b border-white/10 flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] shrink-0" />
                  <span>Audio Track</span>
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-0.5 p-0.5">
                  {/* Live HLS tracks if any */}
                  {hlsAudioTracks.length > 1 && (
                    <div className="mb-1.5 p-1 rounded-lg bg-white/[0.03] border border-white/5 space-y-0.5">
                      {hlsAudioTracks.map((track, idx) => {
                        const isCurrent = currentHlsAudioTrack === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (hlsRef.current) {
                                hlsRef.current.audioTrack = idx;
                                setCurrentHlsAudioTrack(idx);
                              }
                            }}
                            className={`w-full px-2 py-1 rounded-lg text-left text-[11px] flex items-center justify-between transition cursor-pointer ${isCurrent
                              ? 'bg-red-600/20 text-white font-medium border border-red-500/30'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white'
                              }`}
                          >
                            <span className="truncate">{track.name || track.lang || `Track ${idx + 1}`}</span>
                            {isCurrent && <IoCheckmark size={14} className="text-[#E50914] shrink-0 ml-1 font-bold" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Spoken Languages List */}
                  {availableLanguages.map((item) => {
                    const isActive = activeLanguage === item.name;
                    const flag = LANGUAGE_FLAGS[item.name] || '🌐';
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          handleSelectLanguage(item.name);
                          setShowAudioDrawer(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition cursor-pointer ${isActive
                          ? 'bg-red-600/15 text-white font-semibold border border-red-500/30'
                          : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3.5 text-center shrink-0">
                            {isActive && <IoCheckmark size={14} className="text-[#E50914] inline font-bold" />}
                          </span>
                          <span className="text-sm select-none">{flag}</span>
                          <div className="truncate">
                            <span className="text-[11px] block font-medium truncate">{item.name}</span>
                            <span className="text-[9px] text-gray-400 block truncate leading-none">
                              {item.name === originalLanguage ? 'Original Audio' : `${item.count} sources`}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Next Episode Button with Hover Preview Card (Netflix Theme) */}
          {(hasNextEpisode || onNextEpisode) && (
            <div
              className="relative"
              ref={nextEpPreviewRef}
              onMouseEnter={handleNextEpMouseEnter}
              onMouseLeave={handleNextEpMouseLeave}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (nextEpPreviewTimeoutRef.current) clearTimeout(nextEpPreviewTimeoutRef.current);
                  setShowNextEpPreview(false);
                  onNextEpisode?.();
                }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-xs font-semibold text-white/90 hover:text-white transition cursor-pointer backdrop-blur-md active:scale-95 shadow-md shrink-0 pointer-events-auto"
                title="Next Episode"
              >
                <IoPlaySkipForward size={12} />
              </button>

              {/* Next Episode Hover Preview Popover */}
              {showNextEpPreview && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNextEpPreview(false);
                    onNextEpisode?.();
                  }}
                  className="absolute top-full right-0 mt-2.5 w-80 sm:w-96 bg-[#141416]/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.9)] hover:border-white/25 hover:shadow-[0_0_35px_rgba(255,255,255,0.08)] p-3 z-50 flex gap-3.5 cursor-pointer text-white animate-in fade-in zoom-in-95 duration-150 transition-all group"
                >
                  {/* Left: 16:9 Thumbnail with Play Button */}
                  <div className="relative w-36 sm:w-40 aspect-video rounded-xl overflow-hidden bg-black/50 flex-shrink-0 shadow-md border border-white/10">
                    {nextEpisodeData?.still_path ? (
                      <img
                        src={
                          nextEpisodeData.still_path.startsWith('http')
                            ? nextEpisodeData.still_path
                            : `https://image.tmdb.org/t/p/w300${nextEpisodeData.still_path}`
                        }
                        alt={nextEpisodeData.name || `Episode ${(episode || 1) + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-white/5 to-black/60 text-gray-400">
                        <IoTvOutline size={20} className="opacity-40" />
                        <span className="text-[10px] font-bold mt-1 uppercase tracking-wider text-gray-400">
                          EP {(episode || 1) + 1}
                        </span>
                      </div>
                    )}

                    {/* Centered Simple Triangle Play Button (No circle, normal white with shadow) */}
                    <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                      <IoPlay
                        size={28}
                        className="text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] ml-0.5 group-hover:scale-110 transition-transform duration-200"
                      />
                    </div>
                  </div>

                  {/* Right: Title, Meta, Overview */}
                  <div className="flex-1 min-w-0 pr-1 pt-0.5">
                    {/* Title (Simple white title) */}
                    <h4 className="text-sm font-bold text-white line-clamp-1 transition-colors">
                      {nextEpisodeData?.name || `Episode ${(episode || 1) + 1}`}
                    </h4>

                    {/* Submeta: S1 E2 • AirDate • 24m */}
                    <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5 mt-1">
                      <span>{`S${season || 1} E${nextEpisodeData?.episode_number || (episode || 1) + 1}`}</span>
                      <span>•</span>
                      {nextEpisodeData?.air_date && (
                        <>
                          <span>
                            {new Date(nextEpisodeData.air_date).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span>•</span>
                        </>
                      )}
                      <span>{nextEpisodeData?.runtime ? `${nextEpisodeData.runtime}m` : '24m'}</span>
                    </div>

                    {/* Overview */}
                    <p className="text-xs text-gray-400 line-clamp-2 mt-1.5 leading-relaxed font-normal">
                      {nextEpisodeData?.overview || 'Click to play the next episode.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 7. Bottom Control Bar (Sleek Scrubber + Timestamp & Fullscreen) */}
      <div
        className={`absolute bottom-0 inset-x-0 px-3 sm:px-6 pt-6 sm:pt-8 pb-1.5 sm:pb-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-0.5 sm:gap-1.5 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Scrubber Slider (Netflix Red Style) */}
        <div className="relative w-full py-1 sm:py-2 flex items-center group/scrubber cursor-pointer select-none">
          {/* Custom Visual Track */}
          <div className="relative w-full h-1 group-hover/scrubber:h-1.5 bg-white/20 rounded-full transition-all overflow-hidden pointer-events-none">
            {/* Buffered bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/40 transition-all duration-200"
              style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
            />
            {/* Played bar (Netflix Red) */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#E50914] shadow-[0_0_10px_rgba(229,9,20,0.5)] transition-all duration-75"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          {/* Netflix Red Thumb Circle */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#E50914] rounded-full shadow-[0_0_8px_rgba(229,9,20,0.8)] ring-2 ring-white/60 pointer-events-none transition-transform group-hover/scrubber:scale-125"
            style={{
              left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
            }}
          />

          {/* Interactive range input */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentTime(val);
              if (videoRef.current) videoRef.current.currentTime = val;
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-auto"
          />
        </div>

        {/* Action Controls Row */}
        <div className="relative flex items-center justify-between pt-0">
          {/* Left: Timestamp */}
          <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-white/90 tracking-wide select-none">
            <span>{formatTime(currentTime)}</span>
            <span className="text-white/40">/</span>
            <span className="text-white/60">{formatTime(duration)}</span>
          </div>

          {/* Center: Episodes ^ button (TV & Anime) - Positioned dead-center of player bar, hidden in portrait */}
          {(type === 'tv' || (episodes && episodes.length > 0)) && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto portrait:hidden">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEpisodesTray(!showEpisodesTray);
                }}
                className="flex items-center gap-2 text-[14px] sm:text-[15px] font-bold text-white hover:text-white transition cursor-pointer px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md active:scale-95 shadow-md"
              >
                <span>Episodes</span>
                <IoChevronUp
                  size={16}
                  className={`transition-transform duration-200 ${showEpisodesTray ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          )}

          {/* Right: Fullscreen */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="text-white hover:text-white/80 transition active:scale-95 cursor-pointer p-1.5 rounded-full hover:bg-white/10 flex items-center justify-center"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <IoContract size={20} /> : <IoExpand size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* 8. Episodes Selection Tray / Modal (Bingr Layout + Netflix Themed) */}
      {showEpisodesTray && episodes && episodes.length > 0 && (() => {
        const chunkSize = 25;
        const totalChunks = Math.ceil(episodes.length / chunkSize);
        const currentChunk = Math.min(selectedEpisodeChunk, Math.max(0, totalChunks - 1));
        const chunkStart = currentChunk * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize, episodes.length);
        const visibleEpisodes = episodes.slice(chunkStart, chunkEnd);

        return (
          <div
            className="absolute inset-0 z-50 flex flex-col w-full h-full bg-black/70 backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300 ease-out select-none"
          >
            {/* Subtle backdrop vignette (Keeps text legible while video is visible through blur) */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden -z-10 bg-gradient-to-t from-black/60 via-transparent to-black/40" />

            {/* Header Bar: Translucent with Netflix Accent + "Episodes" + Title | Auto play toggle + Close 'X' */}
            <div className="px-6 sm:px-10 pt-5 pb-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-transparent z-10">
              {/* Title Section: Netflix Red Pill + "Episodes" + Show Title */}
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <span className="w-2.5 h-6 sm:h-7 rounded-full bg-[#E50914] shadow-[0_0_12px_#E50914] shrink-0" />
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-wide shrink-0">
                  Episodes
                </h2>
                <span className="text-sm sm:text-base md:text-lg text-gray-400 font-medium truncate">
                  {title}
                </span>
              </div>

              {/* Right Actions: Auto play toggle + Close button */}
              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                {/* Auto play Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setAutoPlayNext(!autoPlayNext)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 transition cursor-pointer select-none group focus:outline-none"
                  title="Toggle auto play next episode"
                >
                  <IoPlaySkipForward
                    size={14}
                    className={autoPlayNext ? 'text-[#E50914]' : 'text-gray-400 group-hover:text-gray-300'}
                  />
                  <span className="text-xs sm:text-sm font-semibold text-gray-300 group-hover:text-white transition">
                    Auto play
                  </span>
                  {/* Switch Toggle */}
                  <div
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${autoPlayNext ? 'bg-[#E50914]' : 'bg-white/20'
                      }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${autoPlayNext ? 'translate-x-4' : 'translate-x-0'
                        }`}
                    />
                  </div>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowEpisodesTray(false)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer border border-white/10"
                  title="Close Episodes"
                >
                  <IoClose size={24} />
                </button>
              </div>
            </div>

            {/* Body: Left Side Season/Range Chips List + Right Side Episodes Rows */}
            <div className="flex flex-col sm:flex-row flex-1 overflow-hidden z-10">
              {/* Left Column: Season / Range Chips List (Stacked vertically like Bingr) */}
              <div className="w-full sm:w-44 md:w-52 shrink-0 p-4 sm:p-6 sm:border-r border-white/5 flex sm:flex-col gap-2.5 overflow-x-auto sm:overflow-y-auto scrollbar-none">
                {Array.from({ length: totalChunks }).map((_, idx) => {
                  const startEp = idx * chunkSize + 1;
                  const endEp = Math.min((idx + 1) * chunkSize, episodes.length);
                  const isSelected = idx === currentChunk;
                  const count = endEp - startEp + 1;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedEpisodeChunk(idx)}
                      className={`flex items-center justify-between px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 sm:shrink sm:w-full ${isSelected
                        ? 'bg-[#222228]/95 text-white shadow-md border border-white/15 ring-1 ring-white/10'
                        : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-transparent'
                        }`}
                    >
                      <span className="font-bold">{`${startEp}-${endEp}`}</span>
                      <span className="text-gray-400 font-normal text-xs ml-3">{count} Eps</span>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Episodes List (No box cards, just subtle hover effect like Bingr) */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-2">
                {visibleEpisodes.map((ep) => {
                  const isCurrent = ep.episode_number === episode;
                  const thumbUrl = ep.still_path
                    ? ep.still_path.startsWith('http')
                      ? ep.still_path
                      : `https://image.tmdb.org/t/p/w300${ep.still_path}`
                    : null;

                  return (
                    <div
                      key={ep.episode_number}
                      ref={isCurrent ? activeEpisodeRef : null}
                      onClick={() => {
                        onSelectEpisode?.(season || 1, ep.episode_number);
                        setShowEpisodesTray(false);
                      }}
                      className={`group flex items-start sm:items-center gap-3.5 sm:gap-6 p-2.5 rounded-xl transition-colors duration-150 cursor-pointer ${isCurrent
                        ? 'bg-white/[0.08] ring-1 ring-white/15'
                        : 'hover:bg-white/[0.06]'
                        }`}
                    >
                      {/* Left: 16:9 Thumbnail */}
                      <div className="relative w-36 sm:w-48 md:w-56 aspect-video rounded-lg overflow-hidden bg-black/40 flex-shrink-0 shadow-md">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={ep.name || `Episode ${ep.episode_number}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-white/5 to-black/60 text-gray-400">
                            <IoTvOutline size={24} className="opacity-40" />
                            <span className="text-[10px] font-bold mt-1 uppercase tracking-wider text-gray-400">
                              EP {ep.episode_number}
                            </span>
                          </div>
                        )}

                        {/* Overlay: Playing or Hover Play Button */}
                        {isCurrent ? (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-9 h-9 rounded-full bg-[#E50914] text-white flex items-center justify-center shadow-lg shadow-red-600/50">
                              <IoPlay size={18} className="ml-0.5" />
                            </div>
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-md">
                              <IoPlay size={16} className="ml-0.5" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Title, Submeta, Description */}
                      <div className="flex-1 min-w-0 pr-2 pt-0.5">
                        {/* Title */}
                        <h3
                          className={`text-sm sm:text-base font-bold line-clamp-1 transition-colors ${isCurrent ? 'text-white' : 'text-white group-hover:text-gray-200'
                            }`}
                        >
                          {ep.name || `Episode ${ep.episode_number}`}
                        </h3>

                        {/* Submeta: S1 E1 • 24m • Playing badge */}
                        <div className="text-xs text-gray-400 font-medium flex items-center gap-2 mt-1">
                          <span>{`S${season || 1} E${ep.episode_number}`}</span>
                          <span>•</span>
                          <span>24m</span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#E50914] text-white ml-1">
                              Playing
                            </span>
                          )}
                        </div>

                        {/* Overview / Description */}
                        <p className="text-xs sm:text-sm text-gray-400 line-clamp-2 mt-1.5 leading-relaxed font-normal">
                          {ep.overview || 'No description available for this episode.'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}



      {/* Global CSS for native video subtitle cue styling */}
      <style jsx global>{`
        ::cue {
          font-size: ${subFontSize === 'small' ? '14px' : subFontSize === 'large' ? '22px' : '18px'} !important;
          color: ${subColor === 'yellow' ? '#fde047' : '#ffffff'} !important;
          background-color: ${subBg === 'transparent' ? 'transparent' : 'rgba(0, 0, 0, 0.75)'} !important;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9) !important;
        }
      `}</style>
    </div>
  );
}

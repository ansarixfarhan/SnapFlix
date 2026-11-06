"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  IoPeopleOutline,
  IoServerOutline,
} from 'react-icons/io5';
import { MdHighQuality, MdReplay10, MdForward10, MdAspectRatio, MdFitScreen } from 'react-icons/md';
import { Spinner, Button } from '@heroui/react';
import { syncHistory, getMovieLastPosition, getTvShowLastPosition } from '@/actions/histories';
import { GUEST_HISTORY_KEY, WATCH_HISTORY_QUERY_KEY, readGuestHistory, writeGuestHistory } from '@/hooks/useWatchHistory';
import { queryClient } from '@/app/providers';
import useSupabaseUser from '@/hooks/useSupabaseUser';
import { useWatchParty } from '@/hooks/useWatchParty';
import WatchPartyModal from './WatchPartyModal';
import { tmdb } from '@/api/tmdb';
import { cn } from '@/utils/helpers';

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
  language?: string;
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

export const LANGUAGE_COUNTRY_CODES: Record<string, string> = {
  English: 'gb',
  Hindi: 'in',
  Japanese: 'jp',
  Korean: 'kr',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Tamil: 'in',
  Telugu: 'in',
  Malayalam: 'in',
  Kannada: 'in',
  Bengali: 'in',
  Punjabi: 'in',
  Chinese: 'cn',
  Russian: 'ru',
  Arabic: 'sa',
  Turkish: 'tr',
  Portuguese: 'br',
  Indonesian: 'id',
  Tagalog: 'ph',
  Dutch: 'nl',
  Polish: 'pl',
  Thai: 'th',
  Vietnamese: 'vn',
  Swedish: 'se',
  Norwegian: 'no',
  Danish: 'dk',
  Finnish: 'fi',
  Greek: 'gr',
  Hebrew: 'il',
  Czech: 'cz',
  Hungarian: 'hu',
  Romanian: 'ro',
  Ukrainian: 'ua',
  Marathi: 'in',
  Gujarati: 'in',
  Urdu: 'pk',
  Croatian: 'hr',
  Bulgarian: 'bg',
  Serbian: 'rs',
  Slovenian: 'si',
  Slovak: 'sk',
  Albanian: 'al',
  Macedonian: 'mk',
  Estonian: 'ee',
  Lithuanian: 'lt',
  Latvian: 'lv',
  Bosnian: 'ba',
  Icelandic: 'is',
};

export interface SubtitleMeta {
  countryCode: string | null;
  langCode: string | null;
}

export const SUBTITLE_LANGUAGE_DEFINITIONS: Array<{
  matches: string[];
  langCode: string;
  countryCode: string;
}> = [
    // South Asian Languages
    { matches: ['hindi', 'हिन्दी', 'hindustani', 'hin', 'hi'], langCode: 'HI', countryCode: 'in' },
    { matches: ['bengali', 'bangla', 'বাংলা', 'ben', 'bn'], langCode: 'BN', countryCode: 'bd' },
    { matches: ['tamil', 'தமிழ்', 'tam', 'ta'], langCode: 'TA', countryCode: 'in' },
    { matches: ['telugu', 'తెలుగు', 'tel', 'te'], langCode: 'TE', countryCode: 'in' },
    { matches: ['kannada', 'ಕನ್ನಡ', 'kan', 'kn'], langCode: 'KN', countryCode: 'in' },
    { matches: ['malayalam', 'മലയാളം', 'mal', 'ml'], langCode: 'ML', countryCode: 'in' },
    { matches: ['marathi', 'मराठी', 'mar', 'mr'], langCode: 'MR', countryCode: 'in' },
    { matches: ['gujarati', 'ગુજરાતી', 'guj', 'gu'], langCode: 'GU', countryCode: 'in' },
    { matches: ['punjabi', 'ਪੰਜਾਬੀ', 'pan', 'pa'], langCode: 'PA', countryCode: 'in' },
    { matches: ['urdu', 'اردو', 'urd', 'ur'], langCode: 'UR', countryCode: 'pk' },

    // Major World Languages
    { matches: ['english', 'inglés', 'ingles', 'eng', 'en'], langCode: 'EN', countryCode: 'gb' },
    { matches: ['spanish', 'español', 'espanol', 'castellano', 'espana', 'spa', 'es'], langCode: 'ES', countryCode: 'es' },
    { matches: ['french', 'français', 'francais', 'fra', 'fre', 'fr'], langCode: 'FR', countryCode: 'fr' },
    { matches: ['portuguese', 'português', 'portugues', 'por', 'pt'], langCode: 'PT', countryCode: 'br' },
    { matches: ['german', 'deutsch', 'ger', 'deu', 'de'], langCode: 'DE', countryCode: 'de' },
    { matches: ['italian', 'italiano', 'ita', 'it'], langCode: 'IT', countryCode: 'it' },
    { matches: ['russian', 'русский', 'rus', 'ru'], langCode: 'RU', countryCode: 'ru' },
    { matches: ['japanese', '日本語', 'jap', 'jpn', 'ja'], langCode: 'JA', countryCode: 'jp' },
    { matches: ['korean', '한국어', 'kor', 'ko'], langCode: 'KO', countryCode: 'kr' },
    { matches: ['chinese', '中文', 'mandarin', 'cantonese', 'chi', 'zho', 'zh'], langCode: 'ZH', countryCode: 'cn' },
    { matches: ['arabic', 'العربية', 'عرب', 'arabi', 'ara', 'ar'], langCode: 'AR', countryCode: 'sa' },
    { matches: ['turkish', 'türkçe', 'turkce', 'tur', 'tr'], langCode: 'TR', countryCode: 'tr' },
    { matches: ['dutch', 'nederlands', 'nld', 'dut', 'nl'], langCode: 'NL', countryCode: 'nl' },
    { matches: ['polish', 'polski', 'pol', 'pl'], langCode: 'PL', countryCode: 'pl' },

    // Southeast Asian Languages
    { matches: ['indonesian', 'indonesia', 'bahasa indonesia', 'ind', 'id'], langCode: 'ID', countryCode: 'id' },
    { matches: ['malay', 'melayu', 'bahasa melayu', 'may', 'msa', 'ms'], langCode: 'MS', countryCode: 'my' },
    { matches: ['vietnamese', 'tiếng việt', 'tieng viet', 'vie', 'vi'], langCode: 'VI', countryCode: 'vn' },
    { matches: ['thai', 'ไทย', 'tha', 'th'], langCode: 'TH', countryCode: 'th' },
    { matches: ['tagalog', 'filipino', 'tgl', 'tl'], langCode: 'TL', countryCode: 'ph' },

    // European & Balkan Languages
    { matches: ['croatian', 'hrvatski', 'hrv', 'hr'], langCode: 'HR', countryCode: 'hr' },
    { matches: ['serbian', 'srpski', 'srp', 'sr'], langCode: 'SR', countryCode: 'rs' },
    { matches: ['bosnian', 'bosanski', 'bos', 'bs'], langCode: 'BS', countryCode: 'ba' },
    { matches: ['slovenian', 'slovenski', 'slv', 'sl'], langCode: 'SL', countryCode: 'si' },
    { matches: ['bulgarian', 'български', 'bul', 'bg'], langCode: 'BG', countryCode: 'bg' },
    { matches: ['macedonian', 'македонски', 'mkd', 'mk'], langCode: 'MK', countryCode: 'mk' },
    { matches: ['albanian', 'shqip', 'sqi', 'alb', 'sq'], langCode: 'SQ', countryCode: 'al' },
    { matches: ['greek', 'ελληνικά', 'ell', 'gre', 'el'], langCode: 'EL', countryCode: 'gr' },
    { matches: ['czech', 'čeština', 'cestina', 'ces', 'cze', 'cs'], langCode: 'CS', countryCode: 'cz' },
    { matches: ['slovak', 'slovenčina', 'slovencina', 'slk', 'sk'], langCode: 'SK', countryCode: 'sk' },
    { matches: ['hungarian', 'magyar', 'hun', 'hu'], langCode: 'HU', countryCode: 'hu' },
    { matches: ['romanian', 'română', 'romana', 'ron', 'rum', 'ro'], langCode: 'RO', countryCode: 'ro' },
    { matches: ['ukrainian', 'українська', 'ukr', 'ua', 'uk'], langCode: 'UK', countryCode: 'ua' },
    { matches: ['swedish', 'svenska', 'swe', 'sv'], langCode: 'SV', countryCode: 'se' },
    { matches: ['norwegian', 'norsk', 'nor', 'no'], langCode: 'NO', countryCode: 'no' },
    { matches: ['danish', 'dansk', 'dan', 'da'], langCode: 'DA', countryCode: 'dk' },
    { matches: ['finnish', 'suomi', 'fin', 'fi'], langCode: 'FI', countryCode: 'fi' },
    { matches: ['estonian', 'eesti', 'est', 'et'], langCode: 'ET', countryCode: 'ee' },
    { matches: ['lithuanian', 'lietuvių', 'lit', 'lt'], langCode: 'LT', countryCode: 'lt' },
    { matches: ['latvian', 'latviešu', 'lav', 'lv'], langCode: 'LV', countryCode: 'lv' },
    { matches: ['hebrew', 'עברית', 'heb', 'he'], langCode: 'HE', countryCode: 'il' },
    { matches: ['persian', 'farsi', 'فارسی', 'fas', 'per', 'fa'], langCode: 'FA', countryCode: 'ir' },
    { matches: ['icelandic', 'íslenska', 'isl', 'is'], langCode: 'IS', countryCode: 'is' },
  ];

export const normalizeForLanguageCheck = (str?: string | null): string =>
  (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '')
    .toLowerCase()
    .trim();

export const getSubtitleMeta = (sub: { title: string; language?: string }): SubtitleMeta => {
  const normTitle = normalizeForLanguageCheck(sub.title);
  const cleanLang = normalizeForLanguageCheck(sub.language || '');

  // 1. Pass 1: Exact whole-string match (Highest confidence, e.g. "Hindi", "English", "Croatian")
  for (const def of SUBTITLE_LANGUAGE_DEFINITIONS) {
    for (const match of def.matches) {
      const normMatch = normalizeForLanguageCheck(match);
      if (normTitle === normMatch || cleanLang === normMatch) {
        let country = def.countryCode;
        if (def.langCode === 'PT' && (normTitle.includes('portugal') || cleanLang.includes('pt-pt'))) country = 'pt';
        if (def.langCode === 'ES' && (normTitle.includes('latino') || normTitle.includes('latin'))) country = 'mx';
        if (def.langCode === 'ZH' && (normTitle.includes('taiwan') || normTitle.includes('traditional'))) country = 'tw';
        return { langCode: def.langCode, countryCode: country };
      }
    }
  }

  // 2. Pass 2: Delimiter-bounded word token matching (e.g. "Avengers.Hindi.srt", "English [CC]")
  // Strictly uses boundaries so 'ind' won't match inside 'hindi', 'hin' won't match inside 'chinese'
  for (const def of SUBTITLE_LANGUAGE_DEFINITIONS) {
    for (const match of def.matches) {
      const normMatch = normalizeForLanguageCheck(match);
      const escaped = normMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?:^|[\\s._\\-\\[\\](),/])${escaped}(?:$|[\\s._\\-\\[\\](),/])`, 'i');
      if (pattern.test(normTitle) || pattern.test(cleanLang)) {
        let country = def.countryCode;
        if (def.langCode === 'PT' && (normTitle.includes('portugal') || cleanLang.includes('pt-pt'))) country = 'pt';
        if (def.langCode === 'ES' && (normTitle.includes('latino') || normTitle.includes('latin'))) country = 'mx';
        if (def.langCode === 'ZH' && (normTitle.includes('taiwan') || normTitle.includes('traditional'))) country = 'tw';
        return { langCode: def.langCode, countryCode: country };
      }
    }
  }

  // 3. Pass 3: 2-letter ISO code fallback
  if (cleanLang && cleanLang.length === 2 && cleanLang !== 'un') {
    return { langCode: cleanLang.toUpperCase(), countryCode: cleanLang };
  }

  // 4. Fallback for custom/unrecognized subtitles
  return {
    langCode: cleanLang && cleanLang.length <= 4 && cleanLang !== 'und' && cleanLang !== 'unknown'
      ? cleanLang.toUpperCase()
      : null,
    countryCode: null,
  };
};

export const getSubtitleCountryCode = (sub: { title: string; language?: string }): string | null =>
  getSubtitleMeta(sub).countryCode;

export const GENERIC_AUDIO_LABELS = new Set([
  'audio',
  'default',
  'main',
  'stereo',
  'surround',
  'und',
  'undefined',
  'unknown',
  'track',
  'media',
  'aac',
  'sound',
  'auto',
  'none',
]);

export const LANGUAGE_FLAGS: Record<string, string> = {
  English: '🇬🇧',
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
  Tagalog: '🇵🇭',
  Dutch: '🇳🇱',
  Polish: '🇵🇱',
  Thai: '🇹🇭',
  Vietnamese: '🇻🇳',
  Original: '🌐',
};

export const LANG_CODE_ALIASES: Record<string, string[]> = {
  Hindi: ['hi', 'hin', 'hindi', 'हिन्दी', 'हिंदी'],
  English: ['en', 'eng', 'english'],
  Tamil: ['ta', 'tam', 'tamil', 'தமிழ்'],
  Telugu: ['te', 'tel', 'telugu', 'తెలుగు'],
  Punjabi: ['pa', 'pan', 'punjabi'],
  Bengali: ['bn', 'ben', 'bengali'],
  Malayalam: ['ml', 'mal', 'malayalam'],
  Kannada: ['kn', 'kan', 'kannada'],
  Japanese: ['ja', 'jpn', 'japanese', '日本語'],
  Korean: ['ko', 'kor', 'korean', '한국어'],
  Spanish: ['es', 'spa', 'spanish', 'esla', 'es-la', 'es_la', 'es419', 'es-419', 'latino', 'castellano', 'espanol', 'español'],
  French: ['fr', 'fra', 'fre', 'french', 'français'],
  German: ['de', 'ger', 'deu', 'german', 'deutsch'],
  Italian: ['it', 'ita', 'italian', 'italiano'],
  Russian: ['ru', 'rus', 'russian', 'русский'],
  Arabic: ['ar', 'ara', 'arabic', 'ar-sa', 'arsa', 'العربية'],
  Portuguese: ['pt', 'por', 'portuguese', 'ptbr', 'pt-br', 'pt_br', 'brazil', 'brasil'],
  Turkish: ['tr', 'tur', 'turkish'],
  Chinese: ['zh', 'chi', 'zho', 'chinese', 'mandarin', 'cantonese'],
  Indonesian: ['id', 'ind', 'indonesian'],
  Tagalog: ['tl', 'tgl', 'tagalog', 'filipino', 'fil'],
  Thai: ['th', 'tha', 'thai'],
  Vietnamese: ['vi', 'vie', 'vietnamese'],
  Dutch: ['nl', 'nld', 'dut', 'dutch'],
  Polish: ['pl', 'pol', 'polish'],
};

export function parseWordToLanguage(word: string): string | null {
  const s = word.toLowerCase().trim();
  if (!s) return null;

  if (s.includes('हिन्दी') || s.includes('हिंदी')) return 'Hindi';
  if (s.includes('தமிழ்')) return 'Tamil';
  if (s.includes('తెలుగు')) return 'Telugu';
  if (s.includes('한국어')) return 'Korean';
  if (s.includes('日本語')) return 'Japanese';
  if (s.includes('العربية')) return 'Arabic';
  if (s.includes('русский')) return 'Russian';

  const clean = s.replace(/[^a-z0-9]/g, '');
  if (clean.startsWith('esla') || clean.startsWith('es419') || clean.startsWith('espa') || clean === 'esla') return 'Spanish';
  if (clean.startsWith('ptbr') || clean.startsWith('ptpt')) return 'Portuguese';
  if (clean.startsWith('enus') || clean.startsWith('engb')) return 'English';
  if (clean.startsWith('frfr')) return 'French';
  if (clean.startsWith('dede')) return 'German';
  if (clean.startsWith('itit')) return 'Italian';
  if (clean.startsWith('jajp') || clean.startsWith('jpn')) return 'Japanese';
  if (clean.startsWith('kokr') || clean.startsWith('kor')) return 'Korean';
  if (clean.startsWith('ruru') || clean.startsWith('rus')) return 'Russian';
  if (clean.startsWith('arsa') || clean.startsWith('ara')) return 'Arabic';

  for (const [lang, aliases] of Object.entries(LANG_CODE_ALIASES)) {
    const matched = aliases.some((a) => {
      const aClean = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (s === a || clean === aClean) return true;
      if (a.length <= 3) {
        return new RegExp(`\\b${a}\\b`, 'i').test(s) || s === a;
      }
      return s.includes(a);
    });
    if (matched) {
      return lang;
    }
  }
  return null;
}

export function isHlsStream(stream?: StreamItem | null): boolean {
  if (!stream) return false;
  const type = (stream.type || '').toLowerCase();
  const link = (stream.link || '').toLowerCase();
  return (
    type === 'm3u8' ||
    type === 'hls' ||
    link.includes('m3u8') ||
    link.includes('playlist') ||
    link.includes('/hls/')
  );
}

export function isPlayableStream(stream?: StreamItem | null): boolean {
  if (!stream) return false;
  const type = (stream.type || '').toLowerCase();
  const link = (stream.link || '').toLowerCase();
  if (type === 'mkv' || link.endsWith('.mkv') || link.includes('.mkv?')) return false;
  return isHlsStream(stream) || type === 'mp4' || link.includes('.mp4');
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
  const sLower = server.toLowerCase();

  const langs = new Set<string>();

  // 1. Direct language field from backend (Highest Priority)
  if (stream.language) {
    const raw = String(stream.language).trim();
    if (raw.toLowerCase() === 'original') {
      langs.add(defaultLang);
      return Array.from(langs);
    }
    const cleanRaw = raw.replace(/\s*\(subtitles?\)/i, '').replace(/\s*sub$/i, '').trim();
    const splitParts = cleanRaw.split(/[,/+|]/);
    for (const part of splitParts) {
      const parsed = parseWordToLanguage(part.trim());
      if (parsed) {
        langs.add(parsed);
      } else if (part.trim().length > 1) {
        const lower = part.trim().toLowerCase();
        if (!GENERIC_AUDIO_LABELS.has(lower) && !lower.startsWith('audio') && !lower.startsWith('track')) {
          const titleCased = part.trim().charAt(0).toUpperCase() + part.trim().slice(1).toLowerCase();
          langs.add(titleCased);
        }
      }
    }
    if (langs.size > 0 && !sLower.includes('dual') && !sLower.includes('multi')) {
      return Array.from(langs);
    }
  }

  // 2. Check explicit 'Original' / 'Original Audio' (MovieBox / Web servers)
  if (sLower.includes('original')) {
    langs.add(defaultLang);
    return Array.from(langs);
  }

  // 3. Check parentheses in server string:
  // In multi-audio servers like 'Movy - Delhi (Hindi) (English)', the LAST parenthesized token is the specific audio!
  const parenMatches = Array.from(server.matchAll(/\(([^)]+)\)/g)).map((m) => m[1]);
  if (parenMatches.length > 0) {
    // Check the last parenthesis first (specific audio track)
    const lastP = parenMatches[parenMatches.length - 1];
    const lastLang = parseWordToLanguage(lastP);
    if (lastLang) {
      langs.add(lastLang);
      return Array.from(langs);
    }
    for (const p of parenMatches) {
      const pLang = parseWordToLanguage(p);
      if (pLang) {
        langs.add(pLang);
      }
    }
    if (langs.size > 0) {
      return Array.from(langs);
    }
  }

  // 4. Direct language check across all known languages in server name or tag
  // Handles strings with explicit languages like: "Inception - Tamil - 1080p", "Hindi, English"
  for (const [lang, aliases] of Object.entries(LANG_CODE_ALIASES)) {
    const matched = aliases.some((a) => {
      if (a.length <= 3) {
        return (
          new RegExp(`\\b${a}\\b`, 'i').test(server) ||
          new RegExp(`\\b${a}\\b`, 'i').test(tag)
        );
      }
      return (
        server.toLowerCase().includes(a) ||
        tag.toLowerCase().includes(a)
      );
    });
    if (matched) {
      langs.add(lang);
    }
  }
  if (langs.size > 0) {
    return Array.from(langs);
  }

  // 5. Fallback: only if server gave NO language clues, check title metadata
  if (title.includes('dual audio') || title.includes('dual-audio')) {
    langs.add('Hindi');
    langs.add('English');
  } else if (/\[hindi\]|\(hindi\)/i.test(title)) {
    langs.add('Hindi');
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
  backdropUrl?: string;
  backdropPath?: string;
  posterPath?: string;
  overview?: string;
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
  backdropUrl,
  backdropPath,
  posterPath,
  overview,
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

  // Active Server Provider ('vidly' | 'vidbolt' | 'vidrift' | 'vidy') & Server Switcher States
  const [activeServerProvider, setActiveServerProvider] = useState<'vidly' | 'vidbolt' | 'vidrift' | 'vidy'>('vidly');
  const [vidlyResults, setVidlyResults] = useState<ProviderResult[]>([]);
  const [vidboltResults, setVidboltResults] = useState<ProviderResult[]>([]);
  const [vidriftResults, setVidriftResults] = useState<ProviderResult[]>([]);
  const [vidyResults, setVidyResults] = useState<ProviderResult[]>([]);
  const [showServerQualityMenu, setShowServerQualityMenu] = useState<boolean>(false);
  const serverQualityMenuRef = useRef<HTMLDivElement>(null);
  const mobileServerRef = useRef<HTMLDivElement>(null);
  const serverQualityMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [mobileDrawerTab, setMobileDrawerTab] = useState<'audio' | 'subtitles' | 'quality' | 'servers'>('audio');
  const [showEpisodesTray, setShowEpisodesTray] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [selectedEpisodeChunk, setSelectedEpisodeChunk] = useState(0);
  const activeEpisodeRef = useRef<HTMLDivElement | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Aspect Ratio / Screen Fit Mode ('contain' = Fit, 'cover' = Zoom to Fill, 'fill' = Stretch)
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'fill'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('snapflix_player_fit');
      if (saved === 'contain' || saved === 'cover' || saved === 'fill') return saved;
    }
    return 'contain';
  });
  const [fitToast, setFitToast] = useState<string | null>(null);
  const fitToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cycleFitMode = useCallback(() => {
    setFitMode((prev) => {
      const next = prev === 'contain' ? 'cover' : prev === 'cover' ? 'fill' : 'contain';
      const label =
        next === 'cover'
          ? 'Zoom to Fill (Best Fit)'
          : next === 'fill'
            ? 'Stretch to Fit'
            : 'Original (Fit to Screen)';
      setFitToast(label);
      if (fitToastTimeoutRef.current) clearTimeout(fitToastTimeoutRef.current);
      fitToastTimeoutRef.current = setTimeout(() => setFitToast(null), 1600);
      try {
        localStorage.setItem('snapflix_player_fit', next);
      } catch { }
      return next;
    });
  }, []);

  // Backdrop & Overview for Netflix-Style Pause Overlay
  const [fetchedBackdrop, setFetchedBackdrop] = useState<string | null>(null);
  const [fetchedOverview, setFetchedOverview] = useState<string | null>(null);

  // YouTube-Style Double-Tap Seek States & Timers
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTouchXRef = useRef<number | null>(null);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile Pinch-to-Zoom (Screen Fit / Best Fit)
  const touchStartDistanceRef = useRef<number | null>(null);
  const pinchDeltaRef = useRef<number>(0);
  const isPinchingRef = useRef<boolean>(false);

  // Watch History & Auto-Resume States
  const { data: user } = useSupabaseUser();
  const [savedResumeTime, setSavedResumeTime] = useState<number>(0);
  const savedResumeTimeRef = useRef<number>(0);
  const hasAutoResumedRef = useRef<boolean>(false);
  const lastSavedTimeRef = useRef<number>(0);
  const lastSaveTimestampRef = useRef<number>(0);

  // Autoplay Engine: Always starts with full audio (never muted)
  const executeAutoPlay = useCallback((videoEl?: HTMLVideoElement | null) => {
    const el = videoEl || videoRef.current;
    if (!el) return;

    // Ensure audio is fully unmuted by default
    el.muted = false;
    setIsMuted(false);

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setHasStartedPlayback(true);
          setIsBuffering(false);
        })
        .catch((playErr: any) => {
          if (playErr?.name === 'NotAllowedError') {
            console.log('[Player] Browser policy requires user gesture for unmuted playback. Waiting for user interaction...');
            setIsBuffering(false);
            setIsPlaying(false);
            setShowControls(true);

            // One-time listener to start playback with full audio on first touch/click
            const startOnInteraction = () => {
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current.muted = false;
                videoRef.current.play().then(() => {
                  setIsPlaying(true);
                  setHasStartedPlayback(true);
                  setIsBuffering(false);
                }).catch(() => { });
              }
            };
            window.addEventListener('pointerdown', startOnInteraction, { once: true, passive: true });
            window.addEventListener('keydown', startOnInteraction, { once: true, passive: true });
          } else if (playErr?.name !== 'AbortError') {
            console.log('[Player] Autoplay prevented by browser:', playErr);
            setIsBuffering(false);
            setIsPlaying(false);
            setShowControls(true);
          }
        });
    }
  }, []);

  // Watch Party States & Realtime Integration
  const currentUsername =
    user?.username ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'Farhan');

  const [showPartyModal, setShowPartyModal] = useState(false);
  const isRemoteActionRef = useRef(false);

  const party = useWatchParty({
    currentUsername,
    onRemotePlay: (time, sender) => {
      if (!videoRef.current) return;
      isRemoteActionRef.current = true;
      if (Math.abs(videoRef.current.currentTime - time) > 1.2) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
      videoRef.current.play().catch(() => { });
      setIsPlaying(true);
    },
    onRemotePause: (time, sender) => {
      if (!videoRef.current) return;
      isRemoteActionRef.current = true;
      if (Math.abs(videoRef.current.currentTime - time) > 1.2) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
      videoRef.current.pause();
      setIsPlaying(false);
    },
    onRemoteSeek: (time, sender) => {
      if (!videoRef.current) return;
      isRemoteActionRef.current = true;
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    },
    onRemoteSyncRequest: () => {
      if (!videoRef.current) return;
      party.broadcastSyncState(videoRef.current.currentTime, !videoRef.current.paused);
    },
    onRemoteSyncState: (time, isPlayingRemote) => {
      if (!videoRef.current) return;
      const cur = videoRef.current.currentTime;
      if (Math.abs(cur - time) > 2.5) {
        isRemoteActionRef.current = true;
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
      if (isPlayingRemote && videoRef.current.paused) {
        isRemoteActionRef.current = true;
        videoRef.current.play().catch(() => { });
        setIsPlaying(true);
      } else if (!isPlayingRemote && !videoRef.current.paused) {
        isRemoteActionRef.current = true;
        videoRef.current.pause();
        setIsPlaying(false);
      }
    },
  });

  // Periodic Drift Sync (Host keeps partner aligned silently, every 8 seconds)
  useEffect(() => {
    if (!party.isPartyActive || !party.isHost || !isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        party.broadcastSyncState(videoRef.current.currentTime, true);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [party.isPartyActive, party.isHost, isPlaying, party.broadcastSyncState]);

  // 0. Initial resume time discovery (from prop, URL ?t=, guest localStorage, or Supabase)
  useEffect(() => {
    hasAutoResumedRef.current = false;

    const applyResumeTime = (time: number) => {
      setSavedResumeTime(time);
      savedResumeTimeRef.current = time;
    };

    // A. Check explicit initialTime prop
    if (initialTime && initialTime > 0) {
      applyResumeTime(initialTime);
      return;
    }

    // B. Check URL query param (?t=123)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const t = Number(urlParams.get('t'));
      if (t > 0) {
        applyResumeTime(t);
        return;
      }
    }

    // C. Check local guest history in localStorage
    const guestHistory = readGuestHistory();
    const mediaSeason = Number(season || (type === 'tv' ? 1 : 0));
    const mediaEpisode = Number(episode || (type === 'tv' ? 1 : 0));

    const match = guestHistory.find(
      (h) =>
        Number(h.media_id) === Number(tmdbId) &&
        h.type === type &&
        (type !== 'tv' || (Number(h.season || 1) === mediaSeason && Number(h.episode || 1) === mediaEpisode))
    );

    if (match && match.last_position > 5 && !match.completed) {
      applyResumeTime(match.last_position);
      return;
    }

    // D. If signed in, check server position
    if (user) {
      if (type === 'movie') {
        getMovieLastPosition(Number(tmdbId))
          .then((pos) => {
            if (pos > 5) applyResumeTime(pos);
          })
          .catch(() => { });
      } else {
        getTvShowLastPosition(Number(tmdbId), mediaSeason, mediaEpisode)
          .then((pos) => {
            if (pos > 5) applyResumeTime(pos);
          })
          .catch(() => { });
      }
    }
  }, [tmdbId, type, season, episode, initialTime, user]);

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

          if (detailsRes.status === 'fulfilled') {
            if (detailsRes.value?.genres) {
              genresList = detailsRes.value.genres.map((g) => g.name);
            }
            if (detailsRes.value?.backdrop_path) {
              setFetchedBackdrop(`https://image.tmdb.org/t/p/w1280${detailsRes.value.backdrop_path}`);
            }
            if (detailsRes.value?.overview) {
              setFetchedOverview(detailsRes.value.overview);
            }
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

          if (detailsRes.status === 'fulfilled') {
            if (detailsRes.value?.genres) {
              genresList = detailsRes.value.genres.map((g) => g.name);
            }
            if (detailsRes.value?.backdrop_path) {
              setFetchedBackdrop(`https://image.tmdb.org/t/p/w1280${detailsRes.value.backdrop_path}`);
            }
            if (detailsRes.value?.overview) {
              setFetchedOverview(detailsRes.value.overview);
            }
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
  const failedStreamLinksRef = useRef<Set<string>>(new Set());
  const standbyFallbackRef = useRef<{ provider: 'Vidy'; results: any[] } | null>(null);
  const userSelectedLangRef = useRef<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<string>('Hindi');
  const [hlsAudioTracks, setHlsAudioTracks] = useState<any[]>([]);
  const [currentHlsAudioTrack, setCurrentHlsAudioTrack] = useState<number>(-1);

  // Subtitle States
  const [hlsSubtitles, setHlsSubtitles] = useState<any[]>([]);
  const [uploadedSubtitles, setUploadedSubtitles] = useState<Array<{ id: string; title: string; uri: string; language?: string }>>([]);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string>('off');
  const activeSubtitleIdRef = useRef<string>('off');
  const activeSubtitleBlobUrlRef = useRef<string | null>(null);
  const [activeSubtitleUri, setActiveSubtitleUri] = useState<string | null>(null);
  const [activeSubtitleLang, setActiveSubtitleLang] = useState<string>('en');
  const [activeSubtitleLabel, setActiveSubtitleLabel] = useState<string>('Subtitles');

  // Keep ref strictly synced to prevent closure staleness in HLS and Video callbacks
  useEffect(() => {
    activeSubtitleIdRef.current = activeSubtitleId;
  }, [activeSubtitleId]);

  // Robust Subtitle Disabling helper across both Hls.js and native textTracks
  const disableAllSubtitles = useCallback((media?: HTMLMediaElement | null, hls?: Hls | null) => {
    if (hls) {
      try {
        hls.subtitleTrack = -1;
        hls.subtitleDisplay = false;
      } catch (e) { }
    }
    const el = media || videoRef.current;
    if (el?.textTracks) {
      for (let i = 0; i < el.textTracks.length; i++) {
        try {
          el.textTracks[i].mode = 'disabled';
        } catch (e) { }
      }
    }
  }, []);

  // Suppress dynamic subtitle tracks if activeSubtitleId is 'off'
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;

    const attachCueListener = (track: TextTrack) => {
      track.removeEventListener('cuechange', (track as any)._snapflixCueHandler);
      const handler = () => {
        if (activeSubtitleIdRef.current === 'off') {
          try {
            track.mode = 'disabled';
          } catch (e) { }
        }
      };
      (track as any)._snapflixCueHandler = handler;
      track.addEventListener('cuechange', handler);
    };

    for (let i = 0; i < video.textTracks.length; i++) {
      attachCueListener(video.textTracks[i]);
    }

    const handleTrackAdded = (e: TrackEvent) => {
      if (activeSubtitleIdRef.current === 'off' && e.track) {
        try {
          e.track.mode = 'disabled';
        } catch (err) { }
      } else if (e.track) {
        attachCueListener(e.track);
      }
    };

    video.textTracks.addEventListener('addtrack', handleTrackAdded);
    return () => {
      video.textTracks.removeEventListener('addtrack', handleTrackAdded);
      if (video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const t = video.textTracks[i] as any;
          if (t._snapflixCueHandler) {
            t.removeEventListener('cuechange', t._snapflixCueHandler);
          }
        }
      }
    };
  }, []);

  // Dynamically position subtitles right along the bottom movie picture boundary into the black letterbox bar
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSubtitleOffset = () => {
      const v = videoRef.current;
      if (!v) return;

      const elW = v.clientWidth || v.parentElement?.clientWidth || window.innerWidth;
      const elH = v.clientHeight || v.parentElement?.clientHeight || window.innerHeight;

      if (!elH || !elW) return;

      const videoW = v.videoWidth || 1920;
      const videoH = v.videoHeight || 1080;
      const videoAspect = videoW / videoH;
      const containerAspect = elW / elH;

      let liftPx = Math.round(elH * 0.075); // Standard fallback lift ~7.5% of container height

      if (videoAspect > containerAspect) {
        // Video has black letterbox bars top and bottom (e.g. 2.39:1 widescreen movie)
        const renderedH = elW / videoAspect;
        const bottomMovieEdge = (elH + renderedH) / 2;
        // Native bottom cue baseline is approximately at elH - 24px
        // Position cue just below bottomMovieEdge + 6px into the black bar
        const nativeCueY = elH - 24;
        const targetCueY = bottomMovieEdge + 6;
        const diff = nativeCueY - targetCueY;
        if (diff > 8 && diff < elH * 0.35) {
          liftPx = Math.round(diff);
        }
      }

      v.style.setProperty('--snapflix-cue-offset', `-${liftPx}px`);
      if (containerRef.current) {
        containerRef.current.style.setProperty('--snapflix-cue-offset', `-${liftPx}px`);
      }
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.style.setProperty('--snapflix-cue-offset', `-${liftPx}px`);
      }
    };

    updateSubtitleOffset();

    video.addEventListener('loadedmetadata', updateSubtitleOffset);
    video.addEventListener('loadeddata', updateSubtitleOffset);
    video.addEventListener('canplay', updateSubtitleOffset);
    video.addEventListener('playing', updateSubtitleOffset);
    window.addEventListener('resize', updateSubtitleOffset);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && video.parentElement) {
      ro = new ResizeObserver(updateSubtitleOffset);
      ro.observe(video.parentElement);
    }

    const t1 = setTimeout(updateSubtitleOffset, 400);
    const t2 = setTimeout(updateSubtitleOffset, 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      video.removeEventListener('loadedmetadata', updateSubtitleOffset);
      video.removeEventListener('loadeddata', updateSubtitleOffset);
      video.removeEventListener('canplay', updateSubtitleOffset);
      video.removeEventListener('playing', updateSubtitleOffset);
      window.removeEventListener('resize', updateSubtitleOffset);
      if (ro) ro.disconnect();
    };
  }, [selectedStream, isFullscreen]);

  // Revoke any active blob URL on unmount
  useEffect(() => {
    return () => {
      if (activeSubtitleBlobUrlRef.current) {
        URL.revokeObjectURL(activeSubtitleBlobUrlRef.current);
        activeSubtitleBlobUrlRef.current = null;
      }
    };
  }, []);

  // Subtitle Modal Sub-views ('main' | 'search' | 'appearance')
  const [subModalTab, setSubModalTab] = useState<'main' | 'search' | 'appearance'>('main');
  const [subSearchQuery, setSubSearchQuery] = useState<string>('');
  const [subSearchResults, setSubSearchResults] = useState<any[]>([]);
  const [isSearchingSubs, setIsSearchingSubs] = useState<boolean>(false);

  // Subtitle Appearance Customization
  const [autoSubtitles, setAutoSubtitles] = useState<Array<{ id: string; title: string; language: string; uri: string }>>([]);

  // Subtitle Appearance Customization
  const [subFontSize, setSubFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [subColor, setSubColor] = useState<'white' | 'yellow'>('white');
  const [subBg, setSubBg] = useState<'dark' | 'transparent'>('transparent');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fetch OpenSubtitles in background for media so all servers (including Vidy) have rich subtitles
  useEffect(() => {
    if (!title) return;
    let isCancelled = false;

    const fetchAutoSubs = async () => {
      try {
        const q = type === 'tv' && season && episode ? `${title} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}` : title;
        const params = new URLSearchParams({ query: q });
        if (type === 'tv') {
          if (season) params.append('season', String(season));
          if (episode) params.append('episode', String(episode));
        }

        const res = await fetch(`/api/subtitles/search?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled || !data.success || !Array.isArray(data.results)) return;

        const seenLangs = new Set<string>();
        const mapped: Array<{ id: string; title: string; language: string; uri: string }> = [];

        // Sort: English and Hindi first, then others by download count
        const sorted = [...data.results].sort((a, b) => {
          const aL = (a.language || '').toLowerCase();
          const bL = (b.language || '').toLowerCase();
          if (aL === 'english') return -1;
          if (bL === 'english') return 1;
          if (aL === 'hindi') return -1;
          if (bL === 'hindi') return 1;
          return (b.downloadsCount || 0) - (a.downloadsCount || 0);
        });

        for (const item of sorted) {
          const lang = (item.language || 'English').trim();
          const langKey = lang.toLowerCase();
          if (!seenLangs.has(langKey) && item.downloadUrl) {
            seenLangs.add(langKey);
            mapped.push({
              id: `auto-${item.id || item.downloadUrl}`,
              title: lang,
              language: lang,
              uri: item.downloadUrl,
            });
          }
          if (mapped.length >= 14) break;
        }

        if (!isCancelled && mapped.length > 0) {
          setAutoSubtitles(mapped);
        }
      } catch (e) {
        console.warn('[Player] Subtitle auto-fetch warning:', e);
      }
    };

    fetchAutoSubs();
    return () => {
      isCancelled = true;
    };
  }, [title, type, season, episode]);

  // Quality & Multi-Bitrate States
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [hlsLevels, setHlsLevels] = useState<any[]>([]);
  const [currentHlsLevel, setCurrentHlsLevel] = useState<number>(-1);
  const mobileQualityRef = useRef<HTMLDivElement>(null);

  // Screen & Pointer detection helpers
  const isMobileScreen = () => {
    return typeof window !== 'undefined' && window.innerWidth < 640;
  };

  const canHover = () => {
    return typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  };

  // Unified Server & Quality 2-Column Popover Handlers
  const handleServerQualityMouseEnter = () => {
    if (!canHover() || isMobileScreen()) return;
    if (serverQualityMenuTimeoutRef.current) clearTimeout(serverQualityMenuTimeoutRef.current);
    if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
    if (nextEpPreviewTimeoutRef.current) clearTimeout(nextEpPreviewTimeoutRef.current);
    setShowAudioMenu(false);
    setShowNextEpPreview(false);
    setShowServerQualityMenu(true);
    triggerControls();
  };

  const handleServerQualityMouseLeave = () => {
    if (!canHover() || isMobileScreen()) return;
    if (serverQualityMenuTimeoutRef.current) clearTimeout(serverQualityMenuTimeoutRef.current);
    serverQualityMenuTimeoutRef.current = setTimeout(() => {
      setShowServerQualityMenu(false);
    }, 150);
  };

  // Close server & quality menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      const target = e.target as Node;
      const insideDesktop = serverQualityMenuRef.current?.contains(target);
      const insideMobileServer = mobileServerRef.current?.contains(target);
      const insideMobileQuality = mobileQualityRef.current?.contains(target);
      if (!insideDesktop && !insideMobileServer && !insideMobileQuality) {
        setShowServerQualityMenu(false);
      }
    };
    if (showServerQualityMenu) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showServerQualityMenu]);

  // Audio Dropdown Popover Ref & Handlers
  const audioMenuRef = useRef<HTMLDivElement>(null);
  const mobileAudioRef = useRef<HTMLDivElement>(null);
  const audioMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleAudioMouseEnter = () => {
    if (!canHover() || isMobileScreen()) return;
    if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
    if (serverQualityMenuTimeoutRef.current) clearTimeout(serverQualityMenuTimeoutRef.current);
    if (nextEpPreviewTimeoutRef.current) clearTimeout(nextEpPreviewTimeoutRef.current);
    setShowServerQualityMenu(false);
    setShowNextEpPreview(false);
    setShowAudioMenu(true);
    triggerControls();
  };

  const handleAudioMouseLeave = () => {
    if (!canHover() || isMobileScreen()) return;
    if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
    audioMenuTimeoutRef.current = setTimeout(() => {
      setShowAudioMenu(false);
    }, 150);
  };

  // Close audio menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      const target = e.target as Node;
      const insideDesktop = audioMenuRef.current?.contains(target);
      const insideMobile = mobileAudioRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) {
        setShowAudioMenu(false);
      }
    };
    if (showAudioMenu) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showAudioMenu]);

  // Next Episode Preview Popover Ref & Handlers
  const nextEpPreviewRef = useRef<HTMLDivElement>(null);
  const nextEpPreviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showNextEpPreview, setShowNextEpPreview] = useState(false);

  const nextEpisodeData = useMemo(() => {
    if (!episodes || !episode) return null;
    return episodes.find((e) => e.episode_number === episode + 1) || null;
  }, [episodes, episode]);

  const handleNextEpMouseEnter = () => {
    if (!canHover() || isMobileScreen()) return;
    if (nextEpPreviewTimeoutRef.current) clearTimeout(nextEpPreviewTimeoutRef.current);
    if (serverQualityMenuTimeoutRef.current) clearTimeout(serverQualityMenuTimeoutRef.current);
    if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
    setShowServerQualityMenu(false);
    setShowAudioMenu(false);
    setShowNextEpPreview(true);
    triggerControls();
  };

  const handleNextEpMouseLeave = () => {
    if (!canHover() || isMobileScreen()) return;
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

  // Available spoken languages across all active providers & current stream HLS tracks
  const availableLanguages = useMemo(() => {
    const counts = new Map<string, number>();
    const seenLinks = new Set<string>();

    const allProvidersList = [
      ...providerResults,
      ...vidlyResults,
      ...vidboltResults,
      ...vidriftResults,
      ...vidyResults,
    ];

    allProvidersList.forEach((prov) => {
      prov.streams?.forEach((s) => {
        if (!isPlayableStream(s)) return;
        const linkKey = s.link || String(prov.providerName);
        if (seenLinks.has(linkKey)) return;
        seenLinks.add(linkKey);

        const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
        langs.forEach((lang) => {
          counts.set(lang, (counts.get(lang) || 0) + 1);
        });
      });
    });

    // Also include live HLS internal audio tracks if available for current stream (only if multiple tracks exist)
    const effectiveHlsTracks = (hlsAudioTracks.length > 0 ? hlsAudioTracks : (hlsRef.current?.audioTracks || []));
    if (effectiveHlsTracks.length > 1) {
      effectiveHlsTracks.forEach((track: any) => {
        const namePart = (track.name || '').trim();
        const langPart = (track.lang || '').trim();
        const parsed = parseWordToLanguage(namePart) || parseWordToLanguage(langPart);
        if (parsed && !counts.has(parsed)) {
          counts.set(parsed, 1);
        } else if (!parsed) {
          const raw = namePart || langPart;
          if (raw.length > 1) {
            const lower = raw.toLowerCase();
            if (!GENERIC_AUDIO_LABELS.has(lower) && !lower.startsWith('audio') && !lower.startsWith('track')) {
              const titleCased = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
              if (!counts.has(titleCased)) {
                counts.set(titleCased, 1);
              }
            }
          }
        }
      });
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (a.name === 'Hindi') return -1;
        if (b.name === 'Hindi') return 1;
        if (a.name === 'English') return -1;
        if (b.name === 'English') return 1;
        return b.count - a.count;
      });
  }, [providerResults, vidlyResults, vidboltResults, vidriftResults, vidyResults, originalLanguage, hlsAudioTracks]);

  // Keep activeLanguage in sync with current stream
  useEffect(() => {
    if (!selectedStream) return;

    // If the user manually selected an audio language, respect their choice and don't auto-reset it!
    if (userSelectedLangRef.current) {
      setActiveLanguage(userSelectedLangRef.current);
      return;
    }

    const currentProv =
      providerResults.find((p) => p.providerName === selectedStream.providerName) ||
      vidlyResults.find((p) => p.providerName === selectedStream.providerName) ||
      vidboltResults.find((p) => p.providerName === selectedStream.providerName) ||
      vidriftResults.find((p) => p.providerName === selectedStream.providerName) ||
      vidyResults.find((p) => p.providerName === selectedStream.providerName);

    const streamLangs = getStreamAudioLanguages(selectedStream, currentProv?.infoTitle, originalLanguage);

    // If stream has explicit dedicated language (e.g. Hindi stream), keep activeLanguage aligned with it!
    if (streamLangs.length > 0 && !streamLangs.includes('English') && streamLangs.includes(activeLanguage)) {
      return;
    }

    if (isHlsStream(selectedStream)) {
      // Only check internal tracks if stream itself has multiple internal audio tracks
      if (hlsAudioTracks.length > 1) {
        const hasTrack = hlsAudioTracks.some((t: any) => {
          const tLang = (t.lang || '').toLowerCase();
          const tName = (t.name || '').toLowerCase();
          const aliases = LANG_CODE_ALIASES[activeLanguage] || [activeLanguage.toLowerCase()];
          return aliases.some((a) => tLang === a || tName.includes(a));
        });
        if (!hasTrack) {
          const currentTrack = hlsAudioTracks[currentHlsAudioTrack >= 0 ? currentHlsAudioTrack : 0];
          const detected = parseWordToLanguage(currentTrack?.name || currentTrack?.lang || '');
          if (detected) {
            setActiveLanguage(detected);
          }
        }
      }
      return;
    }

    if (streamLangs.length > 0 && !streamLangs.includes(activeLanguage)) {
      if (streamLangs.includes('Hindi')) {
        setActiveLanguage('Hindi');
      } else {
        setActiveLanguage(streamLangs[0]);
      }
    }
  }, [selectedStream, providerResults, vidlyResults, vidboltResults, vidriftResults, vidyResults, originalLanguage, hlsAudioTracks, currentHlsAudioTrack]);

  // Instant Audio Switcher Handler: switches audio immediately without redirecting to servers list
  const handleSelectLanguage = (targetLang: string) => {
    userSelectedLangRef.current = targetLang;
    setActiveLanguage(targetLang);

    // 1. If current playing HLS has MULTIPLE internal tracks (> 1), switch internal track directly
    const effectiveTracks = (hlsRef.current?.audioTracks && hlsRef.current.audioTracks.length > 0)
      ? hlsRef.current.audioTracks
      : hlsAudioTracks;

    if (hlsRef.current && effectiveTracks && effectiveTracks.length > 1) {
      const aliases = LANG_CODE_ALIASES[targetLang] || [targetLang.toLowerCase()];
      const trackIdx = effectiveTracks.findIndex((t: any) => {
        const tLang = (t.lang || '').toLowerCase().trim();
        const tName = (t.name || '').toLowerCase().trim();
        const parsed = parseWordToLanguage(tName) || parseWordToLanguage(tLang);
        return (
          parsed === targetLang ||
          tName === targetLang.toLowerCase() ||
          tLang === targetLang.toLowerCase() ||
          aliases.some((a) => tLang === a || tName === a || tName.includes(a) || tLang.includes(a))
        );
      });
      if (trackIdx !== -1) {
        const track = effectiveTracks[trackIdx];
        const trackIdToSet = typeof track?.id === 'number' ? track.id : trackIdx;
        hlsRef.current.audioTrack = trackIdToSet;
        setCurrentHlsAudioTrack(trackIdx);
        setShowAudioMenu(false);
        setShowMobileDrawer(false);
        return;
      }
    }

    // 2. Cross-server switch: find best playable stream supporting targetLang across providers
    let candidateStream: StreamItem | null = null;
    let targetProvKey: 'vidly' | 'vidbolt' | 'vidrift' | 'vidy' = activeServerProvider;
    let targetProvList: ProviderResult[] = providerResults;

    const allProvidersWithKeys: Array<{ key: 'vidly' | 'vidbolt' | 'vidrift' | 'vidy'; results: ProviderResult[] }> = [
      { key: 'vidly', results: vidlyResults },
      { key: 'vidbolt', results: vidboltResults },
      { key: 'vidrift', results: vidriftResults },
      { key: 'vidy', results: vidyResults },
    ];

    // A. Check current active provider first
    const currentActiveGroup = allProvidersWithKeys.find((g) => g.key === activeServerProvider);
    if (currentActiveGroup) {
      for (const prov of currentActiveGroup.results) {
        const matches = prov.streams.filter((s) => {
          if (!isPlayableStream(s)) return false;
          const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
          return langs.includes(targetLang);
        });
        if (matches.length > 0) {
          const currentQ = selectedStream?.quality || '';
          const sameQuality = currentQ ? matches.find((s) => s.link !== selectedStream?.link && s.quality === currentQ) : null;
          const diff = sameQuality || matches.find((s) => s.link !== selectedStream?.link) || matches[0];
          candidateStream = { ...diff, providerName: prov.providerName };
          targetProvKey = currentActiveGroup.key;
          targetProvList = currentActiveGroup.results;
          break;
        }
      }
    }

    // B. If current provider has no alternative stream for targetLang, search ALL other providers
    if (!candidateStream) {
      for (const group of allProvidersWithKeys) {
        if (group.key === activeServerProvider) continue;
        for (const prov of group.results) {
          const matches = prov.streams.filter((s) => {
            if (!isPlayableStream(s)) return false;
            const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
            return langs.includes(targetLang);
          });
          if (matches.length > 0) {
            const currentQ = selectedStream?.quality || '';
            const sameQuality = currentQ ? matches.find((s) => s.quality === currentQ) : null;
            const diff = sameQuality || matches[0];
            candidateStream = { ...diff, providerName: prov.providerName };
            targetProvKey = group.key;
            targetProvList = group.results;
            break;
          }
        }
        if (candidateStream) break;
      }
    }

    if (candidateStream) {
      resumeTimeRef.current = videoRef.current?.currentTime || currentTime || 0;
      setActiveServerProvider(targetProvKey);
      setProviderResults(targetProvList);
      setSelectedStream(candidateStream);

      setShowAudioMenu(false);
      setShowMobileDrawer(false);
      return;
    }

    setShowAudioMenu(false);
    setShowMobileDrawer(false);
  };

  interface UniqueServerOption {
    id: string;
    name: string;
    provider: 'vidly' | 'vidbolt' | 'vidrift' | 'vidy';
    streams: StreamItem[];
  }

  // Deduplicated servers list (Server 1: SnapFlix Fast, Server 2: VidBolt, Server 3: VidRift, Server 4: Vidy Standby)
  const availableServers = useMemo<UniqueServerOption[]>(() => {
    const list: UniqueServerOption[] = [];

    // Server 1: SnapFlix Fast (Vidly)
    const vidlyStreams: StreamItem[] = [];
    vidlyResults.forEach((prov) => {
      prov.streams?.forEach((s) => {
        if (isPlayableStream(s)) {
          vidlyStreams.push({ ...s, providerName: prov.providerName });
        }
      });
    });
    if (vidlyStreams.length > 0) {
      list.push({
        id: 'server-1-vidly',
        name: 'Server 1: SnapFlix Fast',
        provider: 'vidly',
        streams: vidlyStreams,
      });
    }

    // Server 2: VidBolt
    const vidboltStreams: StreamItem[] = [];
    vidboltResults.forEach((prov) => {
      prov.streams?.forEach((s) => {
        if (isPlayableStream(s)) {
          vidboltStreams.push({ ...s, providerName: prov.providerName });
        }
      });
    });
    if (vidboltStreams.length > 0) {
      list.push({
        id: 'server-2-vidbolt',
        name: 'Server 2: VidBolt (Multi-Audio)',
        provider: 'vidbolt',
        streams: vidboltStreams,
      });
    }

    // Server 3: VidRift (All audio dubs merged into one clean server)
    const vidriftStreams: StreamItem[] = [];
    vidriftResults.forEach((prov) => {
      prov.streams?.forEach((s) => {
        if (isPlayableStream(s)) {
          vidriftStreams.push({ ...s, providerName: prov.providerName });
        }
      });
    });
    if (vidriftStreams.length > 0) {
      list.push({
        id: 'server-3-vidrift',
        name: 'Server 3: VidRift (Multi-Audio)',
        provider: 'vidrift',
        streams: vidriftStreams,
      });
    }

    // Server 4: Vidy Standby
    const vidyStreams: StreamItem[] = [];
    vidyResults.forEach((prov) => {
      prov.streams?.forEach((s) => {
        if (isPlayableStream(s)) {
          vidyStreams.push({ ...s, providerName: prov.providerName });
        }
      });
    });
    if (vidyStreams.length > 0) {
      list.push({
        id: 'server-4-vidy',
        name: 'Server 4: Vidy Standby',
        provider: 'vidy',
        streams: vidyStreams,
      });
    }

    return list;
  }, [vidlyResults, vidboltResults, vidriftResults, vidyResults]);

  // Handle Manual Server Switching between Vidly, VidBolt, VidRift, and Vidy
  const handleSelectServer = (targetProvider: 'vidly' | 'vidbolt' | 'vidrift' | 'vidy', stream: StreamItem) => {
    if (stream.link === selectedStream?.link) {
      setShowServerQualityMenu(false);
      setShowMobileDrawer(false);
      return;
    }

    resumeTimeRef.current = videoRef.current?.currentTime || currentTime || 0;
    setActiveServerProvider(targetProvider);

    const results =
      targetProvider === 'vidly'
        ? vidlyResults
        : targetProvider === 'vidbolt'
          ? vidboltResults
          : targetProvider === 'vidrift'
            ? vidriftResults
            : vidyResults;
    if (results && results.length > 0) {
      setProviderResults(results);
    }

    setHlsLevels([]);
    setCurrentHlsLevel(-1);
    setHlsAudioTracks([]);
    setCurrentHlsAudioTrack(-1);
    setSelectedQuality('auto');
    setPlaybackError(null);

    // Reset HLS subtitles and clean up previous server subtitles
    setHlsSubtitles([]);
    if (activeSubtitleIdRef.current) {
      if (activeSubtitleIdRef.current.startsWith('hls-') || activeSubtitleIdRef.current.startsWith('prov-') || activeSubtitleIdRef.current.startsWith('provider-')) {
        // Find if this subtitle exists in the new server streams or switch to off/external
        const targetSubList = stream.subtitles || [];
        const matchingSub = targetSubList.find((s) => s.uri === activeSubtitleUri);
        if (!matchingSub) {
          // Check if OpenSubtitles has a matching language or turn off
          const prevLang = (activeSubtitleIdRef.current || 'english').toLowerCase();
          const altSub = autoSubtitles.find(s => s.uri && (
            (s.language && s.language.toLowerCase().includes(prevLang)) ||
            (s.title && s.title.toLowerCase().includes(prevLang))
          ));
          if (altSub) {
            setTimeout(() => handleSelectSubtitle(altSub.id), 250);
          } else {
            setActiveSubtitleId('off');
            activeSubtitleIdRef.current = 'off';
            setActiveSubtitleUri(null);
            disableAllSubtitles(videoRef.current, hlsRef.current);
          }
        }
      }
    }

    // Refresh Audio Language for new server:
    // If the new server stream doesn't match activeLanguage, align with the new stream's language
    const currentProvForStream = results?.find(p => p.providerName === (stream.providerName || (targetProvider === 'vidly' ? 'Vidly Edge' : targetProvider === 'vidbolt' ? 'SnapFlix VidBolt' : targetProvider === 'vidrift' ? 'VidRift Fast HLS' : 'Vidy VPS')));
    const streamLangs = getStreamAudioLanguages(stream, currentProvForStream?.infoTitle, originalLanguage);
    if (streamLangs.length > 0 && !streamLangs.includes(activeLanguage)) {
      if (streamLangs.includes('Hindi')) {
        setActiveLanguage('Hindi');
      } else {
        setActiveLanguage(streamLangs[0]);
      }
    }

    setSelectedStream({
      ...stream,
      providerName: stream.providerName || (targetProvider === 'vidly' ? 'Vidly Edge' : targetProvider === 'vidbolt' ? 'SnapFlix VidBolt' : targetProvider === 'vidrift' ? 'VidRift Fast HLS' : 'Vidy VPS'),
    });

    setShowServerQualityMenu(false);
    setShowMobileDrawer(false);
    triggerControls();
  };

  const handleSelectServerOption = (server: UniqueServerOption) => {
    const isCurrentActive =
      activeServerProvider === server.provider ||
      server.streams.some((s) => s.link === selectedStream?.link);

    if (isCurrentActive && selectedStream) {
      setShowServerQualityMenu(false);
      setShowMobileDrawer(false);
      return;
    }

    // Pick stream matching ACTIVE AUDIO LANGUAGE first (e.g. Hindi, English, etc.)
    const langMatches = server.streams.filter((s) => {
      const langs = getStreamAudioLanguages(s, undefined, originalLanguage);
      return langs.includes(activeLanguage);
    });

    const targetPool = langMatches.length > 0 ? langMatches : server.streams;

    const targetStream =
      (selectedQuality !== 'auto'
        ? targetPool.find((s) => (s.quality || '').toLowerCase().includes(selectedQuality.replace('p', '')))
        : null) || targetPool[0];

    handleSelectServer(server.provider, targetStream);
  };

  // Aggregated qualities across all providers for CURRENT activeLanguage
  const availableQualities = useMemo(() => {
    const discovered = new Set<string>();

    // 1. Check in-stream HLS levels
    if (hlsLevels.length > 1) {
      hlsLevels.forEach((lvl) => {
        const h = lvl.height || 0;
        if (h >= 2000) discovered.add('2160p');
        else if (h >= 1350) discovered.add('1440p');
        else if (h >= 1000) discovered.add('1080p');
        else if (h >= 700) discovered.add('720p');
        else if (h >= 450) discovered.add('480p');
        else if (h > 0) discovered.add('360p');
      });
    }

    // 2. Check all playable streams matching activeLanguage
    providerResults.forEach((prov) => {
      prov.streams.forEach((s) => {
        if (!isPlayableStream(s)) return;

        const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
        if (!langs.includes(activeLanguage)) return;

        const q = (s.quality || '').toLowerCase();
        const serverText = (s.server || '').toLowerCase();

        if (q.includes('2160') || q.includes('4k') || serverText.includes('4k') || serverText.includes('2160')) {
          discovered.add('2160p');
        }
        if (q.includes('1440') || serverText.includes('1440') || q.includes('2k') || serverText.includes('2k')) {
          discovered.add('1440p');
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

    const options: { key: string; label: string }[] = [
      { key: 'auto', label: 'Auto' },
    ];

    if (discovered.has('2160p')) {
      options.push({ key: '2160p', label: '4K' });
    }
    if (discovered.has('1440p')) {
      options.push({ key: '1440p', label: '1440p' });
    }
    if (discovered.has('1080p') || options.length === 1) {
      options.push({ key: '1080p', label: '1080p' });
    }
    if (discovered.has('720p')) {
      options.push({ key: '720p', label: '720p' });
    }
    if (discovered.has('480p')) {
      options.push({ key: '480p', label: '480p' });
    } else if (discovered.has('360p')) {
      options.push({ key: '360p', label: '360p' });
    }

    return options;
  }, [hlsLevels, providerResults, activeLanguage, originalLanguage]);

  // Handle Quality Selection (Strictly preserves currently active audio language)
  const handleSelectQuality = (targetQuality: string) => {
    setSelectedQuality(targetQuality);
    setShowServerQualityMenu(false);
    setShowMobileDrawer(false);

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
        if (!isPlayableStream(s)) return false;

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

    // 3. Fallback: match by target quality only within active providerResults
    if (!candidate) {
      for (const prov of providerResults) {
        const match = prov.streams.find((s) => {
          if (!isPlayableStream(s)) return false;
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
    }

    if (candidate && candidate.link !== selectedStream?.link) {
      resumeTimeRef.current = videoRef.current?.currentTime || currentTime || 0;
      setSelectedStream(candidate);
    }
  };

  // Scoped Subtitles across current active provider streams + current HLS tracks + universal OpenSubtitles + uploaded tracks
  const availableSubtitles = useMemo(() => {
    const list: Array<{ id: string; title: string; language?: string; uri?: string; hlsIndex?: number; headers?: Record<string, string> }> = [];
    const seenUris = new Set<string>();
    const seenTitles = new Set<string>();

    // 1. From active provider's currently selected stream
    if (selectedStream?.subtitles && Array.isArray(selectedStream.subtitles)) {
      selectedStream.subtitles.forEach((s, idx) => {
        const u = s.uri;
        if (u) seenUris.add(u);
        const name = s.title || s.language || ("Subtitle " + (idx + 1));
        seenTitles.add(name.toLowerCase());
        list.push({
          id: "provider-" + idx + "-" + (u || s.language),
          title: name,
          language: s.language,
          uri: u,
          headers: selectedStream.headers,
        });
      });
    }

    // 2. From all streams of the CURRENT active server (providerResults only)
    providerResults.forEach((prov) => {
      prov.streams?.forEach((s) => {
        if (s.subtitles && Array.isArray(s.subtitles)) {
          s.subtitles.forEach((sub, idx) => {
            if (sub.uri && !seenUris.has(sub.uri)) {
              seenUris.add(sub.uri);
              const name = sub.title || sub.language || ("Subtitle " + (list.length + 1));
              seenTitles.add(name.toLowerCase());
              list.push({
                id: "prov-" + prov.providerName + "-" + idx + "-" + sub.uri,
                title: name,
                language: sub.language,
                uri: sub.uri,
                headers: s.headers,
              });
            }
          });
        }
      });
    });

    // 3. From current HLS stream internal tracks
    hlsSubtitles.forEach((track, idx) => {
      const name = track.name || track.lang || ("Track " + (idx + 1));
      if (!list.some(s => s.title.toLowerCase() === name.toLowerCase())) {
        seenTitles.add(name.toLowerCase());
        list.push({
          id: "hls-" + idx,
          title: name,
          language: track.lang,
          hlsIndex: idx,
        });
      }
    });

    // 4. Auto-fetched OpenSubtitles (available for all servers, including Vidy VPS!)
    autoSubtitles.forEach((sub) => {
      if (!seenTitles.has(sub.title.toLowerCase()) && !seenUris.has(sub.uri)) {
        seenUris.add(sub.uri);
        seenTitles.add(sub.title.toLowerCase());
        list.push(sub);
      }
    });

    // 5. User uploaded / searched subtitles
    uploadedSubtitles.forEach(s => list.push(s));

    return list;
  }, [selectedStream, providerResults, hlsSubtitles, autoSubtitles, uploadedSubtitles]);

  // Handle Subtitle Selection
  const handleSelectSubtitle = (subId: string) => {
    setActiveSubtitleId(subId);
    activeSubtitleIdRef.current = subId;

    if (subId === 'off') {
      setActiveSubtitleUri(null);
      if (activeSubtitleBlobUrlRef.current) {
        URL.revokeObjectURL(activeSubtitleBlobUrlRef.current);
        activeSubtitleBlobUrlRef.current = null;
      }
      disableAllSubtitles(videoRef.current, hlsRef.current);
      return;
    }

    const targetSub = availableSubtitles.find(s => s.id === subId);
    if (!targetSub) return;

    if (targetSub.hlsIndex !== undefined && hlsRef.current) {
      if (activeSubtitleBlobUrlRef.current) {
        URL.revokeObjectURL(activeSubtitleBlobUrlRef.current);
        activeSubtitleBlobUrlRef.current = null;
      }
      setActiveSubtitleUri(null);

      if (videoRef.current?.textTracks) {
        for (let i = 0; i < videoRef.current.textTracks.length; i++) {
          if (i !== targetSub.hlsIndex) {
            videoRef.current.textTracks[i].mode = 'disabled';
          }
        }
      }

      hlsRef.current.subtitleDisplay = true;
      hlsRef.current.subtitleTrack = targetSub.hlsIndex;

      if (videoRef.current?.textTracks && videoRef.current.textTracks[targetSub.hlsIndex]) {
        videoRef.current.textTracks[targetSub.hlsIndex].mode = 'showing';
      }
    } else if (targetSub.uri) {
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = -1;
        hlsRef.current.subtitleDisplay = false;
      }
      if (videoRef.current?.textTracks) {
        for (let i = 0; i < videoRef.current.textTracks.length; i++) {
          videoRef.current.textTracks[i].mode = 'disabled';
        }
      }

      setActiveSubtitleLang(targetSub.language || 'en');
      setActiveSubtitleLabel(targetSub.title);

      if (targetSub.uri.startsWith('blob:')) {
        setActiveSubtitleUri(targetSub.uri);
        return;
      }

      const headersObj = targetSub.headers || selectedStream?.headers || {};
      const headersParam = Object.keys(headersObj).length > 0
        ? `&headers=${encodeURIComponent(JSON.stringify(headersObj))}`
        : '';
      const downloadProxyUrl = `/api/subtitles/download?url=${encodeURIComponent(targetSub.uri)}${headersParam}`;

      if (activeSubtitleBlobUrlRef.current) {
        URL.revokeObjectURL(activeSubtitleBlobUrlRef.current);
        activeSubtitleBlobUrlRef.current = null;
      }

      fetch(downloadProxyUrl)
        .then(async (res) => {
          if (!res.ok) throw new Error(`Subtitle download failed with status ${res.status}`);
          const vttText = await res.text();
          const blob = new Blob([vttText], { type: 'text/vtt;charset=utf-8' });
          const blobUrl = URL.createObjectURL(blob);
          activeSubtitleBlobUrlRef.current = blobUrl;
          setActiveSubtitleUri(blobUrl);
        })
        .catch((err) => {
          console.warn('[Player] Subtitle blob proxy fetch failed, falling back to direct proxy URL:', err);
          setActiveSubtitleUri(downloadProxyUrl);
        });
    }
  };

  // Ensure dynamically loaded textTracks are actively set to 'showing' in Chromium/WebKit
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeSubtitleUri || activeSubtitleIdRef.current === 'off') return;

    const enforceMode = () => {
      if (!v.textTracks) return;
      for (let i = 0; i < v.textTracks.length; i++) {
        const t = v.textTracks[i];
        if (t.kind === 'subtitles') {
          t.mode = 'showing';
        }
      }
    };

    enforceMode();
    const t1 = setTimeout(enforceMode, 60);
    const t2 = setTimeout(enforceMode, 250);
    const t3 = setTimeout(enforceMode, 700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeSubtitleUri, activeSubtitleId]);

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
          .replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      }

      // Clean up conflicting line settings so player dynamic styles position cues uniformly
      content = content.replace(
        /((?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3})([^\r\n]*)/g,
        (_match, timing, settings) => {
          const cleanSettings = (settings || '').replace(/\bline:\S+/g, '').replace(/\bposition:\S+/g, '').replace(/\balign:\S+/g, '').replace(/\bsize:\S+/g, '').trim();
          return `${timing}${cleanSettings ? ' ' + cleanSettings : ''}`.trim();
        }
      );

      const blob = new Blob([content], { type: 'text/vtt;charset=utf-8' });
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

    // Mark current failing stream so we don't retry it in a ping-pong loop
    failedStreamLinksRef.current.add(selectedStream.link);

    // 1. First priority: alternative stream with matching active language
    for (const prov of providerResults) {
      const altMatch = prov.streams.find((s) => {
        const isPlayable =
          isPlayableStream(s) &&
          s.link !== selectedStream.link &&
          !failedStreamLinksRef.current.has(s.link);
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

    // 2. Secondary fallback: any other playable stream in current provider that hasn't failed yet
    for (const prov of providerResults) {
      const fallbackMatch = prov.streams.find((s) => {
        return (
          isPlayableStream(s) &&
          s.link !== selectedStream.link &&
          !failedStreamLinksRef.current.has(s.link)
        );
      });

      if (fallbackMatch) {
        console.log(`[Player] Secondary auto-failover to alternative server: ${prov.providerName} (${fallbackMatch.server})`);
        resumeTimeRef.current = videoRef.current?.currentTime || currentTime || 0;
        setSelectedStream({ ...fallbackMatch, providerName: prov.providerName });
        return true;
      }
    }

    // 3. Standby Fallback (Vidy): If primary provider (Vidly) has exhausted all streams, activate Vidy!
    if (standbyFallbackRef.current?.results?.length) {
      console.log('[Player] Primary streams exhausted. Activating Standby Fallback (Vidy)...');
      const fallbackResults = standbyFallbackRef.current.results;
      standbyFallbackRef.current = null; // Clear so we don't re-enter in a loop
      setActiveServerProvider('vidy');
      setVidyResults(fallbackResults);
      setProviderResults(fallbackResults);

      // Try matching active language in Vidy
      for (const prov of fallbackResults) {
        const langMatch = prov.streams.find((s: StreamItem) => {
          if (!isPlayableStream(s) || failedStreamLinksRef.current.has(s.link)) return false;
          const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
          return langs.includes(activeLanguage);
        });
        if (langMatch) {
          console.log(`[Player] Fallback Vidy stream selected with language ${activeLanguage}: ${langMatch.server}`);
          resumeTimeRef.current = videoRef.current?.currentTime || currentTime || 0;
          setSelectedStream({ ...langMatch, providerName: prov.providerName });
          return true;
        }
      }

      // Fallback to any playable Vidy stream
      for (const prov of fallbackResults) {
        const anyMatch = prov.streams.find((s: StreamItem) => {
          return isPlayableStream(s) && !failedStreamLinksRef.current.has(s.link);
        });
        if (anyMatch) {
          console.log(`[Player] Fallback Vidy stream selected: ${anyMatch.server}`);
          resumeTimeRef.current = videoRef.current?.currentTime || currentTime || 0;
          setSelectedStream({ ...anyMatch, providerName: prov.providerName });
          return true;
        }
      }
    }

    return false;
  }, [selectedStream, providerResults, activeLanguage, originalLanguage, currentTime]);

  // Compute first playable stream (for quick-switch when MKV or error occurs)
  const firstPlayableStream = useMemo(() => {
    for (const prov of providerResults) {
      const match = prov.streams.find((s) => isPlayableStream(s));
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
      failedStreamLinksRef.current.clear();

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

        const primaryApiBase = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://vidly.snapflix.indevs.in').replace(/\/$/, '');
        const vidboltApiBase = (process.env.NEXT_PUBLIC_VIDBOLT_URL || 'https://vidbolt.snapflix.indevs.in').replace(/\/$/, '');
        const vidriftApiBase = (process.env.NEXT_PUBLIC_VIDRIFT_URL || 'https://vidrift.snapflix.indevs.in').replace(/\/$/, '');
        const secondaryApiBase = (process.env.NEXT_PUBLIC_BACKEND_URL_TIER2 || 'https://vidy.snapflix.indevs.in').replace(/\/$/, '');

        const primaryUrl = `${primaryApiBase}/api/provider/resolve?${params.toString()}`;
        const vidboltUrl = `${vidboltApiBase}/api/provider/resolve?${params.toString()}`;
        const vidriftUrl = `${vidriftApiBase}/api/provider/resolve?${params.toString()}`;
        const secUrl = `${secondaryApiBase}/api/provider/resolve?${params.toString()}`;

        // Reset standby fallback and results for this new media load
        standbyFallbackRef.current = null;
        setVidlyResults([]);
        setVidboltResults([]);
        setVidriftResults([]);
        setVidyResults([]);
        setHlsAudioTracks([]);
        setCurrentHlsAudioTrack(-1);
        userSelectedLangRef.current = null;

        // Parallel initiation: Fetch Vidly, VidBolt, VidRift, and Vidy simultaneously
        const primaryPromise = fetch(primaryUrl)
          .then(async (r) => (r.ok ? r.json() : null))
          .catch((err) => {
            console.warn('[Player] Vidly resolve network error:', err);
            return null;
          });

        const vidboltPromise = fetch(vidboltUrl)
          .then(async (r) => (r.ok ? r.json() : null))
          .catch((err) => {
            console.warn('[Player] VidBolt resolve network error:', err);
            return null;
          });

        const vidriftPromise = fetch(vidriftUrl)
          .then(async (r) => (r.ok ? r.json() : null))
          .catch((err) => {
            console.warn('[Player] VidRift resolve network error:', err);
            return null;
          });

        const secPromise = fetch(secUrl)
          .then(async (r) => (r.ok ? r.json() : null))
          .catch((err) => {
            console.warn('[Player] Vidy standby network error:', err);
            return null;
          });

        // Pre-warm VidBolt, VidRift & Vidy in memory (passive background)
        vidboltPromise.then((vbData) => {
          if (active && vbData?.success && Array.isArray(vbData.results) && vbData.results.length > 0) {
            setVidboltResults(vbData.results);
            console.log('[Player] Server 2 (VidBolt) pre-warmed & ready in memory');
          }
        });

        vidriftPromise.then((vrData) => {
          if (active && vrData?.success && Array.isArray(vrData.results) && vrData.results.length > 0) {
            setVidriftResults(vrData.results);
            console.log('[Player] Server 3 (VidRift) pre-warmed & ready in memory');
          }
        });

        secPromise.then((secData) => {
          if (active && secData?.success && Array.isArray(secData.results) && secData.results.length > 0) {
            setVidyResults(secData.results);
            standbyFallbackRef.current = { provider: 'Vidy', results: secData.results };
            console.log('[Player] Standby fallback (Vidy) pre-warmed & cached in memory');
          }
        });

        // 1. Await Vidly (Primary Edge)
        const primaryData = await primaryPromise;
        let chosenResults: any[] = [];
        let chosenProvider: 'vidly' | 'vidbolt' | 'vidrift' | 'vidy' = 'vidly';

        const hasValidPrimary =
          primaryData?.success &&
          Array.isArray(primaryData.results) &&
          primaryData.results.some((p: any) => p.streams?.some((s: StreamItem) => isPlayableStream(s)));

        if (hasValidPrimary) {
          console.log('[Player] Primary provider (Vidly) active with master multi-audio stream');
          chosenResults = primaryData.results;
          setVidlyResults(primaryData.results);
          chosenProvider = 'vidly';
        } else {
          console.warn('[Player] Vidly returned no playable streams. Trying Server 2 (VidBolt)...');
          const vbData = await vidboltPromise;
          if (vbData?.success && Array.isArray(vbData.results) && vbData.results.length > 0) {
            chosenResults = vbData.results;
            setVidboltResults(vbData.results);
            chosenProvider = 'vidbolt';
          } else {
            console.warn('[Player] VidBolt returned no streams. Trying Server 3 (VidRift)...');
            const vrData = await vidriftPromise;
            if (vrData?.success && Array.isArray(vrData.results) && vrData.results.length > 0) {
              chosenResults = vrData.results;
              setVidriftResults(vrData.results);
              chosenProvider = 'vidrift';
            } else {
              console.warn('[Player] VidRift returned no streams. Falling back to Server 4 (Vidy)...');
              const secData = await secPromise;
              if (secData?.success && Array.isArray(secData.results) && secData.results.length > 0) {
                chosenResults = secData.results;
                setVidyResults(secData.results);
                chosenProvider = 'vidy';
              }
            }
          }
        }

        if (!active) return;

        if (chosenResults.length === 0) {
          throw new Error('No stream available from active providers.');
        }

        setActiveServerProvider(chosenProvider);
        // Set providerResults to the active provider ONLY (never mixed!)
        setProviderResults(chosenResults);

        // Pick the best streamable stream (m3u8 or mp4) - prioritizing Hindi audio
        let chosen: StreamItem | null = null;

        // 1. Check if any playable stream explicitly has Hindi audio
        for (const prov of chosenResults) {
          const hindiMatch = prov.streams.find((s: StreamItem) => {
            if (!isPlayableStream(s)) return false;
            const langs = getStreamAudioLanguages(s, prov.infoTitle, originalLanguage);
            return langs.includes('Hindi');
          });
          if (hindiMatch) {
            chosen = { ...hindiMatch, providerName: prov.providerName };
            setActiveLanguage('Hindi');
            break;
          }
        }

        // 2. If no explicit Hindi stream, pick first playable stream (e.g. Adaptive HLS with multi-audio)
        if (!chosen) {
          for (const prov of chosenResults) {
            const match = prov.streams.find((s: StreamItem) => isPlayableStream(s));
            if (match) {
              const streamChoice = { ...match, providerName: prov.providerName };
              chosen = streamChoice;
              const initialLangs = getStreamAudioLanguages(streamChoice, prov.infoTitle, originalLanguage);
              if (initialLangs.includes('Hindi')) {
                setActiveLanguage('Hindi');
              } else if (isHlsStream(streamChoice)) {
                // Adaptive HLS (e.g. Vidly Fast) contains internal multi-audio tracks in its manifest.
                // Keep 'Hindi' as the preferred activeLanguage so HLS MANIFEST_PARSED auto-selects Hindi track if available!
                setActiveLanguage('Hindi');
              } else {
                setActiveLanguage(initialLangs[0] || 'English');
              }
              break;
            }
          }
        }

        if (!chosen && chosenResults[0]?.streams?.length > 0) {
          const fallbackChoice = {
            ...chosenResults[0].streams[0],
            providerName: chosenResults[0].providerName,
          };
          chosen = fallbackChoice;
          const initialLangs = getStreamAudioLanguages(fallbackChoice, chosenResults[0].infoTitle, originalLanguage);
          if (initialLangs.includes('Hindi')) {
            setActiveLanguage('Hindi');
          } else if (isHlsStream(fallbackChoice)) {
            setActiveLanguage('Hindi');
          } else {
            setActiveLanguage(initialLangs[0] || 'English');
          }
        }

        setSelectedStream(chosen);
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
    // If stream is already proxied through our edge gateway or backend proxy, or is direct VidRift / Milkyway CORS CDN, do not proxy
    if (
      stream.link.includes('proxy-stream') ||
      stream.link.includes('/api/proxy') ||
      stream.link.includes('milkyway.cymru') ||
      stream.link.includes('vidrift.')
    ) {
      return stream.link;
    }

    const vpsApiBase = (process.env.NEXT_PUBLIC_BACKEND_URL_TIER2 || 'https://vidy.snapflix.indevs.in').replace(/\/$/, '');

    // streamrip.fun and rousav.tech require proxying to bypass CORS and hotlink filters (Oracle VPS handles both cleanly)
    if (stream.link.includes('streamrip.fun') || stream.link.includes('rousav.tech')) {
      return `${vpsApiBase}/api/proxy/stream?v=2&url=${encodeURIComponent(stream.link)}`;
    }

    const hasHeaders = stream.headers && Object.keys(stream.headers).length > 0;

    // Streams with custom request headers (e.g. Referer or Origin like Movy/Phoenix) MUST be routed through
    // proxy because the browser cannot set custom Referer/Origin headers on XMLHttpRequest.
    // Streams without custom headers play directly in the browser to avoid server bottlenecks.
    if (hasHeaders) {
      const headersJson = JSON.stringify(stream.headers || {});
      return `${vpsApiBase}/api/proxy/stream?v=2&url=${encodeURIComponent(
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
    setHlsAudioTracks([]);

    if (!selectedStream || !videoRef.current) return;

    const streamUrl = getPlayableUrl(selectedStream);
    const isHls = isHlsStream(selectedStream);
    const isMkv = selectedStream.type === 'mkv' || selectedStream.link.includes('.mkv');

    const effectiveSeekTime =
      resumeTimeRef.current !== null
        ? resumeTimeRef.current
        : (initialTime > 0 ? initialTime : (savedResumeTimeRef.current > 0 ? savedResumeTimeRef.current : 0));
    const seekTo = effectiveSeekTime;
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
          lowLatencyMode: false,
          backBufferLength: 60,
          maxBufferLength: 60,
          maxMaxBufferLength: 180,
          maxBufferSize: 120 * 1024 * 1024,
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 5,
          capLevelToPlayerSize: true,
          startLevel: -1,
          autoStartLoad: true,
          startPosition: seekTo > 0 ? seekTo : -1,
          startFragPrefetch: true,
          progressive: true,
          testBandwidth: false,
          fragLoadingTimeOut: 25000,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 500,
          manifestLoadingTimeOut: 15000,
          levelLoadingTimeOut: 15000,
        });
        hlsRef.current = hls;
        if (activeSubtitleIdRef.current === 'off') {
          hls.subtitleDisplay = false;
          hls.subtitleTrack = -1;
        }

        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);

        const syncAudioTracksFromHls = (tracks: any[]) => {
          if (!tracks || tracks.length === 0) return;
          setHlsAudioTracks(tracks);
          const preferred = userSelectedLangRef.current || activeLanguage || 'Hindi';
          const aliases = LANG_CODE_ALIASES[preferred] || [preferred.toLowerCase()];
          const matchIdx = tracks.findIndex((t: any) => {
            const tLang = (t.lang || '').toLowerCase().trim();
            const tName = (t.name || '').toLowerCase().trim();
            const parsed = parseWordToLanguage(tName) || parseWordToLanguage(tLang);
            return parsed === preferred || aliases.some((a) => tLang === a || tName.includes(a) || tLang.includes(a));
          });
          if (matchIdx !== -1) {
            const track = tracks[matchIdx];
            const trackIdToSet = typeof track?.id === 'number' ? track.id : matchIdx;
            if (hls.audioTrack !== trackIdToSet) {
              hls.audioTrack = trackIdToSet;
            }
            setCurrentHlsAudioTrack(matchIdx);
            setActiveLanguage(preferred);
          } else if (tracks.length > 1) {
            const curIdx = hls.audioTrack >= 0 ? hls.audioTrack : 0;
            const currentTrack = tracks[curIdx];
            const detected = parseWordToLanguage(currentTrack?.name || '') || parseWordToLanguage(currentTrack?.lang || '');
            if (detected) {
              setActiveLanguage(detected);
            }
            setCurrentHlsAudioTrack(curIdx);
          }
        };

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (seekTo > 0 && videoRef.current && Math.abs(videoRef.current.currentTime - seekTo) > 2) {
            try {
              videoRef.current.currentTime = seekTo;
            } catch (e) {
              console.warn('[Player] Initial seek error:', e);
            }
          }
          executeAutoPlay(videoRef.current);

          if (data?.levels && data.levels.length > 0) {
            setHlsLevels(data.levels);
            setCurrentHlsLevel(hls.currentLevel);
          } else if (hls.levels && hls.levels.length > 0) {
            setHlsLevels(hls.levels);
            setCurrentHlsLevel(hls.currentLevel);
          }

          if (hls.audioTracks && hls.audioTracks.length > 0) {
            syncAudioTracksFromHls(hls.audioTracks);
          }

          if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
            setHlsSubtitles(hls.subtitleTracks);
          }
          if (activeSubtitleIdRef.current === 'off') {
            disableAllSubtitles(videoRef.current, hls);
          }
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
          const tracks = (data?.audioTracks && data.audioTracks.length > 0) ? data.audioTracks : (hls.audioTracks || []);
          syncAudioTracksFromHls(tracks);
        });

        hls.on(Hls.Events.AUDIO_TRACK_LOADED, (_event, data) => {
          if (hls.audioTracks && hls.audioTracks.length > 0) {
            setHlsAudioTracks(hls.audioTracks);
          }
        });

        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => {
          if (typeof data?.id === 'number') {
            const tracks = hls.audioTracks || [];
            const foundIdx = tracks.findIndex((t: any, idx: number) => t.id === data.id || idx === data.id);
            const track = foundIdx !== -1 ? tracks[foundIdx] : tracks[data.id];
            const idxToSave = foundIdx !== -1 ? foundIdx : data.id;
            setCurrentHlsAudioTrack(idxToSave);
            if (track) {
              const rawName = (track.name || track.lang || '').trim();
              const detected = parseWordToLanguage(track.name || '') || parseWordToLanguage(track.lang || '') || parseWordToLanguage(rawName);
              if (detected) {
                setActiveLanguage(detected);
              }
            }
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

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
          if (data?.subtitleTracks) {
            setHlsSubtitles(data.subtitleTracks);
            if (activeSubtitleIdRef.current === 'off') {
              disableAllSubtitles(videoRef.current, hls);
            }
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // If direct stream failed, attempt proxy fallback once via dedicated VPS proxy
                if (hls.url && !hls.url.includes('proxy-stream') && !hls.url.includes('/api/proxy')) {
                  const vpsApiBase = (process.env.NEXT_PUBLIC_BACKEND_URL_TIER2 || 'https://vidy.snapflix.indevs.in').replace(/\/$/, '');
                  const headersJson = JSON.stringify(selectedStream.headers || {});
                  const proxyUrl = `${vpsApiBase}/api/proxy/stream?v=2&url=${encodeURIComponent(
                    selectedStream.link
                  )}&headers=${encodeURIComponent(headersJson)}`;
                  console.warn('[Player] Direct stream failed, attempting VPS proxy fallback:', proxyUrl);
                  hls.loadSource(proxyUrl);
                  hls.startLoad();
                  return;
                }

                // If proxy or stream failed, auto-switch to next available server
                console.warn('[Player] Network error on stream. Triggering auto-failover to alternative server...');
                if (!handleAutoFailover()) {
                  setPlaybackError(
                    'This stream server is currently offline or returning Bad Gateway (502). Please select another server from the Servers menu below.'
                  );
                  hls.destroy();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                if (!handleAutoFailover()) {
                  setPlaybackError('Stream failed to load on this server. Please choose another server from the menu below.');
                  hls.destroy();
                }
                break;
            }
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = streamUrl;
        if (activeSubtitleIdRef.current === 'off') {
          disableAllSubtitles(videoRef.current);
        }
        if (seekTo > 0) {
          const handleLoadedMetadata = () => {
            if (videoRef.current) {
              try {
                videoRef.current.currentTime = seekTo;
              } catch (e) { }
            }
          };
          videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        }
        executeAutoPlay(videoRef.current);
      }
    } else {
      const videoEl = videoRef.current;
      videoEl.src = streamUrl;
      if (activeSubtitleIdRef.current === 'off') {
        disableAllSubtitles(videoEl);
      }
      if (seekTo > 0) {
        const handleLoadedMetadata = () => {
          if (videoRef.current) {
            try {
              videoRef.current.currentTime = seekTo;
            } catch (e) { }
          }
        };
        videoEl.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      }

      const handleNativeError = () => {
        console.warn('[Player] Native MP4 video error, triggering auto-failover');
        if (!handleAutoFailover()) {
          setPlaybackError('Stream failed to load on this server. Please choose another server or player.');
        }
      };

      videoEl.addEventListener('error', handleNativeError, { once: true });
      executeAutoPlay(videoEl);

      return () => {
        videoEl.removeEventListener('error', handleNativeError);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedStream, getPlayableUrl, initialTime]);

  // Late auto-resume sync if savedResumeTime resolves after video element metadata load
  useEffect(() => {
    savedResumeTimeRef.current = savedResumeTime;
    if (
      savedResumeTime > 5 &&
      videoRef.current &&
      !hasAutoResumedRef.current &&
      videoRef.current.currentTime < 3
    ) {
      hasAutoResumedRef.current = true;
      const vid = videoRef.current;
      if (vid.readyState >= 1) {
        try {
          vid.currentTime = savedResumeTime;
        } catch (e) { }
      } else {
        const onLoaded = () => {
          try {
            vid.currentTime = savedResumeTime;
          } catch (e) { }
        };
        vid.addEventListener('loadedmetadata', onLoaded, { once: true });
      }
    }
  }, [savedResumeTime]);

  // 4. Robust Watch History Progress Saver (Guests + Supabase)
  const saveWatchProgress = useCallback(
    (forceCompleted: boolean = false) => {
      const vid = videoRef.current;
      if (!vid || !tmdbId) return;

      const curTime = Math.floor(vid.currentTime || 0);
      const dur = Math.floor(vid.duration || 0);

      // Don't save if 0 or NaN
      if (isNaN(curTime) || curTime <= 0) return;

      const isCompleted = forceCompleted || (dur > 0 && curTime / dur >= 0.92);
      const now = new Date().toISOString();
      const mediaSeason = Number(season || (type === 'tv' ? 1 : 0));
      const mediaEpisode = Number(episode || (type === 'tv' ? 1 : 0));

      // 1. Save to LocalStorage (Instant for guests, offline, and Continue Watching carousel)
      try {
        const guestHistory = readGuestHistory();
        const existingIdx = guestHistory.findIndex(
          (item) =>
            Number(item.media_id) === Number(tmdbId) &&
            item.type === type &&
            (type !== 'tv' || (Number(item.season || 1) === mediaSeason && Number(item.episode || 1) === mediaEpisode))
        );

        const cleanBackdrop = backdropPath || backdropUrl || '';
        const cleanPoster = posterPath || '';

        if (existingIdx >= 0) {
          const item = { ...guestHistory[existingIdx] };
          item.last_position = curTime;
          if (dur > 0) item.duration = dur;
          item.completed = isCompleted;
          item.updated_at = now;
          if (!item.title && title) item.title = title;
          if (!item.backdrop_path && cleanBackdrop) item.backdrop_path = cleanBackdrop;
          if (!item.poster_path && cleanPoster) item.poster_path = cleanPoster;
          const updated = [item, ...guestHistory.filter((_, i) => i !== existingIdx)].slice(0, 30);
          writeGuestHistory(updated);
        } else {
          const newItem: any = {
            id: Date.now(),
            user_id: user?.id || 'guest',
            media_id: Number(tmdbId),
            type: type,
            season: mediaSeason,
            episode: mediaEpisode,
            duration: dur || 7200,
            last_position: curTime,
            completed: isCompleted,
            adult: false,
            backdrop_path: cleanBackdrop,
            poster_path: cleanPoster,
            release_date: year ? `${year}-01-01` : now,
            title: title || `Title ${tmdbId}`,
            vote_average: 8.0,
            updated_at: now,
          };
          const updated = [newItem, ...guestHistory].slice(0, 30);
          writeGuestHistory(updated);
        }

        queryClient.invalidateQueries({ queryKey: WATCH_HISTORY_QUERY_KEY });
      } catch (e) {
        console.warn('[Player] Local history save error:', e);
      }

      // 2. Sync to Supabase if signed in
      if (user) {
        syncHistory(
          {
            event: isCompleted ? 'ended' : 'timeupdate',
            currentTime: curTime,
            duration: dur,
            mediaId: Number(tmdbId),
            mediaType: type,
            season: mediaSeason,
            episode: mediaEpisode,
          },
          isCompleted
        ).catch((err) => {
          console.warn('[Player] Supabase history sync error:', err);
        });
      }

      lastSavedTimeRef.current = curTime;
      lastSaveTimestampRef.current = Date.now();
    },
    [tmdbId, type, season, episode, title, year, backdropPath, backdropUrl, posterPath, user]
  );

  // Watch History Lifecycle Listeners (tab switch, window close, unmount)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveWatchProgress();
      }
    };

    const handleBeforeUnload = () => {
      saveWatchProgress();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveWatchProgress();
    };
  }, [saveWatchProgress]);

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
    if (isPinchingRef.current) return;
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
      setShowServerQualityMenu(false);
      setShowAudioMenu(false);
      setShowMobileDrawer(false);
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
          setShowServerQualityMenu(false);
          setShowAudioMenu(false);
          setShowMobileDrawer(false);
          setShowNextEpPreview(false);
        }
        return next;
      });
    }, 260);
  };

  // Toggle Play / Pause with interruption protection
  const togglePlay = () => {
    if (!videoRef.current) return;
    setIsBuffering(false);
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

  // Toggle Fullscreen with auto-lock to Landscape on mobile devices
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    const doc = document as any;
    const isFs = Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
    if (!isFs) {
      const el = containerRef.current as any;
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
          (videoRef.current as any).webkitEnterFullscreen();
        }
      } catch (fsErr) {
        console.warn('[Player] Fullscreen request error:', fsErr);
      }

      // Automatically lock screen orientation to Landscape on mobile devices
      try {
        const orientation = (screen as any)?.orientation || (screen as any)?.mozOrientation || (screen as any)?.msOrientation;
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape').catch(() => { });
        }
      } catch (lockErr) {
        console.warn('[Player] Orientation lock error:', lockErr);
      }

      setIsFullscreen(true);
    } else {
      // Exit fullscreen & unlock orientation back to portrait
      try {
        const orientation = (screen as any)?.orientation || (screen as any)?.mozOrientation || (screen as any)?.msOrientation;
        if (orientation && typeof orientation.unlock === 'function') {
          orientation.unlock();
        }
      } catch (unlockErr) {
        console.warn('[Player] Orientation unlock error:', unlockErr);
      }

      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } catch (exitErr) {
        console.warn('[Player] Exit fullscreen error:', exitErr);
      }

      setIsFullscreen(false);
      setShowEpisodesTray(false);
    }
  };

  // Sync fullscreen state from browser/OS events (Escape key, mobile rotation, back gesture)
  useEffect(() => {
    const handleFsChange = () => {
      const fsActive = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(fsActive);
      if (!fsActive) {
        setShowEpisodesTray(false);
        // Automatically unlock screen orientation back to normal when exiting via back button/gesture
        try {
          const orientation = (screen as any)?.orientation || (screen as any)?.mozOrientation || (screen as any)?.msOrientation;
          if (orientation && typeof orientation.unlock === 'function') {
            orientation.unlock();
          }
        } catch { }
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

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
      } else if (e.key === 'z' || e.key === 'a') {
        e.preventDefault();
        cycleFitMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerControls, cycleFitMode]);

  const [showPauseHero, setShowPauseHero] = useState(false);
  const pauseHeroTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentEp = episodes?.find((e) => e.episode_number === episode);
  const epStill = currentEp?.still_path
    ? currentEp.still_path.startsWith('http')
      ? currentEp.still_path
      : `https://image.tmdb.org/t/p/w1280${currentEp.still_path}`
    : null;
  const activeBackdropUrl = backdropUrl || epStill || fetchedBackdrop;
  const activeOverview = overview || currentEp?.overview || fetchedOverview;

  useEffect(() => {
    // Only show Pause Hero in Fullscreen or Desktop (>= 768px). Never in mobile portrait!
    const isMobilePortrait = typeof window !== 'undefined' && !isFullscreen && window.innerWidth < 768;
    if (isMobilePortrait) {
      setShowPauseHero(false);
      return;
    }

    if (!isPlaying && hasStartedPlayback && !loadingStreams && !error && !playbackError && Boolean(activeBackdropUrl)) {
      if (pauseHeroTimerRef.current) clearTimeout(pauseHeroTimerRef.current);
      pauseHeroTimerRef.current = setTimeout(() => {
        setShowPauseHero(true);
      }, 1000);
    } else {
      if (pauseHeroTimerRef.current) clearTimeout(pauseHeroTimerRef.current);
      setShowPauseHero(false);
    }

    return () => {
      if (pauseHeroTimerRef.current) clearTimeout(pauseHeroTimerRef.current);
    };
  }, [isPlaying, hasStartedPlayback, loadingStreams, error, playbackError, activeBackdropUrl, isFullscreen]);

  return (
    <div
      ref={containerRef}
      onMouseMove={() => {
        if (!canHover()) return;
        triggerControls();
      }}
      onTouchStart={(e) => {
        if (e.touches && e.touches.length === 2) {
          isPinchingRef.current = true;
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          touchStartDistanceRef.current = dist;
          pinchDeltaRef.current = 0;
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
        } else if (e.touches && e.touches[0]) {
          isPinchingRef.current = false;
          touchStartDistanceRef.current = null;
          lastTouchXRef.current = e.touches[0].clientX;
        }
      }}
      onTouchMove={(e) => {
        if (e.touches && e.touches.length === 2 && touchStartDistanceRef.current !== null) {
          isPinchingRef.current = true;
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          pinchDeltaRef.current = dist - touchStartDistanceRef.current;
        }
      }}
      onTouchEnd={() => {
        if (isPinchingRef.current) {
          const delta = pinchDeltaRef.current;
          touchStartDistanceRef.current = null;
          pinchDeltaRef.current = 0;
          setTimeout(() => {
            isPinchingRef.current = false;
          }, 150);

          if (delta > 35) {
            // Pinch OUT -> Zoom to fill (Best Fit / Fullscreen cover)
            if (fitMode !== 'cover') {
              setFitMode('cover');
              setFitToast('Zoom to Fill (Best Fit)');
              if (fitToastTimeoutRef.current) clearTimeout(fitToastTimeoutRef.current);
              fitToastTimeoutRef.current = setTimeout(() => setFitToast(null), 1600);
              try {
                localStorage.setItem('snapflix_player_fit', 'cover');
              } catch { }
            }
          } else if (delta < -35) {
            // Pinch IN -> Original fit to screen (contain)
            if (fitMode !== 'contain') {
              setFitMode('contain');
              setFitToast('Original (Fit to Screen)');
              if (fitToastTimeoutRef.current) clearTimeout(fitToastTimeoutRef.current);
              fitToastTimeoutRef.current = setTimeout(() => setFitToast(null), 1600);
              try {
                localStorage.setItem('snapflix_player_fit', 'contain');
              } catch { }
            }
          }
        }
      }}
      onClick={handleContainerClick}
      className="relative w-full h-full bg-black select-none overflow-hidden flex items-center justify-center group touch-manipulation"
    >
      {/* 1. Underlying Video Element */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        crossOrigin="anonymous"
        onPlay={() => {
          setIsPlaying(true);
          setHasStartedPlayback(true);
          setIsBuffering(false);
          if (!isRemoteActionRef.current && party.isPartyActive) {
            party.broadcastPlay(videoRef.current?.currentTime || 0);
          }
          isRemoteActionRef.current = false;
        }}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
          setHasStartedPlayback(true);
        }}
        onPause={() => {
          setIsBuffering(false);
          setIsPlaying(false);
          saveWatchProgress();
          if (!isRemoteActionRef.current && party.isPartyActive) {
            party.broadcastPause(videoRef.current?.currentTime || 0);
          }
          isRemoteActionRef.current = false;
        }}
        onWaiting={() => {
          if (!videoRef.current?.paused) {
            setIsBuffering(true);
          }
        }}
        onCanPlay={() => {
          setIsBuffering(false);
        }}
        onSeeked={() => {
          setIsBuffering(false);
          if (!isRemoteActionRef.current && party.isPartyActive) {
            party.broadcastSeek(videoRef.current?.currentTime || 0);
          }
          isRemoteActionRef.current = false;
        }}
        onLoadedData={() => {
          setIsBuffering(false);
        }}
        onError={() => {
          setIsBuffering(false);
        }}
        onTimeUpdate={() => {
          if (videoRef.current) {
            const cur = videoRef.current.currentTime;
            setCurrentTime(cur);
            if (videoRef.current.buffered.length > 0) {
              setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
            }

            // Throttled history save: every 5 seconds of playback or 5 wall-clock seconds
            const nowSec = Math.floor(cur);
            const wallTime = Date.now();
            if (
              nowSec > 3 &&
              (Math.abs(nowSec - lastSavedTimeRef.current) >= 5 || wallTime - lastSaveTimestampRef.current >= 5000)
            ) {
              saveWatchProgress();
            }
          }
        }}
        onDurationChange={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onEnded={() => {
          saveWatchProgress(true);
          if (autoPlayNext && hasNextEpisode && onNextEpisode) {
            onNextEpisode();
          }
        }}
        className={cn(
          "w-full h-full pointer-events-none select-none transition-all duration-300",
          fitMode === 'cover' ? 'object-cover' : fitMode === 'fill' ? 'object-fill' : 'object-contain'
        )}
      >
        {activeSubtitleUri && (
          <track
            key={activeSubtitleUri}
            kind="subtitles"
            src={activeSubtitleUri}
            srcLang={activeSubtitleLang || 'en'}
            label={activeSubtitleLabel || 'Subtitle'}
            default
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el && el.track) {
                el.track.mode = 'showing';
              }
              if (videoRef.current?.textTracks) {
                for (let i = 0; i < videoRef.current.textTracks.length; i++) {
                  const t = videoRef.current.textTracks[i];
                  if (t !== el.track) {
                    t.mode = 'disabled';
                  }
                }
              }
            }}
          />
        )}
      </video>

      {/* 1.05 SnapFlix Discreet Watermark (Layered under all buttons and controls at z-10) */}
      <a
        href="https://snapflix.indevs.in"
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-10 flex items-center gap-1.5 opacity-40 hover:opacity-90 transition-opacity duration-300 pointer-events-auto select-none group"
        title="Powered by SnapFlix (snapflix.indevs.in)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 group-hover:scale-125 transition-transform drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
        <span className="text-[11px] sm:text-xs font-black tracking-widest text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] uppercase font-mono">
          <span className="text-red-500">SNAP</span>FLIX
        </span>
      </a>

      {/* 1.1 Netflix-Style Pause Hero Image Overlay (Fades in over 0.5s after 1s paused) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          // Never toggle play on background click! Dismiss pause hero and reveal player controls
          setShowPauseHero(false);
          triggerControls();
        }}
        className={cn(
          "absolute inset-0 z-15 flex flex-col justify-center px-4 sm:px-10 md:px-14 py-4 sm:py-8 select-none overflow-hidden transition-opacity duration-500 ease-out",
          showPauseHero ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop Image with Subtle Slow Cinematic Scale & Brightness */}
        {activeBackdropUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out scale-100"
            style={{
              backgroundImage: `url(${activeBackdropUrl})`,
              filter: "brightness(0.65) contrast(1.05)",
            }}
          />
        )}

        {/* Authentic Netflix Vignettes: Darker on bottom and left, subtle vignette all around */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/35 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent pointer-events-none" />

        {/* Bottom Left Content: Badge, Title, S/E, Synopsis, Action Buttons */}
        <div className="relative z-10 max-w-xl space-y-1 sm:space-y-2 md:space-y-3 pointer-events-auto">
          {/* Tag row */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-[#E50914] text-white">
              {type === "tv" ? "Series" : "Movie"}
            </span>
            {year && (
              <span className="text-[10px] sm:text-xs text-white/70 font-semibold">{year}</span>
            )}
            {resolvedRating && (
              <span className="border border-white/25 px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] text-white/80 font-bold">
                {resolvedRating}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-base sm:text-3xl md:text-5xl font-black text-white tracking-tight leading-tight line-clamp-1 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
            {title}
          </h2>

          {/* TV Episode Info */}
          {type === "tv" && (
            <p className="text-xs sm:text-sm md:text-base font-bold text-[#E50914] tracking-wide drop-shadow-md line-clamp-1">
              Season {season || 1}: Episode {episode || 1}
              {episodeTitle ? ` — "${episodeTitle}"` : ""}
            </p>
          )}

          {/* Synopsis (hidden on mobile portrait to avoid crowding ~200px player, visible on sm+ / tablet / desktop) */}
          {activeOverview && (
            <p className="text-xs sm:text-sm text-gray-300 font-normal leading-relaxed line-clamp-2 sm:line-clamp-3 drop-shadow-md max-w-lg hidden sm:block">
              {activeOverview}
            </p>
          )}

          {/* Action Buttons Row: Resume, Next Episode, Browse Episodes */}
          <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-1.5 sm:gap-2.5">
            {/* Resume Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full bg-white hover:bg-gray-200 text-black font-extrabold text-xs sm:text-sm transition-all transform active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.7)] cursor-pointer"
            >
              <IoPlay size={15} className="fill-black ml-0.5" />
              <span>
                {currentTime > 5
                  ? `Resume (${formatTime(currentTime)})`
                  : savedResumeTime > 5
                    ? `Resume (${formatTime(savedResumeTime)})`
                    : 'Play'}
              </span>
            </button>

            {/* Next Episode Button */}
            {(hasNextEpisode || onNextEpisode) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNextEpisode?.();
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm transition-all transform active:scale-95 shadow-md cursor-pointer"
              >
                <IoPlaySkipForward size={12} />
                <span>Next Episode</span>
              </button>
            )}

            {/* Episodes Tray Button - Only in Fullscreen mode! */}
            {(type === "tv" || (episodes && episodes.length > 0)) && isFullscreen && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEpisodesTray(true);
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm transition-all transform active:scale-95 shadow-md cursor-pointer"
              >
                <IoTvOutline size={14} />
                <span>Episodes</span>
              </button>
            )}

            <span className="text-[11px] text-gray-400 font-medium hidden sm:inline ml-1">
              Press Space to play
            </span>
          </div>
        </div>
      </div>

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
              onClick={() => {
                if (isMobileScreen()) {
                  setMobileDrawerTab('audio');
                  setShowMobileDrawer(true);
                } else {
                  setShowAudioMenu(true);
                }
              }}
            >
              Audio Languages
            </Button>
          </div>
        </div>
      )}

      {/* 5. Center Buffering Indicator */}
      {isBuffering && isPlaying && !loadingStreams && !playbackError && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
          <Spinner size="lg" color="danger" />
        </div>
      )}

      {/* 5.1 Center YouTube-Style Transport Controls (Rewind 10s | Large Play/Pause | Forward 10s) */}
      {!loadingStreams && !playbackError && !showPauseHero && (
        <div
          className={`absolute inset-0 pointer-events-none flex items-center justify-center z-20 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
        >
          <div className={`flex items-center gap-4 sm:gap-10 ${showControls || !isPlaying ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            {/* Rewind 10s */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                skip(-10);
              }}
              className="w-9 h-9 sm:w-14 sm:h-14 rounded-full bg-black/55 hover:bg-black/75 text-white/90 hover:text-white flex items-center justify-center transition active:scale-90 cursor-pointer backdrop-blur-md border border-white/10 shadow-2xl"
              title="Rewind 10s"
              aria-label="Rewind 10 seconds"
            >
              <MdReplay10 className="text-[20px] sm:text-[26px]" />
            </button>

            {/* Center Large Play / Pause */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center transition active:scale-90 cursor-pointer backdrop-blur-md border border-white/15 shadow-[0_0_35px_rgba(0,0,0,0.85)]"
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <IoPause className="text-[24px] sm:text-[34px]" />
              ) : (
                <IoPlay className="text-[26px] sm:text-[36px] ml-0.5 sm:ml-1" />
              )}
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                skip(10);
              }}
              className="w-9 h-9 sm:w-14 sm:h-14 rounded-full bg-black/55 hover:bg-black/75 text-white/90 hover:text-white flex items-center justify-center transition active:scale-90 cursor-pointer backdrop-blur-md border border-white/10 shadow-2xl"
              title="Forward 10s"
              aria-label="Forward 10 seconds"
            >
              <MdForward10 className="text-[20px] sm:text-[26px]" />
            </button>
          </div>
        </div>
      )}

      {/* 5.2 YouTube-Style Double-Tap Seek Ripple Overlay */}
      {doubleTapSide && (
        <div
          className={`absolute inset-y-0 w-1/2 pointer-events-none select-none z-25 overflow-hidden flex items-center justify-center transition-opacity duration-300 ${doubleTapSide === 'left'
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

      {/* 5.3 Screen Fit / Aspect Ratio HUD Toast */}
      {fitToast && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none flex items-center gap-2.5 bg-black/85 backdrop-blur-md px-4 py-2 sm:px-5 sm:py-2.5 rounded-full border border-white/20 text-white shadow-[0_8px_32px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-150">
          <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#E50914] animate-pulse" />
          <span className="text-xs sm:text-sm font-bold tracking-wide">{fitToast}</span>
        </div>
      )}

      {/* 5.4 Watch Party HUD Toast */}
      {party.partyToast && (
        <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center gap-2 bg-[#121216]/90 backdrop-blur-md px-4 py-1.5 sm:px-5 sm:py-2 rounded-full border border-white/20 text-white text-xs sm:text-sm font-semibold shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{party.partyToast}</span>
        </div>
      )}

      {/* 5.5 Watch Party Floating Reaction Bubbles */}
      {party.floatingReactions.map((r) => (
        <div
          key={r.id}
          style={{ left: `${r.x}%` }}
          className="pointer-events-none absolute bottom-24 z-40 text-4xl sm:text-5xl select-none party-float-emoji"
        >
          {r.emoji}
        </div>
      ))}

      {/* 6. Top Bar (Title & Episode on Left | Quality, CC Audio & Subtitles, Next Episode on Right) */}
      <div
        className={`absolute top-0 inset-x-0 px-3 sm:px-6 pt-2.5 sm:pt-4 pb-4 sm:pb-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between z-30 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
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
          <div
            className={`flex flex-col transition-opacity duration-300 ${showPauseHero ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
          >
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

        {/* Top-Right Actions: Servers + Quality + Audio & Subtitles + Next Episode */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          {/* Server & Quality Button with 2-Column Popover */}
          <div
            className="relative"
            ref={serverQualityMenuRef}
            onMouseEnter={handleServerQualityMouseEnter}
            onMouseLeave={handleServerQualityMouseLeave}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isMobileScreen()) {
                  setMobileDrawerTab('servers');
                  setShowMobileDrawer(true);
                  return;
                }
                if (serverQualityMenuTimeoutRef.current) clearTimeout(serverQualityMenuTimeoutRef.current);
                setShowAudioMenu(false);
                setShowNextEpPreview(false);
                setShowServerQualityMenu((prev) => !prev);
                triggerControls();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-xs font-semibold text-white/90 hover:text-white transition cursor-pointer backdrop-blur-md active:scale-95 shadow-md shrink-0 pointer-events-auto"
              title="Quality & Server"
            >
              <IoServerOutline size={15} className="text-white/80" />
              <span className="hidden sm:inline">Quality & Server</span>
            </button>

            {/* Netflix-style 2-Column Server & Quality Popover Window - Desktop (sm+) */}
            {showServerQualityMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:flex absolute top-full right-0 mt-2.5 w-[460px] md:w-[480px] bg-[#141414]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.95)] ring-1 ring-white/5 p-3.5 z-50 flex-row overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Left Column: Quality */}
                <div className="flex-1 flex flex-col min-w-0 pr-3">
                  <div className="px-2 py-1.5 text-[11px] font-bold text-gray-300 uppercase tracking-wider border-b border-white/10 flex items-center gap-1.5 mb-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] shrink-0" />
                    <span>Quality</span>
                  </div>

                  <div className="max-h-[min(300px,calc(100vh-160px))] overflow-y-auto space-y-0.5 p-0.5 pr-1">
                    {availableQualities.map((q) => {
                      const isSelected = selectedQuality === q.key;
                      return (
                        <button
                          key={q.key}
                          type="button"
                          onClick={() => handleSelectQuality(q.key)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition cursor-pointer ${isSelected
                              ? 'bg-red-600/15 text-white font-semibold border border-red-500/30'
                              : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-3.5 text-center shrink-0">
                              {isSelected && <IoCheckmark size={14} className="text-[#E50914] inline font-bold" />}
                            </span>
                            <span className="text-[11px] font-medium truncate">{q.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Vertical Partition / Divider */}
                <div className="w-[1px] bg-white/10 self-stretch my-1 shrink-0" />

                {/* Right Column: Server */}
                <div className="flex-1 flex flex-col min-w-0 pl-3">
                  <div className="px-2 py-1.5 text-[11px] font-bold text-gray-300 uppercase tracking-wider border-b border-white/10 flex items-center gap-1.5 mb-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] shrink-0" />
                    <span>Server</span>
                  </div>

                  <div className="max-h-[min(300px,calc(100vh-160px))] overflow-y-auto space-y-0.5 p-0.5 pr-1">
                    {availableServers.length > 0 ? (
                      availableServers.map((server) => {
                        const isActive =
                          activeServerProvider === server.provider ||
                          server.streams.some((s) => s.link === selectedStream?.link);
                        return (
                          <button
                            key={server.id}
                            type="button"
                            onClick={() => handleSelectServerOption(server)}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition cursor-pointer ${isActive
                                ? 'bg-red-600/15 text-white font-semibold border border-red-500/30'
                                : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3.5 text-center shrink-0">
                                {isActive && <IoCheckmark size={14} className="text-[#E50914] inline font-bold" />}
                              </span>
                              <span className="text-[11px] font-medium truncate">{server.name}</span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-2.5 py-2 text-[11px] text-gray-500 italic">No servers available</div>
                    )}
                  </div>
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
                if (isMobileScreen()) {
                  setMobileDrawerTab('audio');
                  setShowMobileDrawer(true);
                  return;
                }
                if (audioMenuTimeoutRef.current) clearTimeout(audioMenuTimeoutRef.current);
                setShowServerQualityMenu(false);
                setShowNextEpPreview(false);
                setShowAudioMenu((prev) => !prev);
                triggerControls();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-xs font-semibold text-white/90 hover:text-white transition cursor-pointer backdrop-blur-md active:scale-95 shadow-md shrink-0 pointer-events-auto"
              title="Audio & Subtitles"
            >
              <IoLanguageOutline size={15} className="text-white/80" />
              <span className="hidden sm:inline">Audio & Subs</span>
            </button>

            {/* Netflix-style 2-Column Audio & Subtitles Popover Window - Desktop (sm+) */}
            {showAudioMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:flex absolute top-full right-0 mt-2.5 w-[500px] md:w-[540px] bg-[#141414]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.95)] ring-1 ring-white/5 p-3.5 z-50 flex-row overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Left Column: Audio Languages */}
                <div className="flex-1 flex flex-col min-w-0 pr-3">
                  <div className="px-2 py-1.5 text-[11px] font-bold text-gray-300 uppercase tracking-wider border-b border-white/10 flex items-center gap-1.5 mb-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] shrink-0" />
                    <span>Audio</span>
                  </div>

                  <div className="max-h-[min(300px,calc(100vh-160px))] overflow-y-auto space-y-0.5 p-0.5 pr-1">
                    {availableLanguages.map((item) => {
                      const isActive = activeLanguage === item.name;
                      const countryCode = LANGUAGE_COUNTRY_CODES[item.name];
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectLanguage(item.name);
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
                            {countryCode ? (
                              <span className="w-5 h-3.5 rounded-[3px] overflow-hidden shrink-0 inline-flex items-center justify-center shadow-sm border border-white/10 bg-black/40">
                                <img
                                  src={`https://flagcdn.com/w40/${countryCode}.png`}
                                  srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
                                  width="20"
                                  height="14"
                                  alt={`${item.name} flag`}
                                  className="w-full h-full object-cover select-none"
                                  loading="lazy"
                                />
                              </span>
                            ) : (
                              <span className="w-5 h-3.5 shrink-0 inline-flex items-center justify-center text-xs select-none">
                                {LANGUAGE_FLAGS[item.name] || '🌐'}
                              </span>
                            )}
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

                {/* Vertical Partition / Divider */}
                <div className="w-[1px] bg-white/10 self-stretch my-1 shrink-0" />

                {/* Right Column: Subtitles / Captions */}
                <div className="flex-1 flex flex-col min-w-0 pl-3">
                  <div className="px-2 py-1.5 text-[11px] font-bold text-gray-300 uppercase tracking-wider border-b border-white/10 flex items-center justify-between mb-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] shrink-0" />
                      <span>Subtitles</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
                      title="Upload custom subtitle file (.srt, .vtt)"
                    >
                      <IoCloudUploadOutline size={12} />
                      <span>Upload</span>
                    </button>
                  </div>

                  <div className="max-h-[min(300px,calc(100vh-160px))] overflow-y-auto space-y-0.5 p-0.5 pr-1">
                    {/* Off Option */}
                    <button
                      type="button"
                      onClick={() => handleSelectSubtitle('off')}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition cursor-pointer ${activeSubtitleId === 'off'
                        ? 'bg-red-600/15 text-white font-semibold border border-red-500/30'
                        : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3.5 text-center shrink-0">
                          {activeSubtitleId === 'off' && <IoCheckmark size={14} className="text-[#E50914] inline font-bold" />}
                        </span>
                        <span className="text-[11px] font-medium">Off</span>
                      </div>
                    </button>

                    {/* Subtitle list */}
                    {availableSubtitles.map((sub) => {
                      const isActive = activeSubtitleId === sub.id;
                      const { countryCode, langCode } = getSubtitleMeta(sub);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSelectSubtitle(sub.id)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition cursor-pointer ${isActive
                            ? 'bg-red-600/15 text-white font-semibold border border-red-500/30'
                            : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-3.5 text-center shrink-0">
                              {isActive && <IoCheckmark size={14} className="text-[#E50914] inline font-bold" />}
                            </span>
                            {countryCode && (
                              <span className="w-5 h-3.5 rounded-[3px] overflow-hidden shrink-0 inline-flex items-center justify-center shadow-sm border border-white/10 bg-black/40">
                                <img
                                  src={`https://flagcdn.com/w40/${countryCode}.png`}
                                  srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
                                  width="20"
                                  height="14"
                                  alt="sub flag"
                                  className="w-full h-full object-cover select-none"
                                  loading="lazy"
                                />
                              </span>
                            )}
                            <span className="text-[11px] font-medium truncate">{sub.title}</span>
                          </div>
                          {langCode && (
                            <span className="text-[9px] text-gray-400 uppercase ml-1 shrink-0 font-mono">
                              {langCode}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {availableSubtitles.length === 0 && (
                      <div className="text-[11px] text-gray-500 italic px-2 py-4 text-center">
                        No subtitles provided by server
                      </div>
                    )}
                  </div>
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
                <span className="hidden sm:inline">Next Episode</span>
              </button>

              {/* Next Episode Hover Preview Popover - Desktop (sm+) */}
              {showNextEpPreview && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNextEpPreview(false);
                    onNextEpisode?.();
                  }}
                  className="hidden sm:flex absolute top-full right-0 mt-2.5 w-80 sm:w-96 bg-[#141416]/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.9)] hover:border-white/25 hover:shadow-[0_0_35px_rgba(255,255,255,0.08)] p-3 z-50 gap-3.5 cursor-pointer text-white animate-in fade-in zoom-in-95 duration-150 transition-all group"
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

          {/* Watch Party Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPartyModal(true);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer backdrop-blur-md active:scale-95 shadow-md shrink-0 pointer-events-auto",
              party.isPartyActive
                ? "bg-red-600/25 border-red-500/50 text-white shadow-red-900/30"
                : "bg-black/40 hover:bg-black/60 border-white/15 text-white/90 hover:text-white"
            )}
            title={party.isPartyActive ? `Watch Party (${party.partyRoomId})` : "Start Watch Party"}
          >
            <div className="relative flex items-center justify-center">
              <IoPeopleOutline size={15} className={party.isPartyActive ? "text-[#E50914]" : "text-white/80"} />
              {party.isPartyActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-black" />
              )}
            </div>
            {party.isPartyActive && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                {Math.max(party.partyMembers.length, 1)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 7. Bottom Control Bar (Sleek Scrubber + Timestamp & Fullscreen) */}
      <div
        className={`absolute bottom-0 inset-x-0 px-3 sm:px-6 pt-6 sm:pt-8 pb-1.5 sm:pb-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-0.5 sm:gap-1.5 z-30 transition-opacity duration-300 ${(showControls || !isPlaying) && !showPauseHero ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
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

          {/* Center: Episodes ^ button (TV & Anime) - Positioned dead-center of player bar - ONLY in Fullscreen */}
          {(type === 'tv' || (episodes && episodes.length > 0)) && isFullscreen && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEpisodesTray(!showEpisodesTray);
                }}
                className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-[14px] font-bold text-white hover:text-white transition cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md active:scale-95 shadow-md"
              >
                <span>Episodes</span>
                <IoChevronUp
                  size={15}
                  className={`transition-transform duration-200 ${showEpisodesTray ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          )}

          {/* Right: Screen Fit & Fullscreen */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Screen Fit / Aspect Ratio Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cycleFitMode();
              }}
              className={cn(
                "transition active:scale-95 cursor-pointer p-2 rounded-full hover:bg-white/10 flex items-center justify-center relative",
                fitMode !== 'contain' ? "text-[#E50914]" : "text-white hover:text-white/80"
              )}
              title={`Screen Fit: ${fitMode === 'cover' ? 'Zoom to Fill (Best Fit)' : fitMode === 'fill' ? 'Stretch to Fit' : 'Original (Fit to Screen)'}`}
              aria-label="Aspect Ratio / Screen Fit"
            >
              {fitMode === 'cover' ? (
                <MdFitScreen size={22} />
              ) : (
                <MdAspectRatio size={22} />
              )}
            </button>

            {/* Fullscreen */}
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

      {/* 8. Episodes Selection Tray / Modal (Bingr Layout + Netflix Themed) - ONLY in Fullscreen! */}
      {isFullscreen && showEpisodesTray && episodes && episodes.length > 0 && (() => {
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



      {/* Hidden file input for custom subtitle upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt"
        onChange={handleUploadSubtitle}
        className="hidden"
      />

      {/* 9. Unified Mobile Responsive Bottom Sheet for Servers, Quality, Audio & Subtitles (Portaled to Bottom 0) */}
      {showMobileDrawer &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={mobileAudioRef}
            onClick={(e) => e.stopPropagation()}
            className="sm:hidden fixed inset-0 z-[999999] flex flex-col justify-end pointer-events-auto select-none"
          >
            {/* Dark Backdrop (Tap to Dismiss) */}
            <div
              onClick={() => setShowMobileDrawer(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
            />

            {/* Bottom Sheet Drawer (Slides up from bottom 0) */}
            <div className="relative z-10 w-full h-[360px] sm:h-[400px] max-h-[75vh] bg-[#121212]/98 backdrop-blur-2xl border-t border-white/15 rounded-t-3xl shadow-[0_-12px_45px_rgba(0,0,0,0.95)] p-4 pb-6 flex flex-col animate-in slide-in-from-bottom duration-300 ease-out text-white">
              {/* Top Drag Handle */}
              <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mb-3 shrink-0" />

              {/* Header Row with Tabs: Server | Quality | Audio | Subtitles */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-1.5 p-1 bg-white/10 rounded-xl overflow-x-auto scrollbar-none max-w-[calc(100%-40px)]">
                  <button
                    type="button"
                    onClick={() => setMobileDrawerTab('quality')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap",
                      mobileDrawerTab === 'quality'
                        ? "bg-[#E50914] text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    Quality
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerTab('servers')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap",
                      mobileDrawerTab === 'servers'
                        ? "bg-[#E50914] text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    Server
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerTab('audio')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap",
                      mobileDrawerTab === 'audio'
                        ? "bg-[#E50914] text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    Audio ({activeLanguage || 'Default'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerTab('subtitles')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap",
                      mobileDrawerTab === 'subtitles'
                        ? "bg-[#E50914] text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    Subs ({activeSubtitleId === 'off' ? 'Off' : 'On'})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {mobileDrawerTab === 'subtitles' && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-zinc-300 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 cursor-pointer"
                      title="Upload Subtitle"
                    >
                      <IoCloudUploadOutline size={14} />
                      <span>Upload</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowMobileDrawer(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
                    aria-label="Close"
                  >
                    <IoClose size={18} />
                  </button>
                </div>
              </div>

              {/* Tab: Quality */}
              {mobileDrawerTab === 'quality' && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
                  {availableQualities.map((q) => {
                    const isSelected = selectedQuality === q.key;
                    return (
                      <button
                        key={`mobile-q-${q.key}`}
                        type="button"
                        onClick={() => {
                          handleSelectQuality(q.key);
                          setShowMobileDrawer(false);
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${isSelected
                            ? 'bg-red-600/20 text-white font-bold border border-red-500/40 shadow-sm'
                            : 'text-gray-300 hover:bg-white/[0.08] hover:text-white bg-white/[0.03]'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-4 text-center shrink-0">
                            {isSelected && <IoCheckmark size={15} className="text-[#E50914] font-black inline" />}
                          </span>
                          <span className="text-xs font-medium truncate">{q.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tab: Server */}
              {mobileDrawerTab === 'servers' && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
                  {availableServers.length > 0 ? (
                    availableServers.map((server) => {
                      const isActive =
                        activeServerProvider === server.provider ||
                        server.streams.some((s) => s.link === selectedStream?.link);
                      return (
                        <button
                          key={`mobile-server-${server.id}`}
                          type="button"
                          onClick={() => {
                            handleSelectServerOption(server);
                            setShowMobileDrawer(false);
                          }}
                          className={`w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${isActive
                              ? 'bg-red-600/20 text-white font-bold border border-red-500/40 shadow-sm'
                              : 'text-gray-300 hover:bg-white/[0.08] hover:text-white bg-white/[0.03]'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-4 text-center shrink-0">
                              {isActive && <IoCheckmark size={15} className="text-[#E50914] font-black inline" />}
                            </span>
                            <span className="text-xs font-medium truncate">{server.name}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-xs text-gray-400 italic">No servers available</div>
                  )}
                </div>
              )}

              {/* Tab: Audio Languages */}
              {mobileDrawerTab === 'audio' && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
                  {availableLanguages.map((item) => {
                    const isActive = activeLanguage === item.name;
                    const countryCode = LANGUAGE_COUNTRY_CODES[item.name];
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectLanguage(item.name);
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${isActive
                            ? 'bg-red-600/20 text-white font-bold border border-red-500/40 shadow-sm'
                            : 'text-gray-300 hover:bg-white/[0.08] hover:text-white bg-white/[0.03]'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-4 text-center shrink-0">
                            {isActive && <IoCheckmark size={15} className="text-[#E50914] font-black inline" />}
                          </span>
                          {countryCode ? (
                            <span className="w-5 h-3.5 rounded-[3px] overflow-hidden shrink-0 inline-flex items-center justify-center shadow-sm border border-white/10 bg-black/40">
                              <img
                                src={`https://flagcdn.com/w40/${countryCode}.png`}
                                srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
                                width="20"
                                height="14"
                                alt={`${item.name} flag`}
                                className="w-full h-full object-cover select-none"
                                loading="lazy"
                              />
                            </span>
                          ) : (
                            <span className="w-5 h-3.5 shrink-0 inline-flex items-center justify-center text-xs select-none">
                              {LANGUAGE_FLAGS[item.name] || '🌐'}
                            </span>
                          )}
                          <span className="text-xs font-medium truncate">{item.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tab: Subtitles */}
              {mobileDrawerTab === 'subtitles' && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
                  <button
                    type="button"
                    onClick={() => handleSelectSubtitle('off')}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${activeSubtitleId === 'off'
                        ? 'bg-red-600/20 text-white font-bold border border-red-500/40 shadow-sm'
                        : 'text-gray-300 hover:bg-white/[0.08] hover:text-white bg-white/[0.03]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-4 text-center shrink-0">
                        {activeSubtitleId === 'off' && <IoCheckmark size={15} className="text-[#E50914] font-black inline" />}
                      </span>
                      <span className="text-xs font-medium">Off</span>
                    </div>
                  </button>

                  {availableSubtitles.map((sub) => {
                    const isActive = activeSubtitleId === sub.id;
                    const { countryCode, langCode } = getSubtitleMeta(sub);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSelectSubtitle(sub.id)}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${isActive
                            ? 'bg-red-600/20 text-white font-bold border border-red-500/40 shadow-sm'
                            : 'text-gray-300 hover:bg-white/[0.08] hover:text-white bg-white/[0.03]'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-4 text-center shrink-0">
                            {isActive && <IoCheckmark size={15} className="text-[#E50914] font-black inline" />}
                          </span>
                          {countryCode && (
                            <span className="w-5 h-3.5 rounded-[3px] overflow-hidden shrink-0 inline-flex items-center justify-center shadow-sm border border-white/10 bg-black/40">
                              <img
                                src={`https://flagcdn.com/w40/${countryCode}.png`}
                                srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
                                width="20"
                                height="14"
                                alt="sub flag"
                                className="w-full h-full object-cover select-none"
                                loading="lazy"
                              />
                            </span>
                          )}
                          <span className="text-xs font-medium truncate">{sub.title}</span>
                        </div>
                        {langCode && (
                          <span className="text-[10px] text-gray-400 uppercase font-mono ml-2 shrink-0">
                            {langCode}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {availableSubtitles.length === 0 && (
                    <div className="text-xs text-gray-400 italic py-6 text-center">
                      No subtitles available for this stream
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.fullscreenElement || document.body
        )}

      {/* 9. Watch Party Modal */}
      <WatchPartyModal
        isOpen={showPartyModal}
        onClose={() => setShowPartyModal(false)}
        party={party}
      />

      {/* Global CSS for native video subtitle cue styling & party reactions */}
      <style jsx global>{`
        video::cue,
        ::cue {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-weight: 600 !important;
          font-size: ${subFontSize === 'small' ? '15px' : subFontSize === 'large' ? '22px' : '18px'} !important;
          color: ${subColor === 'yellow' ? '#fde047' : '#ffffff'} !important;
          background-color: ${subBg === 'transparent' ? 'transparent' : 'rgba(0, 0, 0, 0.75)'} !important;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.85) !important;
          line-height: 1.35 !important;
          letter-spacing: 0.02em !important;
        }

        /* Position subtitles comfortably below movie frame into black letterbox bar */
        video::-webkit-media-text-track-container {
          overflow: visible !important;
        }

        video::-webkit-media-text-track-display {
          transform: translateY(var(--snapflix-cue-offset, -7.5vh)) !important;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }



        @keyframes partyFloatUp {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          15% {
            transform: translateY(-30px) scale(1.4);
            opacity: 1;
          }
          80% {
            transform: translateY(-160px) scale(1.1);
            opacity: 0.9;
          }
          100% {
            transform: translateY(-220px) scale(0.8);
            opacity: 0;
          }
        }
        .party-float-emoji {
          animation: partyFloatUp 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}

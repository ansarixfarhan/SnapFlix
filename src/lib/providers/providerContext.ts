import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ProviderContext } from './types';

const URLS_ENDPOINT =
  'https://raw.githubusercontent.com/farhanansari888/SnapFlix-Providers/refs/heads/main/urls.json';

const LOCAL_URLS_PATHS = [
  path.resolve(process.cwd(), '../SnapFlix-Providers/urls.json'),
  path.resolve(process.cwd(), '../../SnapFlix-Providers/urls.json'),
  'E:/SnapFlix/SnapFlix-Providers/urls.json',
];

let urlCache: { data: Record<string, { name: string; url: string }> | null; expiresAt: number } = {
  data: null,
  expiresAt: 0,
};

export async function fetchProviderBaseUrls(): Promise<Record<string, { name: string; url: string }>> {
  if (urlCache.data && Date.now() < urlCache.expiresAt) {
    return urlCache.data;
  }

  // 1. Try local urls.json in development only
  if (process.env.NODE_ENV === 'development') {
    for (const localPath of LOCAL_URLS_PATHS) {
      try {
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, 'utf8');
          const data = JSON.parse(raw);
          urlCache = { data, expiresAt: Date.now() + 60 * 60 * 1000 };
          return data;
        }
      } catch {
        // ignore and continue
      }
    }
  }

  const DEFAULT_FALLBACK_URLS: Record<string, { name: string; url: string }> = {
    castle: { name: 'Castle', url: 'https://api.hlowb.com' },
    Moviesmod: { name: 'Moviesmod', url: 'https://moviesmod.uk.com' },
    Topmovies: { name: 'Topmovies', url: 'https://moviesleech.club' },
    UhdMovies: { name: 'UhdMovies', url: 'https://uhdmovies.us.org' },
    Vega: { name: 'vegamovies', url: 'https://1vegamovies.pics' },
    drive: { name: 'moviesDrive', url: 'https://new3.moviesdrive.beer/' },
    '4khdhub': { name: '4khdhub', url: 'https://4khdhub.org' },
    anikoto: { name: 'anikoto', url: 'https://anikoto.com' },
    movieBoxWeb: { name: 'movieBoxWeb', url: 'https://www.moviebox.ph' },
    autoEmbed: { name: 'autoEmbed', url: 'https://cinejoy.pk' },
  };

  // 2. Fallback to GitHub raw
  try {
    const res = await fetch(URLS_ENDPOINT, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    urlCache = { data, expiresAt: Date.now() + 60 * 60 * 1000 };
    return data;
  } catch (e) {
    if (urlCache.data) return urlCache.data;
    console.error('Failed to fetch provider URLs, using static fallback:', e);
    return DEFAULT_FALLBACK_URLS;
  }
}

export const getBaseUrl = async (providerValue: string): Promise<string> => {
  const urls = await fetchProviderBaseUrls();
  const lower = providerValue.toLowerCase();
  for (const [key, val] of Object.entries(urls)) {
    if (key.toLowerCase() === lower) return val.url;
  }
  return urls[providerValue]?.url || '';
};

export const commonHeaders: Record<string, string> = {
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

const memoryKv = new Map<string, any>();

export const createProviderContext = (providerValue: string): ProviderContext => {
  return {
    axios,
    cheerio,
    commonHeaders,
    getBaseUrl,
    kvStore: {
      get: async (key: string) => memoryKv.get(`${providerValue}_${key}`) ?? memoryKv.get(key),
      set: async (key: string, value: any) => {
        memoryKv.set(`${providerValue}_${key}`, value);
      },
    },
  };
};

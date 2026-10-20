import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import axios from 'axios';
import { createProviderContext } from './providerContext';
import type { Info, Post, Stream } from './types';

const BASE_REPO_URL =
  'https://raw.githubusercontent.com/farhanansari888/SnapFlix-Providers/refs/heads/main';

const LOCAL_DIST_PATHS = [
  path.resolve(process.cwd(), '../SnapFlix-Providers/dist'),
  path.resolve(process.cwd(), '../../SnapFlix-Providers/dist'),
  'E:/SnapFlix/SnapFlix-Providers/dist',
];

interface ModuleCacheEntry {
  code: string;
  loadedAt: number;
}

const moduleCodeCache = new Map<string, ModuleCacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchModuleCode(providerValue: string, fileName: string): Promise<string> {
  const cacheKey = `${providerValue}:${fileName}`;
  const cached = moduleCodeCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.code;
  }

  // 1. Check local SnapFlix-Providers dist first for instant zero-latency loading
  for (const localDist of LOCAL_DIST_PATHS) {
    try {
      const localFilePath = path.join(localDist, providerValue, `${fileName}.js`);
      if (fs.existsSync(localFilePath)) {
        const code = fs.readFileSync(localFilePath, 'utf8');
        moduleCodeCache.set(cacheKey, { code, loadedAt: Date.now() });
        return code;
      }
    } catch {
      // Continue to next path
    }
  }

  // 2. Fallback to GitHub raw
  const url = `${BASE_REPO_URL}/dist/${providerValue}/${fileName}.js?t=${Date.now()}`;
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.data) {
    throw new Error(`Failed to load module ${fileName}.js for ${providerValue}`);
  }

  const code = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  moduleCodeCache.set(cacheKey, { code, loadedAt: Date.now() });
  return code;
}

function executeModule(code: string): Record<string, any> {
  const exportsObj: Record<string, any> = {};
  const moduleObj = { exports: exportsObj };
  const sandbox = {
    exports: exportsObj,
    module: moduleObj,
    console,
    fetch: globalThis.fetch,
    URL: globalThis.URL,
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    Promise: globalThis.Promise,
    Object: globalThis.Object,
    Array: globalThis.Array,
    JSON: globalThis.JSON,
    String: globalThis.String,
    Number: globalThis.Number,
    Boolean: globalThis.Boolean,
    Math: globalThis.Math,
    Date: globalThis.Date,
    RegExp: globalThis.RegExp,
    URLSearchParams: globalThis.URLSearchParams,
    Buffer: globalThis.Buffer,
    parseInt: globalThis.parseInt,
    parseFloat: globalThis.parseFloat,
    isNaN: globalThis.isNaN,
    isFinite: globalThis.isFinite,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    providerGlobal: {},
    window: {
      location: { href: '' },
    },
    document: {
      getElementById: () => null,
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 15000 });
  return sandbox.exports;
}

export async function searchProvider({
  providerValue,
  query,
  page = 1,
  signal,
}: {
  providerValue: string;
  query: string;
  page?: number;
  signal?: AbortSignal;
}): Promise<Post[]> {
  try {
    const code = await fetchModuleCode(providerValue, 'posts');
    const mod = executeModule(code);
    const searchFn = mod.getSearchPosts || mod.getPosts;
    if (!searchFn) return [];

    const providerContext = createProviderContext(providerValue);
    const results = await searchFn({
      searchQuery: query,
      filter: '',
      page,
      signal,
      providerContext,
    });
    return Array.isArray(results) ? results : [];
  } catch (err) {
    console.warn(`[ProviderEngine] searchProvider (${providerValue}) failed:`, err);
    return [];
  }
}

export async function getProviderMeta({
  providerValue,
  link,
  signal,
}: {
  providerValue: string;
  link: string;
  signal?: AbortSignal;
}): Promise<Info | null> {
  try {
    const code = await fetchModuleCode(providerValue, 'meta');
    const mod = executeModule(code);
    const metaFn = mod.getMeta || mod.getInfo;
    if (!metaFn) return null;

    const providerContext = createProviderContext(providerValue);
    const result = await metaFn({
      link,
      signal,
      providerContext,
    });
    return result || null;
  } catch (err) {
    console.warn(`[ProviderEngine] getProviderMeta (${providerValue}) failed:`, err);
    return null;
  }
}

export async function getProviderStream({
  providerValue,
  link,
  type = 'movie',
  signal,
  isDownload = false,
}: {
  providerValue: string;
  link: string;
  type?: string;
  signal?: AbortSignal;
  isDownload?: boolean;
}): Promise<Stream[]> {
  try {
    const code = await fetchModuleCode(providerValue, 'stream');
    const mod = executeModule(code);
    const streamFn = mod.getStream;
    if (!streamFn) return [];

    const providerContext = createProviderContext(providerValue);
    const results = await streamFn({
      link,
      type,
      signal,
      providerContext,
      isDownload,
    });

    if (!Array.isArray(results)) return [];

    return results.map(s => ({
      ...s,
      providerValue,
    }));
  } catch (err) {
    console.warn(`[ProviderEngine] getProviderStream (${providerValue}) failed:`, err);
    return [];
  }
}

export async function getProviderEpisodes({
  providerValue,
  url,
  signal,
}: {
  providerValue: string;
  url: string;
  signal?: AbortSignal;
}): Promise<any[]> {
  try {
    const code = await fetchModuleCode(providerValue, 'episodes');
    const mod = executeModule(code);
    const episodesFn = mod.getEpisodes;
    if (!episodesFn) return [];

    const providerContext = createProviderContext(providerValue);
    const results = await episodesFn({
      url,
      signal,
      providerContext,
    });

    return Array.isArray(results) ? results : [];
  } catch (err) {
    console.warn(`[ProviderEngine] getProviderEpisodes (${providerValue}) failed:`, err);
    return [];
  }
}

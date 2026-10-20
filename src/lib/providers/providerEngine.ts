import { createProviderContext } from './providerContext';
import { loadProviderModule } from './registry';
import type { Info, Post, Stream } from './types';

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
    const mod = await loadProviderModule(providerValue, 'posts');
    if (!mod) return [];
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
    const mod = await loadProviderModule(providerValue, 'meta');
    if (!mod) return null;
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
    const mod = await loadProviderModule(providerValue, 'stream');
    if (!mod) return [];
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
    const mod = await loadProviderModule(providerValue, 'episodes');
    if (!mod) return [];
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

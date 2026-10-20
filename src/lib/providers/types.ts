export interface ProviderInfo {
  value: string;
  display_name: string;
  version: string;
  icon?: string;
  type?: string;
  disabled?: boolean;
}

export interface Post {
  title: string;
  link: string;
  image?: string;
  type?: string;
  year?: number | string;
}

export interface Stream {
  server: string;
  link: string;
  type: string;
  quality?: string;
  tag?: string;
  subtitles?: Array<{
    title: string;
    language: string;
    type?: string;
    uri: string;
  }>;
  headers?: Record<string, string>;
  providerValue?: string;
  providerName?: string;
}

export interface EpisodeLink {
  id?: string;
  title: string;
  link: string;
}

export interface Link {
  title?: string;
  directLinks?: Array<{
    title: string;
    link: string;
  }>;
  episodesLink?: string;
}

export interface Info {
  title: string;
  image?: string;
  synopsis?: string;
  type?: string;
  linkList: Link[];
}

export interface ProviderContext {
  axios: any;
  cheerio: any;
  commonHeaders: Record<string, string>;
  getBaseUrl: (providerValue: string) => Promise<string>;
  kvStore: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
}

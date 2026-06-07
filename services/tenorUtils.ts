export interface TenorMediaFormat {
  url: string;
}

export interface TenorResult {
  id: string;
  title?: string;
  content_description?: string;
  media_formats?: {
    gif?: TenorMediaFormat;
    mediumgif?: TenorMediaFormat;
    tinygif?: TenorMediaFormat;
  };
}

export const TENOR_CLIENT_KEY = 'gif2ascii';
export const TENOR_CONTENT_FILTER = 'high';
export const TENOR_MEDIA_FILTER = 'gif,mediumgif,tinygif';

export const getTenorPreviewUrl = (result: TenorResult): string => {
  const media = result.media_formats;
  return media?.tinygif?.url || media?.mediumgif?.url || media?.gif?.url || '';
};

export const getTenorDownloadUrl = (result: TenorResult): string => {
  const media = result.media_formats;
  return media?.mediumgif?.url || media?.gif?.url || media?.tinygif?.url || '';
};

export const dedupeTenorResults = (items: TenorResult[]): TenorResult[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id) || !getTenorPreviewUrl(item) || !getTenorDownloadUrl(item)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
};

interface BuildTenorUrlOptions {
  baseUrl: string;
  endpoint: string;
  apiKey: string;
  limit: string;
  origin: string;
  params?: Record<string, string>;
}

export const buildTenorUrl = ({
  baseUrl,
  endpoint,
  apiKey,
  limit,
  origin,
  params,
}: BuildTenorUrlOptions): URL => {
  const base = baseUrl.replace(/\/$/, '');
  const url = new URL(`${base}/v2/${endpoint}`, origin);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('limit', limit);
  url.searchParams.set('media_filter', TENOR_MEDIA_FILTER);
  url.searchParams.set('contentfilter', TENOR_CONTENT_FILTER);
  url.searchParams.set('client_key', TENOR_CLIENT_KEY);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url;
};

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TENOR_CLIENT_KEY,
  TENOR_CONTENT_FILTER,
  TENOR_MEDIA_FILTER,
  buildTenorUrl,
  dedupeTenorResults,
  getTenorDownloadUrl,
  getTenorPreviewUrl,
  type TenorResult,
} from '../services/tenorUtils';

const result = (id: string, media_formats: TenorResult['media_formats']): TenorResult => ({
  id,
  content_description: id,
  media_formats,
});

test('selects the cheapest usable preview format with mediumgif fallback', () => {
  assert.equal(
    getTenorPreviewUrl(result('tiny', {
      tinygif: { url: 'https://cdn.example/tiny.gif' },
      mediumgif: { url: 'https://cdn.example/medium.gif' },
      gif: { url: 'https://cdn.example/full.gif' },
    })),
    'https://cdn.example/tiny.gif'
  );

  assert.equal(
    getTenorPreviewUrl(result('medium-only', {
      mediumgif: { url: 'https://cdn.example/medium.gif' },
    })),
    'https://cdn.example/medium.gif'
  );
});

test('selects the higher-quality download format with tinygif fallback', () => {
  assert.equal(
    getTenorDownloadUrl(result('full', {
      tinygif: { url: 'https://cdn.example/tiny.gif' },
      gif: { url: 'https://cdn.example/full.gif' },
    })),
    'https://cdn.example/full.gif'
  );

  assert.equal(
    getTenorDownloadUrl(result('tiny-only', {
      tinygif: { url: 'https://cdn.example/tiny.gif' },
    })),
    'https://cdn.example/tiny.gif'
  );
});

test('dedupes by id and filters entries that cannot preview or download', () => {
  const deduped = dedupeTenorResults([
    result('valid', { mediumgif: { url: 'https://cdn.example/valid.gif' } }),
    result('valid', { mediumgif: { url: 'https://cdn.example/duplicate.gif' } }),
    result('', { mediumgif: { url: 'https://cdn.example/no-id.gif' } }),
    result('no-media', undefined),
    result('empty-media', {}),
  ]);

  assert.deepEqual(deduped.map((item) => item.id), ['valid']);
});

test('builds a Tenor URL with the documented key/client/media parameters', () => {
  const url = buildTenorUrl({
    baseUrl: '/tenor/',
    endpoint: 'search',
    apiKey: 'test-key',
    limit: '12',
    origin: 'https://example.com',
    params: { q: 'space cat', pos: 'next-token' },
  });

  assert.equal(url.href, 'https://example.com/tenor/v2/search?key=test-key&limit=12&media_filter=gif%2Cmediumgif%2Ctinygif&contentfilter=high&client_key=gif2ascii&q=space+cat&pos=next-token');
  assert.equal(url.searchParams.get('key'), 'test-key');
  assert.equal(url.searchParams.get('client_key'), TENOR_CLIENT_KEY);
  assert.equal(url.searchParams.get('media_filter'), TENOR_MEDIA_FILTER);
  assert.equal(url.searchParams.get('contentfilter'), TENOR_CONTENT_FILTER);
});

import React, { useEffect, useRef, useState } from 'react';

interface TenorSearchProps {
  onGifSelect: (file: File) => void;
  className?: string;
  gridClassName?: string;
  compact?: boolean;
}

interface TenorMediaFormat {
  url: string;
}

interface TenorResult {
  id: string;
  title?: string;
  content_description?: string;
  media_formats?: {
    gif?: TenorMediaFormat;
    mediumgif?: TenorMediaFormat;
    tinygif?: TenorMediaFormat;
  };
}

const TenorSearch: React.FC<TenorSearchProps> = ({
 onGifSelect,
 className,
 gridClassName,
 compact
}) => {
  const SEARCH_LIMIT = compact ? '12' : '18';
  const REQUEST_TIMEOUT_MS = 12000;
  const DEBOUNCE_MS = 350;
  const tenorBaseUrl = import.meta.env.DEV
    ? '/tenor'
    : (import.meta.env.VITE_TENOR_BASE_URL || 'https://tenor.googleapis.com');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TenorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [nextPos, setNextPos] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tenorApiKey = import.meta.env.VITE_TENOR_API_KEY || '';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const buildTenorUrl = (endpoint: string, params?: Record<string, string>) => {
    const base = tenorBaseUrl.replace(/\/$/, '');
    const url = new URL(`${base}/v2/${endpoint}`, window.location.origin);
    url.searchParams.set('key', tenorApiKey);
    url.searchParams.set('limit', SEARCH_LIMIT);
    url.searchParams.set('media_filter', 'gif,mediumgif,tinygif');
    url.searchParams.set('contentfilter', 'high');
    url.searchParams.set('client_key', 'gif2ascii');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url;
  };

  const fetchTenor = async (url: URL, markSearched: boolean, append = false) => {
    if (!tenorApiKey) {
      setError('Add VITE_TENOR_API_KEY to .env to enable Tenor search.');
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    if (markSearched) {
      setHasSearched(true);
    }

    try {
      const resp = await fetch(url.toString(), { signal: controller.signal });
      if (!resp.ok) {
        if (resp.status === 404 && tenorBaseUrl.startsWith('/')) {
          throw new Error('TENOR_PROXY_MISSING');
        }
        throw new Error(`Tenor API error (${resp.status})`);
      }
      const data = await resp.json();
      const newResults = Array.isArray(data.results) ? data.results : [];
      if (isMountedRef.current && requestId === requestIdRef.current) {
        if (append) {
          setResults((prev) => [...prev, ...newResults]);
        } else {
          setResults(newResults);
        }
        setNextPos(data.next || null);
      }
    } catch (err: any) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      if (err?.name === 'AbortError') {
        setError('Tenor request timed out. Check your API key or network.');
      } else if (err?.message === 'TENOR_PROXY_MISSING') {
        setError('Tenor proxy is not running. Restart `npm run dev` and open the correct port.');
      } else {
        console.error('Tenor search failed', err);
        setError('Could not load Tenor results. Please try again.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const fetchFeatured = async (pos?: string) => {
    const params = pos ? { pos } : undefined;
    const url = buildTenorUrl('featured', params);
    await fetchTenor(url, false, !!pos);
  };

  const fetchSearch = async (term: string, markSearched = true, pos?: string) => {
    const params: Record<string, string> = { q: term };
    if (pos) params.pos = pos;
    const url = buildTenorUrl('search', params);
    await fetchTenor(url, markSearched, !!pos);
  };

  const loadMore = () => {
    if (!nextPos || loadingMore || loading) return;
    const trimmed = query.trim();
    if (trimmed) {
      fetchSearch(trimmed, false, nextPos);
    } else {
      fetchFeatured(nextPos);
    }
  };

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextPos, loadingMore, loading, query]);

  useEffect(() => {
    if (!tenorApiKey) return;
    if (!query.trim()) {
      setHasSearched(false);
      fetchFeatured();
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      fetchSearch(query.trim());
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query, tenorApiKey]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();

    if (!trimmed) {
      setError('Enter a search term to find GIFs.');
      setResults([]);
      setHasSearched(true);
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    await fetchSearch(trimmed, true);
  };

  const handleSelect = async (result: TenorResult) => {
    const media = result.media_formats;
    const gifUrl = media?.mediumgif?.url || media?.gif?.url || media?.tinygif?.url;

    if (!gifUrl) {
      setError('No downloadable GIF found for this result.');
      return;
    }

    setSelectingId(result.id);
    setError(null);

    try {
      const resp = await fetch(gifUrl);
      if (!resp.ok) {
        throw new Error(`GIF fetch error (${resp.status})`);
      }
      const blob = await resp.blob();
      const file = new File([blob], `tenor-${result.id}.gif`, {
        type: blob.type || 'image/gif'
      });
      onGifSelect(file);
    } catch (err) {
      console.error('Tenor GIF fetch failed', err);
      if (isMountedRef.current) {
        setError('Failed to download the GIF. Please try another.');
      }
    } finally {
      if (isMountedRef.current) {
        setSelectingId(null);
      }
    }
  };

  return (
    <div className={className} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="tenor__header">
        <span className="tenor__title">Search Tenor</span>
        <span className="tenor__badge">Powered by Tenor</span>
      </div>

      {!tenorApiKey && (
        <div className="tenor__warning">
          [CONFIG] Add VITE_TENOR_API_KEY to .env to enable search.
        </div>
      )}

      <form onSubmit={handleSearch} style={{ flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search for a GIF..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError(null);
          }}
          disabled={!tenorApiKey}
          className="tenor__search-input"
          style={!tenorApiKey ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        />
      </form>

      {error && (
        <p className="upload-zone__error" style={{ marginBottom: 'var(--space-sm)' }}>
          [ERROR] {error}
        </p>
      )}

      {results.length > 0 && (
        <div
          ref={scrollContainerRef}
          className="scrollbar-hide"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '2px' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {results.map((result) => {
              const previewUrl = result.media_formats?.tinygif?.url || result.media_formats?.gif?.url;
              const altText = result.content_description || result.title || 'Tenor GIF';
              if (!previewUrl) return null;
              return (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleSelect(result)}
                  disabled={selectingId === result.id}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    overflow: 'hidden',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'border-color 150ms',
                    opacity: selectingId === result.id ? 0.5 : 1,
                  }}
                  title={altText}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <img
                    src={previewUrl}
                    alt={altText}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                  {selectingId === result.id && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span className="player__loading-text" style={{ fontSize: 'var(--label)' }}>[LOADING...]</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {nextPos && (
            <div ref={loadMoreRef} style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-md) 0' }}>
              {loadingMore && <span className="player__loading-text" style={{ fontSize: 'var(--label)' }}>[LOADING...]</span>}
            </div>
          )}
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && !error && (
        <p className="caption" style={{ marginTop: 'var(--space-md)' }}>No results found. Try another search.</p>
      )}
    </div>
  );
};

export default TenorSearch;

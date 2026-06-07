import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  buildTenorUrl,
  dedupeTenorResults,
  getTenorDownloadUrl,
  getTenorPreviewUrl,
  type TenorResult,
} from '../services/tenorUtils';

interface TenorSearchProps {
  onGifSelect: (file: File) => void;
  className?: string;
  gridClassName?: string;
  compact?: boolean;
}

const TenorSearch: React.FC<TenorSearchProps> = ({
 onGifSelect,
 className,
 gridClassName,
 compact
}) => {
  const SEARCH_LIMIT = compact ? '24' : '18';
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
  const resultsRef = useRef<TenorResult[]>([]);
  const tenorApiKey = import.meta.env.VITE_TENOR_API_KEY || '';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const buildTenorRequestUrl = (endpoint: string, params?: Record<string, string>) => {
    return buildTenorUrl({
      baseUrl: tenorBaseUrl,
      endpoint,
      apiKey: tenorApiKey,
      limit: SEARCH_LIMIT,
      origin: window.location.origin,
      params,
    });
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
      resultsRef.current = [];
      setResults([]);
      setNextPos(null);
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
      const newResults = dedupeTenorResults(Array.isArray(data.results) ? data.results : []);
      if (isMountedRef.current && requestId === requestIdRef.current) {
        let nextResults = newResults;
        let uniqueAppendCount = newResults.length;
        if (append) {
          const seen = new Set(resultsRef.current.map((item) => item.id));
          const uniqueResults = newResults.filter((item) => !seen.has(item.id));
          uniqueAppendCount = uniqueResults.length;
          nextResults = uniqueResults.length > 0 ? [...resultsRef.current, ...uniqueResults] : resultsRef.current;
        }
        resultsRef.current = nextResults;
        setResults(nextResults);
        setNextPos(append && uniqueAppendCount === 0 ? null : (data.next || null));
      }
    } catch (err: any) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      if (err?.name === 'AbortError') {
        setError('Tenor request timed out. Check your API key or network.');
      } else if (err?.message === 'TENOR_PROXY_MISSING') {
        setError('Tenor proxy is not running. Restart `npm run dev` and open the correct port.');
      } else {
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
    const url = buildTenorRequestUrl('featured', params);
    await fetchTenor(url, false, !!pos);
  };

  const fetchSearch = async (term: string, markSearched = true, pos?: string) => {
    const params: Record<string, string> = { q: term };
    if (pos) params.pos = pos;
    const url = buildTenorRequestUrl('search', params);
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

  useEffect(() => {
    if (!query.trim()) {
      setHasSearched(false);
      setError(null);
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (!tenorApiKey) {
        resultsRef.current = [];
        setResults([]);
        setNextPos(null);
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      fetchFeatured();
      return;
    }

    if (!tenorApiKey) {
      setHasSearched(true);
      setError('Add VITE_TENOR_API_KEY to .env to enable Tenor search.');
      resultsRef.current = [];
      setResults([]);
      setNextPos(null);
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
      setError(null);
      resultsRef.current = [];
      setResults([]);
      setHasSearched(false);
      setNextPos(null);
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    await fetchSearch(trimmed, true);
  };

  const handleSelect = async (result: TenorResult) => {
    const gifUrl = getTenorDownloadUrl(result);

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
    <div className={['tenor', className].filter(Boolean).join(' ')}>
      <div className="tenor__header">
        <span className="tenor__title">Search Tenor</span>
        <span className="tenor__badge">Powered by Tenor</span>
      </div>

      {!tenorApiKey && query.trim() && (
        <div className="tenor__warning">
          [CONFIG] Add VITE_TENOR_API_KEY to .env to enable search.
        </div>
      )}

      <form onSubmit={handleSearch} className="tenor__form">
        <div className="tenor__search-shell">
          <Search size={18} strokeWidth={1.6} aria-hidden="true" />
        <input
          type="text"
          placeholder="Search Tenor"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError(null);
          }}
          className="tenor__search-input"
          aria-label="Search Tenor GIFs"
        />
        </div>
      </form>

      {error && (
        <p className="upload-zone__error tenor__error">
          [ERROR] {error}
        </p>
      )}

      {loading && (
        <p className="player__loading-text tenor__status" role="status">
          [LOADING...]
        </p>
      )}

      {results.length > 0 && (
        <div
          ref={scrollContainerRef}
          className="tenor__results scrollbar-hide"
          aria-busy={loadingMore}
          aria-label="Tenor GIF results"
        >
          <div className={['tenor__grid', gridClassName].filter(Boolean).join(' ')}>
            {results.map((result) => {
              const previewUrl = getTenorPreviewUrl(result);
              const altText = result.content_description || result.title || 'Tenor GIF';
              if (!previewUrl) return null;
              return (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleSelect(result)}
                  disabled={selectingId === result.id}
                  className={`tenor__result ${selectingId === result.id ? 'tenor__result--selecting' : ''}`}
                  title={altText}
                >
                  <img
                    src={previewUrl}
                    alt={altText}
                    className="tenor__result-image"
                    loading="lazy"
                  />
                  {selectingId === result.id && (
                    <div className="tenor__result-overlay">
                      <span className="player__loading-text tenor__result-status">[LOADING...]</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {nextPos && (
            <div className="tenor__load-more">
              <button
                type="button"
                onClick={loadMore}
                className="btn btn--secondary tenor__load-more-button"
                disabled={loadingMore || loading}
              >
                {loadingMore ? '[LOADING...]' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && !error && (
        <p className="caption tenor__empty">No results found. Try another search.</p>
      )}
    </div>
  );
};

export default TenorSearch;

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cursor-like, unbounded scrolling on top of the existing paginated API.
 * The server still sends manageable chunks (to avoid giant SQL responses).
 * Switching filters cancels stale requests, preventing posts from old queries
 * appearing in the new list.
 */
export function useInfiniteRecords({ identity, request, enabled = true }) {
  const requester = useRef(request);
  requester.current = request;
  const cursor = useRef({ generation: 0, busy: false, page: 0, hasMore: true, controller: null });
  const [state, setState] = useState({
    records: [], total: 0, loading: true, hasMore: false, error: null,
  });

  const loadPage = useCallback(async (page, generation) => {
    const current = cursor.current;
    if (current.busy || (page > 1 && !current.hasMore)) return;
    const controller = new AbortController();
    current.controller = controller;
    current.busy = true;
    setState(previous => ({ ...previous, loading: true, error: null }));
    try {
      const result = await requester.current(page, controller.signal);
      if (generation !== cursor.current.generation || controller.signal.aborted) return;

      const incoming = Array.isArray(result?.data) ? result.data : [];
      const pagination = result?.pagination;
      const hasMore = pagination
        ? page < Number(pagination.totalPages || 1)
        : incoming.length >= 20;
      current.page = page;
      current.hasMore = hasMore && incoming.length > 0;
      setState(previous => {
        if (page === 1) {
          return {
            records: incoming, total: Number(pagination?.total ?? incoming.length),
            loading: false, hasMore: current.hasMore, error: null,
          };
        }
        const seen = new Set(previous.records.map(row => String(row.id)));
        const fresh = incoming.filter(row => !seen.has(String(row.id)));
        return {
          records: [...previous.records, ...fresh],
          total: Number(pagination?.total ?? previous.total),
          loading: false, hasMore: current.hasMore, error: null,
        };
      });
    } catch (error) {
      if (generation !== cursor.current.generation || controller.signal.aborted || error.name === 'AbortError') return;
      setState(previous => ({ ...previous, loading: false, error, hasMore: current.hasMore }));
    } finally {
      if (generation === cursor.current.generation) cursor.current.busy = false;
    }
  }, []);

  useEffect(() => {
    const current = cursor.current;
    current.controller?.abort();
    current.generation += 1;
    current.busy = false;
    current.page = 0;
    current.hasMore = Boolean(enabled);
    const generation = current.generation;
    setState({ records: [], total: 0, loading: Boolean(enabled), hasMore: Boolean(enabled), error: null });
    if (enabled) void loadPage(1, generation);
    return () => {
      current.controller?.abort();
      current.generation += 1;
    };
  }, [identity, enabled, loadPage]);

  const loadMore = useCallback(() => {
    const current = cursor.current;
    if (current.busy || !current.hasMore || !enabled) return;
    void loadPage(current.page + 1, current.generation);
  }, [enabled, loadPage]);

  const retry = useCallback(() => {
    const current = cursor.current;
    if (current.busy || !enabled) return;
    void loadPage(current.page + 1, current.generation);
  }, [enabled, loadPage]);

  return { ...state, loadMore, retry };
}

/** Auto-fetch near the bottom; no Next button or artificial end-of-page. */
export function InfiniteScrollEnd({ records, hasMore, loading, loadMore, error, retry, language = 'en', showComplete = true }) {
  const endRef = useRef(null);
  const uk = language === 'uk';
  useEffect(() => {
    const element = endRef.current;
    if (!element || !hasMore || loading || error || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) loadMore();
    }, { rootMargin: '550px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [records?.length, hasMore, loading, loadMore, error]);

  if (error && records.length > 0) {
    return <div className="infiniteEnd infiniteError" role="alert">
      <span>{uk ? 'Не вдалося завантажити наступні дописи.' : 'Could not load more posts.'}</span>
      <button type="button" onClick={retry}>{uk ? 'Спробувати ще' : 'Try again'}</button>
    </div>;
  }
  if (!hasMore && records.length > 0 && showComplete) {
    return <div className="infiniteEnd infiniteComplete">
      <span className="infiniteEndDiamond" aria-hidden="true">✦</span>
      <span>{uk ? 'Поки що це всі дописи' : "You're all caught up"}</span>
    </div>;
  }
  if (!hasMore) return null;
  return <div ref={endRef} className="infiniteEnd" role="status" aria-live="polite">
    {loading
      ? <><span className="infiniteSpinner" aria-hidden="true"/>{uk ? 'Завантажуємо більше…' : 'Loading more…'}</>
      : <>{uk ? 'Гортай далі — завантажимо автоматично' : 'Keep scrolling · more posts ahead'}
        {typeof IntersectionObserver === 'undefined' &&
          <button type="button" onClick={loadMore}>{uk ? 'Завантажити' : 'Load more'}</button>}</>}
  </div>;
}

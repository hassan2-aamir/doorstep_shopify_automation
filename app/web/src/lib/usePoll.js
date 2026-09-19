import { useEffect, useRef, useState } from 'react';
import { isUnreachable } from './api.js';

const MAX_BACKOFF_MS = 60000;

// Polls while the tab is visible, pauses while hidden, backs off on errors and keeps the last good
// data on screen. `key` restarts polling (for example when a filter in the URL changes).
export function usePoll(fetcher, intervalMs, key) {
  const [state, setState] = useState({ data: null, error: null, loading: true, paused: false });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const runRef = useRef(() => {});

  useEffect(() => {
    let timer;
    let cancelled = false;
    let failures = 0;
    let controller;

    const schedule = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(run, ms);
    };

    async function run() {
      if (cancelled || document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await fetcherRef.current(controller.signal);
        if (cancelled) return;
        failures = 0;
        setState({ data, error: null, loading: false, paused: false });
        schedule(intervalMs);
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return;
        failures += 1;
        setState((s) => ({ ...s, error: err, loading: false, paused: isUnreachable(err) }));
        schedule(Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS));
      }
    }

    const onVisibility = () => (document.hidden ? clearTimeout(timer) : run());
    runRef.current = run;
    setState((s) => ({ ...s, loading: s.data === null }));
    run();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [key, intervalMs]);

  return { ...state, refresh: () => runRef.current() };
}

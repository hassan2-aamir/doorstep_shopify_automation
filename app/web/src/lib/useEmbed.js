import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Mints a Fastn embed URL from our API (the API key never reaches the browser) and reloads it in place
// when the widget reports that its token expired (N7). Only messages from the widget's own origin count.
export function useEmbed() {
  const [state, setState] = useState({ url: null, error: null, loading: true });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { url } = await api('/api/fastn-token');
      setState({ url, error: null, loading: false });
    } catch (error) {
      setState({ url: null, error, loading: false });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!state.url) return undefined;
    const widgetOrigin = new URL(state.url).origin;
    const onMessage = (ev) => {
      if (ev.origin !== widgetOrigin) return;
      const expired = ev.data === 'fastn:session-expired' || ev.data?.type === 'fastn:session-expired';
      if (expired) load();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [state.url, load]);

  return { ...state, reload: load };
}

import { useEffect, useRef } from 'react';

// Each screen owns one heading. On route change focus moves to it (screen readers announce the new
// screen) and the document title follows.
export function useScreen(title) {
  const headingRef = useRef(null);
  useEffect(() => {
    document.title = `${title} · Doorstep`;
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);
  return headingRef;
}

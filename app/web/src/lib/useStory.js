import { useCallback, useEffect, useRef, useState } from 'react';

const EDITABLE = 'input, select, textarea, [contenteditable=""], [contenteditable="true"]';
const ACTIVATES_ON_SPACE = 'a, button, summary, [role="button"]';
// Sticky public header (64px + 2px border). Slides align just under it.
const HEADER_PX = 66;
// Vertical padding of a slide at desktop widths (py-16).
const SLIDE_PADDING_PX = 64;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Drives the landing page as a story: which slide is on screen, which have been seen (reveals play once),
// and keyboard stepping between them. Scrolling with a mouse, touch or the scrollbar keeps working as normal.
export function useStory(ids) {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0]));
  const activeRef = useRef(0);

  const go = useCallback(
    (index) => {
      const i = Math.max(0, Math.min(ids.length - 1, index));
      document.getElementById(ids[i])?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    },
    [ids],
  );

  useEffect(() => {
    document.documentElement.classList.add('story-snap');
    return () => document.documentElement.classList.remove('story-snap');
  }, []);

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id));
    // A thin band across the middle of the viewport decides which slide is current.
    const band = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = els.indexOf(entry.target);
          if (i < 0) continue;
          activeRef.current = i;
          setActive(i);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    // A slide counts as seen once a quarter of it is on screen, so its reveal plays as it arrives.
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = els.indexOf(entry.target);
          if (i >= 0) setSeen((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
        }
      },
      { threshold: 0.25 },
    );
    els.forEach((el) => {
      if (!el) return;
      band.observe(el);
      reveal.observe(el);
    });
    return () => {
      band.disconnect();
      reveal.disconnect();
    };
  }, [ids]);

  useEffect(() => {
    const step = { ArrowDown: 1, PageDown: 1, ArrowRight: 1, ArrowUp: -1, PageUp: -1, ArrowLeft: -1 };
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(EDITABLE)) return;

      let dir = step[e.key] ?? 0;
      let to = null;
      if (e.key === ' ') {
        if (target?.closest(ACTIVATES_ON_SPACE)) return;
        dir = e.shiftKey ? -1 : 1;
      } else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = ids.length - 1;
      else if (!dir) return;

      if (to === null) {
        // Inside a slide clearly taller than the window, let the browser scroll until that slide's edge is reached.
        // A slide that overflows by no more than its own padding still counts as one screen.
        const rect = document.getElementById(ids[activeRef.current])?.getBoundingClientRect();
        if (rect && dir > 0 && rect.bottom > window.innerHeight + SLIDE_PADDING_PX) return;
        if (rect && dir < 0 && rect.top < HEADER_PX - SLIDE_PADDING_PX) return;
        to = activeRef.current + dir;
      }
      e.preventDefault();
      go(to);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ids, go]);

  return { active, seen, go };
}

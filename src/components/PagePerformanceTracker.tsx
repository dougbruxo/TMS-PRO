'use client';

import { useEffect } from 'react';

/**
 * PagePerformanceTracker
 *
 * An invisible component that sets data-attributes on <html> so that CSS can
 * automatically pause heavy animations and reduce backdrop-filter blur when
 * the user is not actively looking at the page.
 *
 * Attributes managed:
 *  - data-tab-hidden="true|false"  — page is hidden (minimized / background tab)
 *  - data-popup-count="N"          — number of chat popups currently open
 *
 * The CSS in globals.css uses these attributes to:
 *  1. Pause all aurora / gradient animations when the tab is hidden.
 *  2. Reduce backdrop-filter blur intensity when 3+ popups are open.
 */
export function PagePerformanceTracker() {
  useEffect(() => {
    const root = document.documentElement;

    // --- Visibility API: pause CSS animations when tab is not visible ---
    const syncVisibility = () => {
      root.setAttribute('data-tab-hidden', document.hidden ? 'true' : 'false');
    };

    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility(); // Set initial value

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      root.removeAttribute('data-tab-hidden');
    };
  }, []);

  return null;
}

/**
 * usePopupCountSync — call this inside ChatPopupManager to track open popup
 * count on the <html> element for CSS-driven blur reduction.
 */
export function usePopupCountSync(count: number) {
  useEffect(() => {
    document.documentElement.setAttribute('data-popup-count', String(count));
    return () => {
      document.documentElement.removeAttribute('data-popup-count');
    };
  }, [count]);
}

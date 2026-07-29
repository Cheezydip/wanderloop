import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Parallax hook — tracks scroll position of a container and
 * exposes a CSS variable (--scroll-y) for parallax depth layers.
 * Also returns the raw scroll fraction (0–1) for programmatic use.
 */
export default function useParallax(containerRef) {
  const [scrollFraction, setScrollFraction] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    function onScroll() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight - container.clientHeight;
        const fraction = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
        setScrollFraction(fraction);
        container.style.setProperty('--scroll-y', `${scrollTop}px`);
        container.style.setProperty('--scroll-fraction', fraction.toFixed(4));
      });
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // Initial

    return () => {
      container.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);

  return scrollFraction;
}

/**
 * Element parallax — returns a ref to attach to an element.
 * The element will translate based on scroll position and the given speed factor.
 * speed: 0 = no movement, 1 = moves with scroll, >1 = moves faster
 */
export function useElementParallax(scrollContainerRef, speed = 0.3) {
  const elementRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const container = scrollContainerRef?.current;
    const element = elementRef.current;
    if (!container || !element) return;

    function onScroll() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        element.style.transform = `translateY(${scrollTop * speed}px)`;
      });
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollContainerRef, speed]);

  return elementRef;
}

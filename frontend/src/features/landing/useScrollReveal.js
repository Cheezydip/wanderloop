import { useEffect, useRef } from 'react';

/**
 * IntersectionObserver-based scroll reveal hook.
 * Adds `.visible` class to elements entering the viewport.
 * Supports staggered delays for child elements.
 */
export default function useScrollReveal(options = {}) {
  const {
    threshold = 0.15,
    rootMargin = '0px 0px -40px 0px',
    once = true,
  } = options;

  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /* Respect reduced-motion preference */
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      el.classList.add('visible');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          if (once) observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return ref;
}

/**
 * Applies staggered reveal to a container's children.
 * Each child fades in with increasing delay.
 */
export function useStaggerReveal(options = {}) {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -20px 0px',
    staggerMs = 100,
  } = options;

  const ref = useRef(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      Array.from(container.children).forEach((child) => {
        child.classList.add('visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          Array.from(container.children).forEach((child, i) => {
            setTimeout(() => {
              child.classList.add('visible');
            }, i * staggerMs);
          });
          observer.unobserve(container);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [threshold, rootMargin, staggerMs]);

  return ref;
}

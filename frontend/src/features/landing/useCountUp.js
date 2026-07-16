import { useEffect, useRef, useState } from 'react';

/**
 * Animated counter that counts from 0 → target when the element
 * enters the viewport. Respects prefers-reduced-motion.
 */
export default function useCountUp(target, options = {}) {
  const { duration = 2000, threshold = 0.3 } = options;
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const hasRun = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || hasRun.current) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      setValue(target);
      hasRun.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRun.current) {
          hasRun.current = true;
          observer.unobserve(el);

          const startTime = performance.now();
          const easeOutExpo = (t) =>
            t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

          function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutExpo(progress);

            setValue(Math.round(easedProgress * target));

            if (progress < 1) {
              requestAnimationFrame(tick);
            }
          }

          requestAnimationFrame(tick);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, threshold]);

  return { ref, value };
}

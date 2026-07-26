import { useEffect, useRef, useState } from 'react';
import { animate, createSpring } from 'animejs';

/**
 * Animated counter that counts from 0 → target using Anime.js
 * when the element enters the viewport. Respects prefers-reduced-motion.
 */
export default function useCountUp(target, options = {}) {
  const { threshold = 0.2 } = options;
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const hasRun = useRef(false);
  const animRef = useRef(null);

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

          // Use Anime.js v4 for counter animation
          const obj = { val: 0 };
          animRef.current = animate(obj, {
            val: target,
            duration: 1800,
            ease: createSpring({ stiffness: 80, damping: 12 }),
            onUpdate: () => {
              setValue(Math.round(obj.val));
            },
          });
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (animRef.current && animRef.current.pause) animRef.current.pause();
    };
  }, [target, threshold]);

  return { ref, value };
}


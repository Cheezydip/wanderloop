import { useRef, useCallback } from 'react';

/**
 * Magnetic button hook — the button subtly follows the cursor
 * when hovered, creating a "magnetic pull" effect.
 * Returns { ref, onMouseMove, onMouseLeave }
 */
export default function useMagneticButton(strength = 0.3) {
  const ref = useRef(null);

  const onMouseMove = useCallback(
    (e) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) * strength;
      const deltaY = (e.clientY - centerY) * strength;
      el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      el.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
    },
    [strength]
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'translate(0, 0)';
    el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}

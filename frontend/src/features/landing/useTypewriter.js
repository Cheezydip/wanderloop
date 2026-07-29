import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Typewriter hook — cycles through an array of strings,
 * typing and deleting each one character by character.
 * Returns { displayText, isTyping, cursorVisible }
 */
export default function useTypewriter(
  strings = [],
  {
    typeSpeed = 55,
    deleteSpeed = 35,
    pauseAfterType = 2200,
    pauseAfterDelete = 400,
    loop = true,
  } = {}
) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [cursorVisible, setCursorVisible] = useState(true);
  const indexRef = useRef(0);
  const phaseRef = useRef('typing'); // 'typing' | 'pausing' | 'deleting' | 'waiting'
  const charRef = useRef(0);
  const activeRef = useRef(true);

  // Cursor blink
  useEffect(() => {
    const blink = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(blink);
  }, []);

  useEffect(() => {
    if (!strings.length) return;
    activeRef.current = true;

    let timeout;

    function tick() {
      if (!activeRef.current) return;

      const currentString = strings[indexRef.current];

      if (phaseRef.current === 'typing') {
        setIsTyping(true);
        if (charRef.current < currentString.length) {
          charRef.current++;
          setDisplayText(currentString.slice(0, charRef.current));
          timeout = setTimeout(tick, typeSpeed + Math.random() * 30);
        } else {
          phaseRef.current = 'pausing';
          timeout = setTimeout(tick, pauseAfterType);
        }
      } else if (phaseRef.current === 'pausing') {
        phaseRef.current = 'deleting';
        setIsTyping(false);
        timeout = setTimeout(tick, 0);
      } else if (phaseRef.current === 'deleting') {
        if (charRef.current > 0) {
          charRef.current--;
          setDisplayText(currentString.slice(0, charRef.current));
          timeout = setTimeout(tick, deleteSpeed);
        } else {
          phaseRef.current = 'waiting';
          timeout = setTimeout(tick, pauseAfterDelete);
        }
      } else if (phaseRef.current === 'waiting') {
        indexRef.current = (indexRef.current + 1) % strings.length;
        if (!loop && indexRef.current === 0) return;
        phaseRef.current = 'typing';
        timeout = setTimeout(tick, 0);
      }
    }

    tick();

    return () => {
      activeRef.current = false;
      clearTimeout(timeout);
    };
  }, [strings, typeSpeed, deleteSpeed, pauseAfterType, pauseAfterDelete, loop]);

  return { displayText, isTyping, cursorVisible };
}

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { animate, spring } from 'animejs';
import { useTheme } from '../context/ThemeContext';

export default function ThemeSlider({ size = 'medium' }) {
  const { theme, setTheme } = useTheme();
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const handleRef = useRef(null);
  const canvasContainerRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(theme === 'sunset' ? 1 : 0);

  // Sync state when external theme changes
  useEffect(() => {
    const targetProgress = theme === 'sunset' ? 1 : 0;
    setProgress(targetProgress);
  }, [theme]);

  // ─── Three.js 3D Celestial Sphere Canvas ───
  useEffect(() => {
    const mountNode = canvasContainerRef.current;
    if (!mountNode) return;

    const width = mountNode.clientWidth || 20;
    const height = mountNode.clientHeight || 20;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 2.6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountNode.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(0.85, 24, 24);

    const material = new THREE.MeshStandardMaterial({
      roughness: 0.3,
      metalness: 0.7,
      color: new THREE.Color('#1e293b'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.4,
    });

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Subtle halo ring
    const ringGeo = new THREE.TorusGeometry(1.02, 0.025, 12, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#38bdf8'),
      transparent: true,
      opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 3;
    scene.add(ring);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 2, 8);
    pointLight.position.set(2, 2, 2);
    scene.add(pointLight);

    let animationFrameId;
    let lastTime = performance.now();

    const animateScene = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      sphere.rotation.y += delta * 0.8;
      sphere.rotation.x += delta * 0.3;
      ring.rotation.z += delta * 0.6;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animateScene);
    };

    animateScene();

    mountNode._three = { material, ringMat, pointLight, ambientLight };

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mountNode.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
    };
  }, []);

  // Update Three.js materials in real-time as slider moves
  useEffect(() => {
    const mountNode = canvasContainerRef.current;
    if (!mountNode || !mountNode._three) return;

    const { material, ringMat, pointLight, ambientLight } = mountNode._three;

    const darkColor = new THREE.Color('#0f172a');
    const darkEmissive = new THREE.Color('#0ea5e9');
    const darkRing = new THREE.Color('#38bdf8');

    const sunColor = new THREE.Color('#f97316');
    const sunEmissive = new THREE.Color('#f59e0b');
    const sunRing = new THREE.Color('#fbbf24');

    material.color.copy(darkColor).lerp(sunColor, progress);
    material.emissive.copy(darkEmissive).lerp(sunEmissive, progress);
    material.emissiveIntensity = 0.3 + progress * 0.5;
    material.roughness = 0.4 - progress * 0.3;
    material.metalness = 0.8 - progress * 0.6;

    ringMat.color.copy(darkRing).lerp(sunRing, progress);
    ringMat.opacity = 0.3 + progress * 0.5;

    pointLight.color.copy(darkRing).lerp(sunRing, progress);
    ambientLight.color.copy(new THREE.Color('#1e1b4b')).lerp(new THREE.Color('#fef3c7'), progress);
  }, [progress]);

  // ─── Anime.js Position Update & Spring Physics ───
  const updateProgressFromEvent = useCallback((clientX) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const handleWidth = handleRef.current ? handleRef.current.offsetWidth : 20;
    const trackWidth = rect.width - handleWidth;
    if (trackWidth <= 0) return;

    const relativeX = clientX - rect.left - handleWidth / 2;
    const clampedX = Math.max(0, Math.min(relativeX, trackWidth));
    const newProgress = clampedX / trackWidth;

    setProgress(newProgress);
  }, []);

  const snapToClosestTheme = useCallback((currentVal) => {
    const targetTheme = currentVal >= 0.5 ? 'sunset' : 'dark';
    const targetVal = targetTheme === 'sunset' ? 1 : 0;

    // Immediately update theme state so page transition begins at t=0ms simultaneously with slider
    setTheme(targetTheme);

    const obj = { val: currentVal };
    animate(obj, {
      val: targetVal,
      duration: 350,
      ease: spring({ stiffness: 180, damping: 18 }),
      onUpdate: () => setProgress(obj.val),
    });
  }, [setTheme]);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    e.target.setPointerCapture(e.pointerId);

    if (handleRef.current) {
      animate(handleRef.current, {
        scale: [1, 1.15],
        duration: 250,
        ease: spring({ stiffness: 220, damping: 14 }),
      });
    }

    updateProgressFromEvent(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    updateProgressFromEvent(e.clientX);
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (handleRef.current) {
      animate(handleRef.current, {
        scale: [1.15, 1],
        duration: 250,
        ease: spring({ stiffness: 180, damping: 14 }),
      });
    }

    snapToClosestTheme(progress);
  };

  const toggleTo = (targetTheme) => {
    const targetVal = targetTheme === 'sunset' ? 1 : 0;

    // Immediately update theme state so page transition begins at t=0ms simultaneously with slider
    setTheme(targetTheme);

    const obj = { val: progress };
    animate(obj, {
      val: targetVal,
      duration: 350,
      ease: spring({ stiffness: 180, damping: 18 }),
      onUpdate: () => setProgress(obj.val),
    });
  };

  const isCompact = size === 'small';
  const sliderWidthClass = isCompact ? 'w-[52px]' : 'w-[64px]';
  const sliderHeightClass = isCompact ? 'h-[24px]' : 'h-[28px]';
  const handleSize = isCompact ? 18 : 22;

  // Linear lerp helper for frame-by-frame continuous slider color morphing
  const lerpVal = (start, end, t) => start + (end - start) * t;

  const trackR = Math.round(lerpVal(15, 251, progress));
  const trackG = Math.round(lerpVal(23, 191, progress));
  const trackB = Math.round(lerpVal(42, 36, progress));
  const trackA = lerpVal(0.6, 0.15, progress).toFixed(2);
  const trackBg = `rgba(${trackR}, ${trackG}, ${trackB}, ${trackA})`;

  const borderR = Math.round(lerpVal(56, 245, progress));
  const borderG = Math.round(lerpVal(189, 158, progress));
  const borderB = Math.round(lerpVal(248, 11, progress));
  const borderA = lerpVal(0.2, 0.3, progress).toFixed(2);
  const trackBorder = `1px solid rgba(${borderR}, ${borderG}, ${borderB}, ${borderA})`;
  const trackGlow = `0 0 10px rgba(${borderR}, ${borderG}, ${borderB}, ${borderA})`;

  const h1R = Math.round(lerpVal(9, 124, progress));
  const h1G = Math.round(lerpVal(13, 45, progress));
  const h1B = Math.round(lerpVal(22, 18, progress));

  const h2R = Math.round(lerpVal(2, 217, progress));
  const h2G = Math.round(lerpVal(132, 119, progress));
  const h2B = Math.round(lerpVal(199, 6, progress));
  const handleBg = `linear-gradient(135deg, rgb(${h1R}, ${h1G}, ${h1B}), rgb(${h2R}, ${h2G}, ${h2B}))`;
  const handleGlow = `0 0 8px rgba(${borderR}, ${borderG}, ${borderB}, 0.5)`;

  const moonOpacity = lerpVal(0.9, 0.35, progress).toFixed(2);
  const sunOpacity = lerpVal(0.35, 0.9, progress).toFixed(2);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center select-none ${sliderWidthClass} ${sliderHeightClass} rounded-full p-[2px] backdrop-blur-md`}
      style={{
        background: trackBg,
        border: trackBorder,
        boxShadow: trackGlow,
      }}
      role="region"
      aria-label="Minimal Theme Slider"
    >
      <div
        ref={trackRef}
        className="relative w-full h-full flex items-center justify-between px-1 cursor-pointer rounded-full overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Left Icon (Moon) */}
        <button
          type="button"
          onClick={() => toggleTo('dark')}
          className="z-10 flex items-center justify-center cursor-pointer"
          style={{
            opacity: moonOpacity,
            color: '#38bdf8',
          }}
          aria-label="Dark mode"
        >
          <svg viewBox="0 0 20 20" fill="none" width={isCompact ? 11 : 13} height={isCompact ? 11 : 13}>
            <path
              d="M17.25 10.75A7.25 7.25 0 018.75 2.25 7.25 7.25 0 1017.25 10.75z"
              fill={progress < 0.5 ? '#38bdf8' : 'currentColor'}
            />
          </svg>
        </button>

        {/* Right Icon (Sun) */}
        <button
          type="button"
          onClick={() => toggleTo('sunset')}
          className="z-10 flex items-center justify-center cursor-pointer"
          style={{
            opacity: sunOpacity,
            color: '#f59e0b',
          }}
          aria-label="Sunset mode"
        >
          <svg viewBox="0 0 20 20" fill="none" width={isCompact ? 11 : 13} height={isCompact ? 11 : 13}>
            <circle cx="10" cy="10" r="4" fill={progress > 0.5 ? '#f59e0b' : 'currentColor'} />
            <path
              d="M10 2v2M10 16v2M2 10h2M16 10h2M4.34 4.34l1.42 1.42M14.24 14.24l1.42 1.42M4.34 15.66l1.42-1.42M14.24 5.76l1.42-1.42"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* ─── Minimal Handle with 3D Celestial Body ─── */}
        <div
          ref={handleRef}
          className="absolute z-20 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md"
          style={{
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            left: `calc(${progress * 100}% - ${progress * handleSize}px)`,
            background: handleBg,
            boxShadow: handleGlow,
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
          onPointerDown={handlePointerDown}
        >
          <div
            ref={canvasContainerRef}
            className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
            style={{ width: `${handleSize}px`, height: `${handleSize}px` }}
          />
        </div>
      </div>
    </div>
  );
}

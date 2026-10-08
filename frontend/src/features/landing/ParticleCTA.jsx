import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Lightweight Three.js particle constellation for the CTA section.
 * ~150 particles drift slowly and connect with faint lines when close.
 * On scroll into view, particles coalesce into a subtle pattern.
 */
export default function ParticleCTA({ theme = 'dark' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // Colors
    const particleColor = theme === 'sunset' ? 0xe85d3a : 0x2dd4bf;
    const lineColor = theme === 'sunset' ? 0xe85d3a : 0x2dd4bf;

    // Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';

    // Particles
    const PARTICLE_COUNT = prefersReducedMotion ? 40 : 120;
    const MAX_LINE_DIST = 1.2;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
      velocities[i * 3] = (Math.random() - 0.5) * 0.003;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.003;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.001;
    }

    const pointsGeom = new THREE.BufferGeometry();
    pointsGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pointsMat = new THREE.PointsMaterial({
      color: particleColor,
      size: 0.04,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(pointsGeom, pointsMat);
    scene.add(points);

    // Connection lines
    const MAX_LINES = PARTICLE_COUNT * 3;
    const linePositions = new Float32Array(MAX_LINES * 6);
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(linePositions, 3)
    );
    lineGeom.setDrawRange(0, 0);

    const lineMat = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(lineGeom, lineMat);
    scene.add(lines);

    // Resize
    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    window.addEventListener('resize', resize);

    // Animate
    let animId;
    const startAnimTime = performance.now();

    function animate() {
      animId = requestAnimationFrame(animate);

      if (prefersReducedMotion) {
        renderer.render(scene, camera);
        return;
      }

      const elapsed = (performance.now() - startAnimTime) / 1000;

      // Move particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3] += velocities[i * 3];
        positions[i * 3 + 1] += velocities[i * 3 + 1];
        positions[i * 3 + 2] += velocities[i * 3 + 2];

        // Subtle wave
        positions[i * 3 + 1] += Math.sin(elapsed * 0.5 + i * 0.1) * 0.0003;

        // Boundary bounce
        for (let axis = 0; axis < 3; axis++) {
          const idx = i * 3 + axis;
          const limit = axis === 2 ? 1.5 : 5;
          if (Math.abs(positions[idx]) > limit) {
            velocities[idx] *= -1;
          }
        }
      }

      pointsGeom.attributes.position.needsUpdate = true;

      // Build connection lines
      let lineIdx = 0;
      for (let i = 0; i < PARTICLE_COUNT && lineIdx < MAX_LINES; i++) {
        for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < MAX_LINES; j++) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < MAX_LINE_DIST) {
            const base = lineIdx * 6;
            linePositions[base] = positions[i * 3];
            linePositions[base + 1] = positions[i * 3 + 1];
            linePositions[base + 2] = positions[i * 3 + 2];
            linePositions[base + 3] = positions[j * 3];
            linePositions[base + 4] = positions[j * 3 + 1];
            linePositions[base + 5] = positions[j * 3 + 2];
            lineIdx++;
          }
        }
      }

      lineGeom.attributes.position.needsUpdate = true;
      lineGeom.setDrawRange(0, lineIdx * 2);

      // Slow camera drift
      camera.position.x = Math.sin(elapsed * 0.1) * 0.3;
      camera.position.y = Math.cos(elapsed * 0.08) * 0.2;

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      pointsGeom.dispose();
      pointsMat.dispose();
      lineGeom.dispose();
      lineMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [theme]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    />
  );
}

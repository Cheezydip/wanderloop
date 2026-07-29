import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Animated topographic iso-lines background using a custom WebGL shader.
 * Theme-aware and respects prefers-reduced-motion.
 */
export default function TopographicMap({ theme = 'dark', loading = true }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ destroyed: false });
  const loadingRef = useRef(loading);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Reset destroyed flag in case of StrictMode double-mount
    stateRef.current.destroyed = false;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    /* ─── Theme Config: Colors ─── */
    const lineColor = theme === 'sunset' ? 0xe85d3a : 0x2dd4bf;

    /* ─── Scene & Camera ─── */
    const scene = new THREE.Scene();
    
    // Orthographic camera for flat 2D shader rendering
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    camera.position.z = 1;
    
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'none';

    /* ─── Shader Material ─── */
    const uniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(lineColor) },
      uOpacityMultiplier: { value: loadingRef.current ? 0.0 : 1.0 }
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacityMultiplier;
      varying vec2 vUv;

      // Ashima Simplex Noise 2D
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
          + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        // Generate a slowly changing noise field
        vec2 uv = vUv - 0.5;
        
        float time = uTime * 0.15;
        float n1 = snoise(uv * 3.0 + vec2(time * 0.5, time * 0.8));
        float n2 = snoise(uv * 6.0 - vec2(time * 0.3, time * 0.4)) * 0.5;
        float n = n1 + n2;
        
        // Topographic contour lines
        float lineFreq = 12.0;
        float val = sin(n * lineFreq);
        
        // Sharpen the lines
        float line = smoothstep(0.85, 0.95, val);
        
        // Radial fade so it blends into the background nicely
        float dist = length(uv);
        float vignette = smoothstep(0.7, 0.2, dist);
        
        gl_FragColor = vec4(uColor, line * vignette * 0.8 * uOpacityMultiplier);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    /* ─── Resize Handler ─── */
    const handleResize = () => {
      if (stateRef.current.destroyed) return;
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
    };

    // Initial size
    handleResize();

    window.addEventListener('resize', handleResize);

    /* ─── Animation Loop ─── */
    let frameId;
    const animate = () => {
      if (stateRef.current.destroyed) return;
      frameId = requestAnimationFrame(animate);

      if (!prefersReducedMotion) {
        uniforms.uTime.value += 0.01;
      }

      // Ease in the opacity when loader finishes
      const targetOpacity = loadingRef.current ? 0.0 : 1.0;
      if (Math.abs(uniforms.uOpacityMultiplier.value - targetOpacity) > 0.01) {
        uniforms.uOpacityMultiplier.value += (targetOpacity - uniforms.uOpacityMultiplier.value) * 0.05;
      }

      renderer.render(scene, camera);
    };

    animate();

    /* ─── Cleanup ─── */
    return () => {
      stateRef.current.destroyed = true;
      window.removeEventListener('resize', handleResize);
      if (frameId) cancelAnimationFrame(frameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [theme]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
        willChange: 'transform'
      }}
    />
  );
}

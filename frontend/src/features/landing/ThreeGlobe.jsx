import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Enhanced Three.js globe with volumetric lighting, custom materials,
 * location pin drop animation, surface ripples, and camera zoom transitions.
 * Theme-aware, mouse-parallax, and respects prefers-reduced-motion.
 */
export default function ThreeGlobe({ theme = 'dark', loading = true }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ destroyed: false });

  // Store variables in a ref so the animate loop can access their updated values
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    /* ─── Theme Config: Colors & Lights ─── */
    const colors =
      theme === 'sunset'
        ? {
            // Materials
            wireframe: 0xe85d3a,
            wireframeOpacity: 0.35,
            innerSphere: 0xfdf6ee,
            innerSphereOpacity: 0.9,
            specular: 0xe85d3a,
            shininess: 15,
            
            // Particles & Pins
            particle: 0xe85d3a,
            particleOpacity: 0.55,
            pin: 0xf07152,
            ripple: 0xe85d3a,
            
            // Lights
            ambientColor: 0xffedd5,
            ambientIntensity: 0.9,
            keyColor: 0xe85d3a,
            keyIntensity: 1.8,
            fillColor: 0xfdba74,
            fillIntensity: 0.7,
          }
        : {
            // Materials
            wireframe: 0x2dd4bf,
            wireframeOpacity: 0.35,
            innerSphere: 0x0c0e14,
            innerSphereOpacity: 0.85,
            specular: 0x2dd4bf,
            shininess: 25,
            
            // Particles & Pins
            particle: 0x2dd4bf,
            particleOpacity: 0.55,
            pin: 0x5eead4,
            ripple: 0x2dd4bf,
            
            // Lights
            ambientColor: 0x1e1b4b,
            ambientIntensity: 0.7,
            keyColor: 0x2dd4bf,
            keyIntensity: 1.6,
            fillColor: 0x6366f1,
            fillIntensity: 0.9,
          };

    /* ─── Scene & Camera ─── */
    const scene = new THREE.Scene();
    
    // Initial camera position is zoomed in if loading is true
    const initialZ = loadingRef.current ? 2.2 : 4.8;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = initialZ;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Style canvas element
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    /* ─── Volumetric Lighting Setup ─── */
    const ambientLight = new THREE.AmbientLight(colors.ambientColor, colors.ambientIntensity);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(colors.keyColor, colors.keyIntensity);
    keyLight.position.set(5, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(colors.fillColor, colors.fillIntensity);
    fillLight.position.set(-5, -3, 2);
    scene.add(fillLight);

    /* ─── Globe Inner Shaded Mesh ─── */
    const sphereGeo = new THREE.SphereGeometry(1.38, 32, 24);
    const innerSphereMat = new THREE.MeshPhongMaterial({
      color: colors.innerSphere,
      transparent: true,
      opacity: colors.innerSphereOpacity,
      shininess: colors.shininess,
      specular: new THREE.Color(colors.specular),
    });
    const globeInner = new THREE.Mesh(sphereGeo, innerSphereMat);
    scene.add(globeInner);

    /* ─── Globe Outer Wireframe ─── */
    const wireGeo = new THREE.WireframeGeometry(sphereGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: colors.wireframe,
      transparent: true,
      opacity: colors.wireframeOpacity,
    });
    const globeWire = new THREE.LineSegments(wireGeo, wireMat);
    scene.add(globeWire);

    /* ─── Atmosphere Glow Shader ─── */
    const atmosphereVertexShader = `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const atmosphereFragmentShader = `
      varying vec3 vNormal;
      uniform vec3 color;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
        gl_FragColor = vec4(color, 1.0) * intensity;
      }
    `;
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      uniforms: {
        color: { value: new THREE.Color(colors.wireframe) }
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0 // Will fade in
    });
    // Atmosphere is slightly larger than the wireframe
    const atmosphere = new THREE.Mesh(sphereGeo, atmosphereMat);
    atmosphere.scale.set(1.25, 1.25, 1.25);
    scene.add(atmosphere);

    /* ─── Latitude/Longitude Rings ─── */
    const ringCount = 5;
    const rings = [];
    for (let i = 0; i < ringCount; i++) {
      const ringGeo = new THREE.RingGeometry(
        1.41 + i * 0.003,
        1.42 + i * 0.003,
        64
      );
      const ringMat = new THREE.MeshBasicMaterial({
        color: colors.wireframe,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const angle = ((i - 2) / ringCount) * Math.PI * 0.6;
      ring.rotation.x = Math.PI / 2 + angle;
      scene.add(ring);
      rings.push(ring);
    }

    /* ─── Helper: Lat/Lng to 3D coordinates ─── */
    function latLngToVec3(lat, lng, radius) {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -(radius * Math.sin(phi) * Math.cos(theta)),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    }

    /* ─── Loading Pin & Ripple ─── */
    // Dropping pin coordinates (Tokyo - 35.68° N, 139.69° E)
    const targetLat = 35.68;
    const targetLng = 139.69;
    const baseRadius = 1.42;

    const loadingPinGroup = new THREE.Group();
    
    // Pin head (sphere)
    const pinHeadGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const pinHeadMat = new THREE.MeshPhongMaterial({
      color: colors.pin,
      emissive: colors.pin,
      emissiveIntensity: 0.4,
    });
    const pinHead = new THREE.Mesh(pinHeadGeo, pinHeadMat);
    pinHead.position.y = 0.035;
    loadingPinGroup.add(pinHead);

    // Pin shaft (cone pointing down)
    const pinShaftGeo = new THREE.ConeGeometry(0.012, 0.05, 16);
    // Rotate cone to align along the Y axis
    pinShaftGeo.translate(0, 0.015, 0);
    const pinShaft = new THREE.Mesh(pinShaftGeo, pinHeadMat);
    loadingPinGroup.add(pinShaft);

    // Orient pin perpendicular to globe surface
    const surfaceVec = latLngToVec3(targetLat, targetLng, baseRadius);
    loadingPinGroup.position.copy(surfaceVec);
    loadingPinGroup.lookAt(0, 0, 0);
    // Rotate 90 deg around X to point base of cone toward center
    loadingPinGroup.rotateX(Math.PI / 2);
    
    scene.add(loadingPinGroup);

    // Ripple effect on impact (flat ring geometry on surface)
    const rippleGeo = new THREE.RingGeometry(0.01, 0.08, 32);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: colors.ripple,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
    rippleMesh.position.copy(surfaceVec);
    rippleMesh.lookAt(0, 0, 0);
    scene.add(rippleMesh);

    /* ─── Standard Landing Page Pins ─── */
    const pinPositions = [
      { lat: 48.85, lng: 2.35 }, // Paris
      { lat: -33.87, lng: 151.21 }, // Sydney
      { lat: 40.71, lng: -74.01 }, // NYC
      { lat: -22.91, lng: -43.17 }, // Rio
      { lat: 28.61, lng: 77.21 }, // Delhi
      { lat: 1.35, lng: 103.82 }, // Singapore
      { lat: 51.51, lng: -0.13 }, // London
    ];

    const landingPinGroup = new THREE.Group();
    pinPositions.forEach((pos) => {
      const vec = latLngToVec3(pos.lat, pos.lng, baseRadius);
      const dotGeo = new THREE.SphereGeometry(0.02, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({
        color: colors.pin,
        transparent: true,
        opacity: 0, // Starts invisible, fades in when zoom is complete
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(vec);
      landingPinGroup.add(dot);

      // Orbiting pulse ring
      const rGeo = new THREE.RingGeometry(0.024, 0.05, 16);
      const rMat = new THREE.MeshBasicMaterial({
        color: colors.pin,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.copy(vec);
      rMesh.lookAt(0, 0, 0);
      rMesh.userData.baseOpacity = 0.35;
      landingPinGroup.add(rMesh);
    });
    scene.add(landingPinGroup);

    /* ─── Flight Paths (Arcs) ─── */
    const arcGroup = new THREE.Group();
    const createArc = (start, end) => {
      const startVec = latLngToVec3(start.lat, start.lng, baseRadius);
      const endVec = latLngToVec3(end.lat, end.lng, baseRadius);
      
      // Calculate mid-point and elevate it based on distance
      const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
      const distance = startVec.distanceTo(endVec);
      midPoint.normalize().multiplyScalar(baseRadius + distance * 0.25);
      
      const curve = new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
      
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.004, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: colors.pin,
        transparent: true,
        opacity: 0, // Starts hidden, fades in with zoom
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tubeMesh.userData.baseOpacity = 0.4;
      arcGroup.add(tubeMesh);
    };

    // Connect some cities
    createArc(pinPositions[0], pinPositions[2]); // Paris - NYC
    createArc(pinPositions[2], pinPositions[6]); // NYC - London
    createArc(pinPositions[6], pinPositions[4]); // London - Delhi
    createArc(pinPositions[4], pinPositions[5]); // Delhi - Singapore
    createArc(pinPositions[5], pinPositions[1]); // Singapore - Sydney
    createArc(pinPositions[3], pinPositions[0]); // Rio - Paris

    scene.add(arcGroup);

    /* ─── Ambient Particle Field ─── */
    const particleCount = 200;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 2.0 + Math.random() * 2.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = r * Math.cos(phi);
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );

    const particleMat = new THREE.PointsMaterial({
      color: colors.particle,
      size: 0.022,
      transparent: true,
      opacity: 0, // Starts hidden, fades in with zoom out
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    /* ─── Mouse Tilt Parallax ─── */
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    function onMouseMove(e) {
      mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener('mousemove', onMouseMove);

    /* ─── Resize Observer ─── */
    const resizeObserver = new ResizeObserver((entries) => {
      if (stateRef.current.destroyed) return;
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }
    });
    resizeObserver.observe(container);

    /* ─── Animation Timeline States ─── */
    const timer = new THREE.Clock();
    let animId;
    let zoomProgress = loadingRef.current ? 0.0 : 1.0;
    
    // StrictMode flag reset
    stateRef.current.destroyed = false;

    function animate() {
      if (stateRef.current.destroyed) return;
      animId = requestAnimationFrame(animate);

      const elapsed = timer.getElapsedTime();

      // Mouse tracking smoothing
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // 1. PIN DROP ANIMATION (Occurs during loading phase)
      if (loadingRef.current) {
        // Animation timeline parameters
        const dropStart = 0.8;
        const dropDuration = 1.0;
        const dropEnd = dropStart + dropDuration;

        if (elapsed < dropStart) {
          // Hide pin initially
          loadingPinGroup.scale.set(0.001, 0.001, 0.001);
          rippleMat.opacity = 0;
        } else if (elapsed >= dropStart && elapsed < dropEnd) {
          // Pin dropping
          const t = (elapsed - dropStart) / dropDuration;
          const easedT = t * t * (3 - 2 * t); // Smoothstep curve
          
          const dropHeight = THREE.MathUtils.lerp(2.5, baseRadius, easedT);
          const currentVec = latLngToVec3(targetLat, targetLng, dropHeight);
          
          loadingPinGroup.position.copy(currentVec);
          loadingPinGroup.scale.set(easedT, easedT, easedT);
          rippleMat.opacity = 0;
        } else {
          // Pin landed on surface
          loadingPinGroup.position.copy(surfaceVec);
          loadingPinGroup.scale.set(1.0, 1.0, 1.0);

          // Surface ripple loop (repeats every 1.5 seconds)
          const rippleTime = (elapsed - dropEnd) % 1.5;
          const rippleProgress = rippleTime / 1.5;
          const rSize = THREE.MathUtils.lerp(0.01, 0.45, rippleProgress);
          const rOpacity = THREE.MathUtils.lerp(0.8, 0, rippleProgress);

          // Rebuild ring geometry dynamically to expand
          rippleMesh.geometry.dispose();
          rippleMesh.geometry = new THREE.RingGeometry(rSize - 0.015, rSize, 32);
          rippleMat.opacity = rOpacity;
        }
      }

      // 2. ZOOM OUT CINEMATIC REVEAL (Triggers when loading transitions to false)
      if (!loadingRef.current && zoomProgress < 1.0) {
        // Interpolate zoomProgress to 1.0
        zoomProgress += 0.022; // Transitions over ~45 frames (~0.75 seconds)
        if (zoomProgress > 1.0) zoomProgress = 1.0;

        const easedZoom = Math.sin((zoomProgress * Math.PI) / 2); // Sine ease-out
        
        // Move camera back
        camera.position.z = THREE.MathUtils.lerp(2.2, 4.8, easedZoom);

        // Fade in particles
        particleMat.opacity = THREE.MathUtils.lerp(0, colors.particleOpacity, easedZoom);

        // Fade in other landing page pins and arcs and atmosphere
        landingPinGroup.children.forEach((child) => {
          if (child.userData.baseOpacity !== undefined) {
            child.material.opacity = THREE.MathUtils.lerp(0, child.userData.baseOpacity, easedZoom);
          } else {
            child.material.opacity = THREE.MathUtils.lerp(0, 0.9, easedZoom);
          }
        });
        arcGroup.children.forEach((child) => {
          child.material.opacity = THREE.MathUtils.lerp(0, child.userData.baseOpacity, easedZoom);
        });
        atmosphereMat.opacity = THREE.MathUtils.lerp(0, 0.4, easedZoom);

        // Slowly fade out the heavy loading pin drop visual once zoomed out
        const loadingPinOpacity = THREE.MathUtils.lerp(1.0, 0, easedZoom);
        pinHeadMat.opacity = loadingPinOpacity;
        rippleMat.opacity = Math.min(rippleMat.opacity, loadingPinOpacity);
        if (zoomProgress === 1.0) {
          loadingPinGroup.visible = false;
          rippleMesh.visible = false;
        }
      }

      // If page was loaded instantly (e.g. state preserved/HMR)
      if (!loadingRef.current && zoomProgress === 1.0) {
        camera.position.z = 4.8;
        particleMat.opacity = colors.particleOpacity;
        landingPinGroup.children.forEach((child) => {
          if (child.userData.baseOpacity !== undefined) {
            child.material.opacity = child.userData.baseOpacity + Math.sin(elapsed * 2.5 + child.position.x) * 0.15;
          } else {
            child.material.opacity = 0.9;
          }
        });
        arcGroup.children.forEach((child) => {
          child.material.opacity = child.userData.baseOpacity + Math.sin(elapsed * 2.0 + child.position.y) * 0.1;
        });
        atmosphereMat.opacity = 0.4 + Math.sin(elapsed * 1.5) * 0.05;
        loadingPinGroup.visible = false;
        rippleMesh.visible = false;
      }

      /* ─── Globe Rotations ─── */
      if (!prefersReducedMotion) {
        // Main globe rotation combining time + mouse movement
        globeWire.rotation.y = elapsed * 0.08 + mouse.x * 0.25;
        globeWire.rotation.x = Math.sin(elapsed * 0.05) * 0.08 + mouse.y * 0.12;

        globeInner.rotation.y = globeWire.rotation.y;
        globeInner.rotation.x = globeWire.rotation.x;

        // Orbiting pins and arcs sync with globe
        landingPinGroup.rotation.y = globeWire.rotation.y;
        landingPinGroup.rotation.x = globeWire.rotation.x;
        arcGroup.rotation.y = globeWire.rotation.y;
        arcGroup.rotation.x = globeWire.rotation.x;

        // If loading, let the dropping pin rotate with the globe
        if (loadingRef.current) {
          loadingPinGroup.rotation.y = globeWire.rotation.y;
          loadingPinGroup.rotation.x = globeWire.rotation.x;
          rippleMesh.rotation.y = globeWire.rotation.y;
          rippleMesh.rotation.x = globeWire.rotation.x;
        }

        // Particle field rotation (slower, ambient)
        particles.rotation.y = elapsed * 0.012;
        particles.rotation.x = Math.sin(elapsed * 0.015) * 0.04;

        // Lat/Lng rings rotation
        rings.forEach((ring, idx) => {
          ring.rotation.z = elapsed * 0.01 * (idx % 2 === 0 ? 1 : -1);
        });
      }

      renderer.render(scene, camera);
    }

    animate();

    /* ─── Cleanup Resources ─── */
    return () => {
      stateRef.current.destroyed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      resizeObserver.disconnect();
      
      // Dispose Three.js objects to avoid memory leaks
      renderer.dispose();
      wireMat.dispose();
      wireGeo.dispose();
      sphereGeo.dispose();
      innerSphereMat.dispose();
      pinHeadMat.dispose();
      pinHeadGeo.dispose();
      pinShaftGeo.dispose();
      rippleGeo.dispose();
      rippleMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      atmosphereMat.dispose();
      
      landingPinGroup.children.forEach(c => {
        c.geometry.dispose();
        c.material.dispose();
      });
      arcGroup.children.forEach(c => {
        c.geometry.dispose();
        c.material.dispose();
      });

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
        zIndex: 1, // Visual depth level
        pointerEvents: 'none',
        willChange: 'transform',
      }}
      aria-hidden="true"
    />
  );
}

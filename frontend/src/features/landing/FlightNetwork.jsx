import { useEffect, useRef } from 'react';

/**
 * Premium Abstract Flight Network Canvas Animation
 * Renders an interactive 3D/2D network of global travel hubs, bezier flight arcs,
 * traveling jet energy pulses with particle trails, and interactive mouse parallax.
 */
export default function FlightNetwork({ theme = 'dark', loading = false }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ destroyed: false });
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });
  const loadingRef = useRef(loading);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    stateRef.current.destroyed = false;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Theme color palette generator
    const getColors = (currentTheme) => {
      if (currentTheme === 'sunset') {
        return {
          nodeCore: '#fbbf24',       // Amber gold
          nodeHalo: 'rgba(249, 115, 22, 0.4)',  // Coral orange halo
          arcLine: 'rgba(234, 88, 12, 0.15)',   // Soft orange arc
          pulseColor: '#f59e0b',    // Bright yellow/amber pulse
          trailColor: 'rgba(244, 63, 94, 0.6)', // Coral pink trail
          gridLine: 'rgba(251, 146, 60, 0.06)', // Background grid line
          particle: 'rgba(254, 215, 170, 0.3)',
          ripple: 'rgba(249, 115, 22, 0.6)',
        };
      }
      if (currentTheme === 'day' || currentTheme === 'sunlit') {
        return {
          nodeCore: '#0284c7',       // Sky blue
          nodeHalo: 'rgba(37, 99, 235, 0.25)', // Sapphire halo
          arcLine: 'rgba(59, 130, 246, 0.18)',  // Arc line
          pulseColor: '#0284c7',    // Vibrant blue pulse
          trailColor: 'rgba(79, 70, 229, 0.5)',// Indigo trail
          gridLine: 'rgba(147, 197, 253, 0.12)',
          particle: 'rgba(30, 64, 175, 0.25)',
          ripple: 'rgba(2, 132, 199, 0.5)',
        };
      }
      // Dark / Midnight default
      return {
        nodeCore: '#2dd4bf',         // Teal cyan
        nodeHalo: 'rgba(6, 182, 212, 0.35)',   // Electric cyan halo
        arcLine: 'rgba(20, 184, 166, 0.16)',   // Teal arc line
        pulseColor: '#38bdf8',      // Sky cyan pulse
        trailColor: 'rgba(16, 185, 129, 0.6)', // Emerald trail
        gridLine: 'rgba(45, 212, 191, 0.05)',  // Subtle grid
        particle: 'rgba(153, 246, 228, 0.35)',
        ripple: 'rgba(56, 189, 248, 0.6)',
      };
    };

    let colors = getColors(theme);

    // Canvas Sizing
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (stateRef.current.destroyed || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
      initNetwork();
    };

    window.addEventListener('resize', handleResize);

    // Mouse movement listener for interactive parallax
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseRef.current.targetX = x;
      mouseRef.current.targetY = y;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Network Node data structures
    let nodes = [];
    let flightRoutes = [];
    let backgroundParticles = [];

    // Realistic Hub Distributions normalized (0..1)
    const hubPresets = [
      { x: 0.15, y: 0.35, name: 'NYC' },
      { x: 0.22, y: 0.45, name: 'MIA' },
      { x: 0.10, y: 0.48, name: 'LAX' },
      { x: 0.28, y: 0.68, name: 'GRU' },
      { x: 0.45, y: 0.28, name: 'LHR' },
      { x: 0.49, y: 0.32, name: 'CDG' },
      { x: 0.52, y: 0.30, name: 'FRA' },
      { x: 0.58, y: 0.42, name: 'DXB' },
      { x: 0.55, y: 0.58, name: 'JNB' },
      { x: 0.72, y: 0.35, name: 'DEL' },
      { x: 0.80, y: 0.48, name: 'SIN' },
      { x: 0.85, y: 0.32, name: 'HND' },
      { x: 0.82, y: 0.38, name: 'PVG' },
      { x: 0.90, y: 0.75, name: 'SYD' },
      { x: 0.35, y: 0.25, name: 'REK' },
      { x: 0.65, y: 0.40, name: 'DOH' },
      { x: 0.76, y: 0.52, name: 'BKK' },
      { x: 0.18, y: 0.28, name: 'YYZ' },
    ];

    function initNetwork() {
      nodes = [];
      flightRoutes = [];
      backgroundParticles = [];

      // Generate nodes based on hubs + organic satellite points
      hubPresets.forEach((hub, i) => {
        nodes.push({
          id: i,
          normX: hub.x,
          normY: hub.y,
          x: hub.x * width,
          y: hub.y * height,
          radius: Math.random() * 2 + 2.5,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.03 + Math.random() * 0.02,
          name: hub.name,
          active: false,
          rippleRadius: 0,
          rippleAlpha: 0,
        });
      });

      // Add additional organic secondary nodes
      const extraCount = 18;
      for (let i = 0; i < extraCount; i++) {
        const nx = 0.05 + Math.random() * 0.9;
        const ny = 0.15 + Math.random() * 0.7;
        nodes.push({
          id: hubPresets.length + i,
          normX: nx,
          normY: ny,
          x: nx * width,
          y: ny * height,
          radius: Math.random() * 1.8 + 1.2,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.02 + Math.random() * 0.02,
          name: '',
          active: false,
          rippleRadius: 0,
          rippleAlpha: 0,
        });
      }

      // Generate flight routes between logical hub pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);

          // Connect if distance is reasonable (not too close, not too long)
          if (dist > 80 && dist < width * 0.45 && Math.random() < 0.35) {
            // Calculate curved control point for Bezier arc
            const midX = (n1.x + n2.x) / 2;
            const midY = (n1.y + n2.y) / 2;
            // Arc curvature perpendicular offset
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const norm = Math.hypot(dx, dy);
            const curvature = (Math.random() > 0.5 ? 1 : -1) * (dist * 0.25);
            const ctrlX = midX - (dy / norm) * curvature;
            const ctrlY = midY + (dx / norm) * curvature;

            // Flight Pulses travelling along route
            const flightCount = Math.floor(Math.random() * 2) + 1;
            const flights = [];
            for (let f = 0; f < flightCount; f++) {
              flights.push({
                progress: Math.random(),
                speed: 0.0015 + Math.random() * 0.0025,
                trail: [], // positions history for particle trail
                maxTrail: 14,
              });
            }

            flightRoutes.push({
              source: n1,
              target: n2,
              ctrlX,
              ctrlY,
              flights,
            });
          }
        }
      }

      // Generate ambient floating particles
      for (let i = 0; i < 45; i++) {
        backgroundParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.5 + 0.1,
        });
      }
    }

    initNetwork();

    // Quadratic Bezier point calculation
    function getBezierPoint(t, p0, p1, p2) {
      const oneMinusT = 1 - t;
      return {
        x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
        y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
      };
    }

    // Animation Render Loop
    let animId;
    let opacityMultiplier = loadingRef.current ? 0 : 1;

    function render() {
      if (stateRef.current.destroyed) return;
      animId = requestAnimationFrame(render);

      // Smooth mouse interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mouseOffsetX = (mouseRef.current.x - 0.5) * 35;
      const mouseOffsetY = (mouseRef.current.y - 0.5) * 35;

      // Opacity easing
      const targetOpacity = loadingRef.current ? 0 : 1;
      opacityMultiplier += (targetOpacity - opacityMultiplier) * 0.04;

      ctx.clearRect(0, 0, width, height);

      if (opacityMultiplier < 0.01) return;
      ctx.globalAlpha = opacityMultiplier;

      colors = getColors(theme);

      // 1. Draw Background Particles
      ctx.fillStyle = colors.particle;
      backgroundParticles.forEach((p) => {
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }

        ctx.beginPath();
        ctx.arc(p.x + mouseOffsetX * 0.2, p.y + mouseOffsetY * 0.2, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Draw Flight Routes (Bezier Arcs)
      ctx.lineWidth = 1;
      flightRoutes.forEach((route) => {
        const p0 = { x: route.source.x + mouseOffsetX * 0.5, y: route.source.y + mouseOffsetY * 0.5 };
        const p1 = { x: route.ctrlX + mouseOffsetX * 0.7, y: route.ctrlY + mouseOffsetY * 0.7 };
        const p2 = { x: route.target.x + mouseOffsetX * 0.5, y: route.target.y + mouseOffsetY * 0.5 };

        // Curved flight arc
        ctx.strokeStyle = colors.arcLine;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
        ctx.stroke();

        // 3. Update & Draw Jet Flight Pulses
        route.flights.forEach((flight) => {
          if (!prefersReducedMotion) {
            flight.progress += flight.speed;
            if (flight.progress >= 1) {
              flight.progress = 0;
              // Trigger ripple at target node
              route.target.rippleRadius = 4;
              route.target.rippleAlpha = 0.8;
            }
          }

          const currentPos = getBezierPoint(flight.progress, p0, p1, p2);

          // Update trail history
          flight.trail.unshift(currentPos);
          if (flight.trail.length > flight.maxTrail) {
            flight.trail.pop();
          }

          // Draw trail
          for (let k = 0; k < flight.trail.length - 1; k++) {
            const pt1 = flight.trail[k];
            const pt2 = flight.trail[k + 1];
            const trailAlpha = (1 - k / flight.trail.length) * 0.5;

            ctx.strokeStyle = colors.trailColor;
            ctx.globalAlpha = opacityMultiplier * trailAlpha;
            ctx.lineWidth = Math.max(0.5, 2 - k * 0.12);
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.stroke();
          }

          // Draw Flight Pulse Head (Glowing Beacon)
          ctx.globalAlpha = opacityMultiplier;
          ctx.fillStyle = colors.pulseColor;
          ctx.shadowColor = colors.pulseColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(currentPos.x, currentPos.y, 2.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0; // reset glow
        });
      });

      // 4. Draw Nodes (Cities & Hubs)
      nodes.forEach((node) => {
        const nx = node.x + mouseOffsetX * 0.5;
        const ny = node.y + mouseOffsetY * 0.5;

        node.pulsePhase += node.pulseSpeed;
        const haloScale = 1 + Math.sin(node.pulsePhase) * 0.35;

        // Draw Pulsing Halo
        ctx.fillStyle = colors.nodeHalo;
        ctx.beginPath();
        ctx.arc(nx, ny, (node.radius + 4) * haloScale, 0, Math.PI * 2);
        ctx.fill();

        // Draw Node Core
        ctx.fillStyle = colors.nodeCore;
        ctx.shadowColor = colors.nodeCore;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(nx, ny, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw Arrival Ripple effect if active
        if (node.rippleAlpha > 0.01) {
          ctx.strokeStyle = colors.ripple;
          ctx.globalAlpha = opacityMultiplier * node.rippleAlpha;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(nx, ny, node.rippleRadius, 0, Math.PI * 2);
          ctx.stroke();

          node.rippleRadius += 0.6;
          node.rippleAlpha *= 0.94;
        }

        // Draw Hub Labels for major hubs
        if (node.name) {
          ctx.globalAlpha = opacityMultiplier * 0.65;
          ctx.fillStyle = colors.nodeCore;
          ctx.font = '500 10px Inter, system-ui, sans-serif';
          ctx.fillText(node.name, nx + node.radius + 5, ny + 3);
        }
      });
    }

    render();

    return () => {
      stateRef.current.destroyed = true;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [theme]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

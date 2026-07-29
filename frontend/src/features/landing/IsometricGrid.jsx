import { useEffect, useRef } from 'react';

/**
 * Premium Kinetic Isometric 3D City Grid & Concentric Circular Beam Component
 * Renders an isometric 3D city mesh with wireframe buildings, interactive mouse parallax,
 * expanding circular sonar waves radiating from grid center, and reactive building glow.
 */
export default function IsometricGrid({ theme = 'dark', loading = false }) {
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
      if (currentTheme === 'sunset' || currentTheme === 'day' || currentTheme === 'sunlit') {
        return {
          gridLine: 'rgba(234, 88, 12, 0.12)',
          gridLineBright: 'rgba(249, 115, 22, 0.45)',
          buildingEdge: 'rgba(245, 158, 11, 0.35)',
          buildingTop: 'rgba(251, 146, 60, 0.15)',
          buildingGlowTop: 'rgba(249, 115, 22, 0.55)',
          buildingGlowEdge: 'rgba(234, 88, 12, 0.85)',
          beamRing: 'rgba(249, 115, 22, 0.45)',
          beamGlow: 'rgba(245, 158, 11, 0.18)',
          nodeCore: '#f97316',
          nodeGlow: 'rgba(245, 158, 11, 0.6)',
          transitLine: 'rgba(234, 88, 12, 0.25)',
          pulseColor: '#fbbf24',
          labelColor: '#ea580c',
        };
      }
      // Dark / Midnight default
      return {
        gridLine: 'rgba(45, 212, 191, 0.12)',
        gridLineBright: 'rgba(56, 189, 248, 0.45)',
        buildingEdge: 'rgba(6, 182, 212, 0.4)',
        buildingTop: 'rgba(45, 212, 191, 0.15)',
        buildingGlowTop: 'rgba(45, 212, 191, 0.65)',
        buildingGlowEdge: 'rgba(56, 189, 248, 0.95)',
        beamRing: 'rgba(56, 189, 248, 0.55)',
        beamGlow: 'rgba(45, 212, 191, 0.18)',
        nodeCore: '#2dd4bf',
        nodeGlow: 'rgba(56, 189, 248, 0.6)',
        transitLine: 'rgba(14, 165, 233, 0.25)',
        pulseColor: '#38bdf8',
        labelColor: '#2dd4bf',
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
    };

    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseRef.current.targetX = x;
      mouseRef.current.targetY = y;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Grid Dimensions
    const gridCols = 16;
    const gridRows = 16;
    const tileWidth = 60;
    const tileHeight = 30;

    // Isometric 2D to 3D Projection Helper
    function toIso(gridX, gridY, elevation = 0, originX, originY) {
      const x = (gridX - gridY) * (tileWidth / 2) + originX;
      const y = (gridX + gridY) * (tileHeight / 2) - elevation + originY;
      return { x, y };
    }

    // Procedural City Buildings
    const buildings = [];
    const landmarks = [
      { col: 3, row: 4, height: 70, name: 'Tokyo Hub', glow: 0 },
      { col: 12, row: 5, height: 95, name: 'Paris Arch', glow: 0 },
      { col: 5, row: 12, height: 80, name: 'NYC Tower', glow: 0 },
      { col: 10, row: 11, height: 60, name: 'Bali Villa', glow: 0 },
    ];

    // Generate ambient buildings on grid
    for (let c = 1; c < gridCols - 1; c += 2) {
      for (let r = 1; r < gridRows - 1; r += 2) {
        if (Math.random() < 0.45) {
          buildings.push({
            col: c,
            row: r,
            height: 25 + Math.random() * 50,
            widthScale: 0.7 + Math.random() * 0.2,
            glow: 0, // dynamic glow state when hit by expanding circular beam
          });
        }
      }
    }

    // Transit Energy Pulses along isometric grid axes
    const transitPulses = [];
    for (let i = 0; i < 8; i++) {
      transitPulses.push({
        col: Math.floor(Math.random() * gridCols),
        row: Math.floor(Math.random() * gridRows),
        dir: Math.random() > 0.5 ? 'col' : 'row',
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.008,
      });
    }

    // Concentric Circular Waves Array
    const circularBeams = [
      { radius: 0, maxRadius: 360, speed: 1.4, alpha: 1 },
      { radius: 120, maxRadius: 360, speed: 1.4, alpha: 0.6 },
      { radius: 240, maxRadius: 360, speed: 1.4, alpha: 0.3 },
    ];

    let opacityMultiplier = loadingRef.current ? 0 : 1;
    let animId;

    function render() {
      if (stateRef.current.destroyed) return;
      animId = requestAnimationFrame(render);

      // Mouse Parallax Smooth Interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mouseOffsetX = (mouseRef.current.x - 0.5) * 50;
      const mouseOffsetY = (mouseRef.current.y - 0.5) * 30;

      // Center origin of grid
      const originX = width * 0.5 + mouseOffsetX;
      const originY = height * 0.38 + mouseOffsetY;

      // Center isometric point
      const centerIso = toIso(gridCols / 2, gridRows / 2, 0, originX, originY);
      const maxGridRadius = (gridCols * tileWidth) / 2.2;

      // Opacity Easing
      const targetOpacity = loadingRef.current ? 0 : 1;
      opacityMultiplier += (targetOpacity - opacityMultiplier) * 0.04;

      ctx.clearRect(0, 0, width, height);

      if (opacityMultiplier < 0.01) return;
      ctx.globalAlpha = opacityMultiplier;

      colors = getColors(theme);

      // 1. Update Expanding Concentric Circular Beams
      if (!prefersReducedMotion) {
        circularBeams.forEach((beam) => {
          beam.radius += beam.speed;
          if (beam.radius >= maxGridRadius) {
            beam.radius = 0;
          }
          // Calculate relative alpha based on distance
          beam.alpha = Math.sin((beam.radius / maxGridRadius) * Math.PI);
        });
      }

      // 2. Draw Expanding Circular Beams (confining to grid bounds)
      circularBeams.forEach((beam) => {
        if (beam.radius <= 0 || beam.alpha <= 0.01) return;

        ctx.save();
        // Outer glowing ring
        ctx.strokeStyle = colors.beamRing;
        ctx.globalAlpha = opacityMultiplier * beam.alpha * 0.65;
        ctx.lineWidth = 2;
        ctx.shadowColor = colors.beamRing;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.arc(centerIso.x, centerIso.y, beam.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner soft radial gradient fill
        const fillGrad = ctx.createRadialGradient(
          centerIso.x,
          centerIso.y,
          Math.max(0, beam.radius - 25),
          centerIso.x,
          centerIso.y,
          beam.radius
        );
        fillGrad.addColorStop(0, 'transparent');
        fillGrad.addColorStop(0.8, colors.beamGlow);
        fillGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = fillGrad;
        ctx.beginPath();
        ctx.arc(centerIso.x, centerIso.y, beam.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // 3. Check Reaction: Glow Buildings & Landmarks when passed over by circular beam
      buildings.forEach((b) => {
        const bPos = toIso(b.col, b.row, 0, originX, originY);
        const distFromCenter = Math.hypot(bPos.x - centerIso.x, bPos.y - centerIso.y);

        // Check if any active circular beam is close to building distance
        circularBeams.forEach((beam) => {
          if (Math.abs(beam.radius - distFromCenter) < 28) {
            b.glow = 1.0; // Trigger full glow
          }
        });

        // Decay glow smoothly
        b.glow *= 0.94;
      });

      landmarks.forEach((lm) => {
        const lmPos = toIso(lm.col, lm.row, 0, originX, originY);
        const distFromCenter = Math.hypot(lmPos.x - centerIso.x, lmPos.y - centerIso.y);

        circularBeams.forEach((beam) => {
          if (Math.abs(beam.radius - distFromCenter) < 32) {
            lm.glow = 1.0;
          }
        });

        lm.glow *= 0.94;
      });

      // 4. Draw Isometric Base Grid Lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.gridLine;

      for (let c = 0; c <= gridCols; c++) {
        const p1 = toIso(c, 0, 0, originX, originY);
        const p2 = toIso(c, gridRows, 0, originX, originY);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      for (let r = 0; r <= gridRows; r++) {
        const p1 = toIso(0, r, 0, originX, originY);
        const p2 = toIso(gridCols, r, 0, originX, originY);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // 5. Draw Transit Pulses along grid lines
      transitPulses.forEach((tp) => {
        if (!prefersReducedMotion) {
          tp.progress += tp.speed;
          if (tp.progress > 1) {
            tp.progress = 0;
            tp.col = Math.floor(Math.random() * gridCols);
            tp.row = Math.floor(Math.random() * gridRows);
          }
        }

        let pPos;
        if (tp.dir === 'col') {
          pPos = toIso(tp.col, tp.progress * gridRows, 0, originX, originY);
        } else {
          pPos = toIso(tp.progress * gridCols, tp.row, 0, originX, originY);
        }

        ctx.fillStyle = colors.pulseColor;
        ctx.shadowColor = colors.pulseColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(pPos.x, pPos.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 6. Draw Procedural City Buildings (with reactive circular beam glow)
      buildings.forEach((b) => {
        const base = toIso(b.col, b.row, 0, originX, originY);
        const top = toIso(b.col, b.row, b.height, originX, originY);

        const w = (tileWidth / 2) * b.widthScale;
        const h = (tileHeight / 2) * b.widthScale;

        const bBottom = { x: base.x, y: base.y + h };
        const bRight = { x: base.x + w, y: base.y };
        const bTop = { x: base.x, y: base.y - h };
        const bLeft = { x: base.x - w, y: base.y };

        const tBottom = { x: top.x, y: top.y + h };
        const tRight = { x: top.x + w, y: top.y };
        const tTop = { x: top.x, y: top.y - h };
        const tLeft = { x: top.x - w, y: top.y };

        // Determine current fill & stroke based on building glow state
        const isGlowing = b.glow > 0.05;

        ctx.fillStyle = isGlowing
          ? colors.buildingGlowTop
          : colors.buildingTop;

        ctx.beginPath();
        ctx.moveTo(tTop.x, tTop.y);
        ctx.lineTo(tRight.x, tRight.y);
        ctx.lineTo(tBottom.x, tBottom.y);
        ctx.lineTo(tLeft.x, tLeft.y);
        ctx.closePath();
        ctx.fill();

        // Vertical Edge Lines
        ctx.strokeStyle = isGlowing
          ? colors.buildingGlowEdge
          : colors.buildingEdge;
        ctx.lineWidth = isGlowing ? 1.5 : 1;

        if (isGlowing) {
          ctx.shadowColor = colors.buildingGlowEdge;
          ctx.shadowBlur = 10 * b.glow;
        }

        ctx.beginPath();
        ctx.moveTo(bBottom.x, bBottom.y);
        ctx.lineTo(tBottom.x, tBottom.y);
        ctx.moveTo(bRight.x, bRight.y);
        ctx.lineTo(tRight.x, tRight.y);
        ctx.moveTo(bLeft.x, bLeft.y);
        ctx.lineTo(tLeft.x, tLeft.y);
        ctx.stroke();

        // Top Outline
        ctx.beginPath();
        ctx.moveTo(tTop.x, tTop.y);
        ctx.lineTo(tRight.x, tRight.y);
        ctx.lineTo(tBottom.x, tBottom.y);
        ctx.lineTo(tLeft.x, tLeft.y);
        ctx.closePath();
        ctx.stroke();

        ctx.shadowBlur = 0;
      });

      // 7. Draw Landmark Towers & Pin Indicators
      landmarks.forEach((lm) => {
        const base = toIso(lm.col, lm.row, 0, originX, originY);
        const top = toIso(lm.col, lm.row, lm.height, originX, originY);

        const isGlowing = lm.glow > 0.05;

        // Tower Pillar line
        ctx.strokeStyle = isGlowing ? colors.pulseColor : colors.nodeCore;
        ctx.lineWidth = isGlowing ? 2.5 : 2;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();

        // Glowing Core Top Pin
        ctx.fillStyle = isGlowing ? colors.pulseColor : colors.nodeCore;
        ctx.shadowColor = colors.nodeCore;
        ctx.shadowBlur = isGlowing ? 18 : 10;
        ctx.beginPath();
        ctx.arc(top.x, top.y, isGlowing ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = colors.labelColor;
        ctx.font = '600 10px Inter, system-ui, sans-serif';
        ctx.fillText(lm.name, top.x + 8, top.y + 3);
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

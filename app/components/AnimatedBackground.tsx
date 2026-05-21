"use client";

import { useEffect, useRef } from "react";

type Dot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

const MAX_DOTS_MOBILE  = 30;
const MAX_DOTS_TABLET  = 45;
const MAX_DOTS_DESKTOP = 65;
const LINK_DISTANCE    = 140;

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    let linkDistanceSq = LINK_DISTANCE * LINK_DISTANCE;
    let paused = false;

    const getDotCount = () => {
      if (width <= 640)  return MAX_DOTS_MOBILE;
      if (width <= 1024) return MAX_DOTS_TABLET;
      return MAX_DOTS_DESKTOP;
    };

    const buildDots = () => {
      dots = Array.from({ length: getDotCount() }, () => ({
        x:  Math.random() * width,
        y:  Math.random() * height,
        vx: (Math.random() - 0.5) * 0.42,
        vy: (Math.random() - 0.5) * 0.42
      }));
    };

    const resize = () => {
      width  = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width  = Math.floor(width  * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width  = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      linkDistanceSq = (width <= 640 ? 90 : LINK_DISTANCE) ** 2;
      buildDots();
    };

    const linkDist = () => width <= 640 ? 90 : LINK_DISTANCE;

    const tick = () => {
      if (paused) { raf = requestAnimationFrame(tick); return; }

      ctx.clearRect(0, 0, width, height);

      const ld = linkDist();

      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        a.x += a.vx;
        a.y += a.vy;
        if (a.x <= 0 || a.x >= width)  a.vx *= -1;
        if (a.y <= 0 || a.y >= height) a.vy *= -1;

        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < linkDistanceSq) {
            const alpha = (1 - Math.sqrt(dSq) / ld) * 0.22;
            ctx.strokeStyle = `rgba(196,236,255,${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = "rgba(227,246,255,0.72)";
      for (const dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => { paused = document.hidden; };

    resize();
    tick();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="bg-canvas" aria-hidden="true" />;
}

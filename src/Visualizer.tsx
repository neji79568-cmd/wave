import { useEffect, useRef } from 'react';
export type VisualMode = 'waves' | 'orbit' | 'spectrum';
// VJ artwork follows playback state; it is not an FFT measurement of remote audio.
export function Visualizer({
  active = false,
  ambient = false,
  mode = 'waves',
  className = '',
}: {
  active?: boolean;
  ambient?: boolean;
  mode?: VisualMode;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ active, ambient, mode });
  const wake = useRef(() => {});
  state.current = { active, ambient, mode };
  useEffect(() => {
    const el = canvas.current!;
    if (!el) return;
    const ctx = el.getContext('2d', { alpha: false });
    if (!ctx) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = matchMedia('(max-width: 760px)').matches;
    let frame = 0;
    let visible = true;
    let last = 0;
    let t = 0;
    let w = 600;
    let h = 300;
    let disposed = false;
    let px = 0.5;
    function start() {
      if (!frame && !disposed && !document.hidden && visible) frame = requestAnimationFrame(paint);
    }
    function paint(now: number) {
      frame = 0;
      if (disposed || document.hidden || !visible) return;
      const s = state.current;
      const animate =
        !motion.matches &&
        document.documentElement.dataset.energy !== 'true' &&
        (s.active || s.ambient);
      if (animate && now - last < (mobile ? 42 : 33)) {
        start();
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.06);
      last = now;
      if (animate) t += dt * (s.active ? 1 : 0.35);
      ctx!.fillStyle = '#0c0812';
      ctx!.fillRect(0, 0, w, h);
      const glow = ctx!.createRadialGradient(
        w * (0.5 + (px - 0.5) * 0.1),
        h * 0.55,
        0,
        w * 0.5,
        h * 0.5,
        w * 0.7,
      );
      glow.addColorStop(0, '#61299e55');
      glow.addColorStop(0.5, '#24113e80');
      glow.addColorStop(1, '#09070d');
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, w, h);
      ctx!.save();
      ctx!.globalCompositeOperation = 'screen';
      if (s.mode === 'waves')
        for (let j = 0; j < 14; j++) {
          ctx!.beginPath();
          for (let x = 0; x <= w; x += 5) {
            const nx = x / w;
            const y =
              h * 0.53 +
              Math.sin(nx * 9 + t * 1.2 + j * 0.15) * h * 0.18 * Math.sin(nx * Math.PI) +
              Math.cos(nx * 5 - t * 0.5 + j * 0.21) * h * 0.1 +
              (j - 7) * 4;
            x === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
          }
          ctx!.strokeStyle = `hsla(${265 + j * 2},90%,${56 + j * 1.5}%,${0.2 + Math.sin((j / 14) * Math.PI) * 0.4})`;
          ctx!.lineWidth = j === 7 ? 2.5 : 1;
          ctx!.stroke();
        }
      else if (s.mode === 'orbit')
        for (let j = 0; j < 25; j++) {
          ctx!.save();
          ctx!.translate(w * 0.5, h * 0.5);
          ctx!.rotate(t * 0.15 + j * 0.105);
          ctx!.beginPath();
          ctx!.ellipse(
            0,
            0,
            w * 0.15 + j * 1.8,
            h * 0.27,
            Math.sin(t * 0.2 + j * 0.12) * 0.5,
            0,
            Math.PI * 2,
          );
          ctx!.strokeStyle = `hsla(${260 + j * 2},90%,65%,${0.15 + j / 90})`;
          ctx!.lineWidth = 1;
          ctx!.stroke();
          ctx!.restore();
        }
      else {
        const n = mobile ? 40 : 64;
        const gap = w / (n + 6);
        for (let i = 0; i < n; i++) {
          const x = gap * (i + 3);
          const height =
            (0.12 + Math.abs(Math.sin(i * 0.39 + t * 2) * Math.cos(i * 0.14 - t)) * 0.62) *
            h *
            Math.pow(Math.sin(((i + 1) / (n + 1)) * Math.PI), 0.8);
          const g = ctx!.createLinearGradient(0, h * 0.5 - height / 2, 0, h * 0.5 + height / 2);
          g.addColorStop(0, '#eccaff');
          g.addColorStop(0.4, '#a26bff');
          g.addColorStop(1, '#6930c4');
          ctx!.fillStyle = g;
          ctx!.beginPath();
          ctx!.roundRect(x, h * 0.5 - height / 2, Math.max(2, gap * 0.55), Math.max(3, height), 4);
          ctx!.fill();
        }
      }
      for (let i = 0; i < 20; i++) {
        ctx!.fillStyle = i % 3 === 0 ? '#e2bfff99' : '#ae83f33c';
        ctx!.beginPath();
        ctx!.arc(
          (i * 127.3 + t * 4) % Math.max(w, 1),
          (Math.sin(i * 37.8 + t * 0.12) * 0.4 + 0.5) * h,
          i % 3 === 0 ? 1.4 : 0.7,
          0,
          Math.PI * 2,
        );
        ctx!.fill();
      }
      ctx!.restore();
      el.dataset.frame = String(Math.floor(t * 100));
      if (animate) start();
    }
    function resize() {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      el.width = w * dpr;
      el.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      start();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) start();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    io.observe(el);
    const move = (e: PointerEvent) => {
      if (motion.matches || document.documentElement.dataset.energy === 'true') return;
      px = (e.clientX - el.getBoundingClientRect().left) / w;
      start();
    };
    wake.current = start;
    el.addEventListener('pointermove', move);
    window.addEventListener('wave-energy-change', start);
    document.addEventListener('visibilitychange', start);
    motion.addEventListener('change', start);
    resize();
    return () => {
      disposed = true;
      wake.current = () => {};
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointermove', move);
      window.removeEventListener('wave-energy-change', start);
      document.removeEventListener('visibilitychange', start);
      motion.removeEventListener('change', start);
    };
  }, []);
  useEffect(() => wake.current(), [active, ambient, mode]);
  return <canvas className={'visualizer ' + className} ref={canvas} aria-hidden="true" />;
}
export function Equalizer({ playing = false }: { playing?: boolean }) {
  return (
    <span className={'mini-eq ' + (playing ? 'is-playing' : '')} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} style={{ '--i': i } as any} />
      ))}
    </span>
  );
}
export function AmbientVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (!el) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const update = () => {
      if (
        !visible ||
        document.hidden ||
        reduced.matches ||
        document.documentElement.dataset.energy === 'true'
      )
        el.pause();
      else void el.play().catch(() => {});
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      update();
    });
    observer.observe(el);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('wave-energy-change', update);
    reduced.addEventListener('change', update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('wave-energy-change', update);
      reduced.removeEventListener('change', update);
      el.pause();
    };
  }, []);
  return (
    <video
      ref={ref}
      className="hero-vj ambient-video"
      src="./wave-loop.mp4"
      poster="./vj-poster.svg"
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

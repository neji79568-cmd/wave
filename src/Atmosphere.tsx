import { useEffect, useRef } from 'react';
export function Atmosphere() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let x = 0.5;
    let y = 0.3;
    const move = (e: PointerEvent) => {
      if (
        document.documentElement.dataset.energy === 'true' ||
        reduced.matches ||
        e.pointerType === 'touch'
      )
        return;
      x = e.clientX / window.innerWidth;
      y = e.clientY / window.innerHeight;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--pointer-x', `${x * 100}%`);
        el.style.setProperty('--pointer-y', `${y * 100}%`);
        frame = 0;
      });
    };
    document.addEventListener('pointermove', move, { passive: true });
    const visibility = () => el.classList.toggle('is-hidden', document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return (
    <div className="app-atmosphere" ref={ref} aria-hidden="true">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="atmosphere-grid" />
      <div className="atmosphere-stars" />
      {Array.from({ length: 7 }, (_, i) => (
        <span className="orbit-spark" key={i} style={{ '--i': i } as any} />
      ))}
    </div>
  );
}

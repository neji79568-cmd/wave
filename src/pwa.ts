import { useEffect, useRef, useState } from 'react';
export function usePwaUpdates() {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const reloading = useRef(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let disposed = false;
    const change = () => {
      if (reloading.current) location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', change);
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        if (disposed) return;
        registration.current = reg;
        if (reg.waiting) setAvailable(true);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller)
              setAvailable(true);
          });
        });
      })
      .catch(() => {
        if (!disposed) setMessage('Автономный режим недоступен. Открой приложение по HTTPS.');
      });
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', change);
    };
  }, []);
  async function check() {
    if (!registration.current) {
      setMessage('Обновления PWA доступны через HTTPS после первой загрузки.');
      return;
    }
    setChecking(true);
    setMessage('');
    try {
      await registration.current.update();
      setAvailable(!!registration.current.waiting);
      if (!registration.current.waiting)
        setMessage('Проверка завершена. Доступное обновление появится здесь.');
    } catch {
      setMessage('Не удалось проверить обновления. Проверь подключение.');
    } finally {
      setChecking(false);
    }
  }
  function apply() {
    const worker = registration.current?.waiting;
    if (!worker) {
      location.reload();
      return;
    }
    window.dispatchEvent(new Event('wave-before-update'));
    reloading.current = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  }
  return { available, checking, message, check, apply };
}

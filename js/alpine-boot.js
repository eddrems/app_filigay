/**
 * Arranque único de Alpine (un solo import del CDN vía alpine-core.js).
 */
import Alpine from './alpine-core.js';

function showBootError(reason) {
  console.error('[ZAO] Error de arranque:', reason);
  const loading = document.querySelector('[x-show="loading"]');
  if (loading) {
    loading.removeAttribute('x-show');
    loading.textContent =
      'No se pudo cargar la aplicación. Recarga la página o revisa la consola (F12).';
    loading.classList.add('max-w-md', 'px-6', 'text-center', 'text-error');
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => showBootError(e.reason));
}

export function bootAlpine() {
  if (window.__zaoAlpineStarted) return;
  window.__zaoAlpineStarted = true;

  try {
    document.documentElement.classList.add('alpine-ready');
    Alpine.start();
  } catch (err) {
    showBootError(err);
    document.documentElement.classList.add('alpine-ready');
    document.querySelectorAll('[x-cloak]').forEach((el) => el.removeAttribute('x-cloak'));
  }
}

export function scheduleAlpineBoot() {
  const run = () => requestAnimationFrame(bootAlpine);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}

/**
 * Una sola instancia de Alpine (Safari falla con varios imports del CDN en paralelo).
 */
import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.8/dist/module.esm.js';

if (typeof window !== 'undefined') {
  window.Alpine = Alpine;
}

export default Alpine;
export { Alpine };

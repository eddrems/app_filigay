import { supabaseConfig as baseConfig } from './config.js';

let resolvedConfig = { ...baseConfig };

/** Config inyectada en build (Netlify/Vercel): window.ZAO_SUPABASE_CONFIG */
if (typeof window !== 'undefined' && window.ZAO_SUPABASE_CONFIG) {
  resolvedConfig = { ...resolvedConfig, ...window.ZAO_SUPABASE_CONFIG };
}

export const supabaseConfig = resolvedConfig;

/** Opcional en local: crea js/config.local.js (no versionado) */
export async function applyLocalConfig() {
  try {
    const local = await import('./config.local.js');
    if (local?.supabaseConfig) {
      Object.assign(supabaseConfig, local.supabaseConfig);
    }
  } catch {
    /* config.local.js no existe */
  }
}

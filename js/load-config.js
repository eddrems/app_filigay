import { supabaseConfig as baseConfig } from './config.js';

let resolvedConfig = { ...baseConfig };

try {
  const local = await import('./config.local.js');
  if (local?.supabaseConfig) {
    resolvedConfig = { ...resolvedConfig, ...local.supabaseConfig };
  }
} catch {
  /* config.local.js no existe */
}

/** Config inyectada en build (Netlify/Vercel): window.ZAO_SUPABASE_CONFIG */
if (typeof window !== 'undefined' && window.ZAO_SUPABASE_CONFIG) {
  resolvedConfig = { ...resolvedConfig, ...window.ZAO_SUPABASE_CONFIG };
}

export const supabaseConfig = resolvedConfig;

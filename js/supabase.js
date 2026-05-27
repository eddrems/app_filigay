import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabaseConfig } from './config.js';

let client = null;

function normalizeProjectUrl(url) {
  return url.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
}

export function getSupabase() {
  if (!client) {
    const url = normalizeProjectUrl(supabaseConfig.url);
    client = createClient(url, supabaseConfig.anonKey);
  }
  return client;
}

export function isSupabaseConfigured() {
  const { url, anonKey } = supabaseConfig;
  if (!url || !anonKey || url.includes('TU_PROYECTO') || anonKey.includes('TU_ANON_KEY')) {
    return false;
  }
  if (anonKey.startsWith('sb_secret_')) {
    console.warn(
      '[ZAO] Usa la clave anon public (eyJ…) en config.js, no la secret key. Ver docs/SUPABASE.md',
    );
  }
  return true;
}

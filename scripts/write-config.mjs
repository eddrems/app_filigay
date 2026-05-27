#!/usr/bin/env node
/**
 * Genera js/config.js desde variables de entorno (Netlify/Vercel).
 * SUPABASE_URL y SUPABASE_ANON_KEY en el panel del hosting.
 */
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  if (existsSync(join(root, 'js/config.js'))) {
    console.log('write-config: sin env vars, se mantiene js/config.js existente');
    process.exit(0);
  }
  console.warn('write-config: faltan SUPABASE_URL o SUPABASE_ANON_KEY');
  process.exit(0);
}

const content = `/** Generado en deploy — no editar a mano en CI */
export const supabaseConfig = {
  url: '${url.replace(/'/g, "\\'")}',
  anonKey: '${anonKey.replace(/'/g, "\\'")}',
};
`;

writeFileSync(join(root, 'js/config.js'), content, 'utf8');
console.log('write-config: js/config.js actualizado');

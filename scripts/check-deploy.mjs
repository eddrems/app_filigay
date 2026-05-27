#!/usr/bin/env node
/**
 * Comprueba que existan los archivos JS críticos antes de subir al servidor.
 * Uso: node scripts/check-deploy.mjs
 */
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

const required = [
  'js/alpine-core.js',
  'js/alpine-boot.js',
  'js/init-index.js',
  'js/init-admin.js',
  'js/init-docente.js',
  'js/init-estudiante.js',
  'js/init-estudiante-curso.js',
  'js/init-cuaderno-curso.js',
  'js/init-actualizar-perfil.js',
  'js/config.js',
  'js/layout.js',
  'js/supabase.js',
  'js/load-config.js',
];

let missing = 0;
for (const file of required) {
  try {
    await access(file, constants.R_OK);
    console.log('OK', file);
  } catch {
    console.error('FALTA', file);
    missing += 1;
  }
}

if (missing) {
  console.error(`\n${missing} archivo(s) faltante(s). No subas un deploy parcial.`);
  process.exit(1);
}

console.log('\nListo para deploy (carpeta js/ completa).');

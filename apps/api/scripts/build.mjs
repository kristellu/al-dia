#!/usr/bin/env node
// Arma apps/api/dist para Cloudflare Pages:
//  1. Copia los estáticos de @al-dia/web (la estrategia v2 de root directory exige que la salida
//     esté dentro de apps/api).
//  2. Compila functions/ a dist/_worker.js ("advanced mode"), porque el build de Pages no detecta
//     la carpeta functions/ cuando el Root directory es apps/api. _routes.json limita el Worker a /api/*.
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const apiDir = fileURLToPath(new URL('..', import.meta.url));
const src = fileURLToPath(new URL('../../web/public', import.meta.url));
const out = fileURLToPath(new URL('../dist', import.meta.url));

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });
console.log(`Estáticos copiados: ${src} → ${out}`);

execFileSync(
  'npx',
  ['wrangler', 'pages', 'functions', 'build', '--outdir', 'dist/_worker.js', '--output-routes-path', 'dist/_routes.json'],
  { cwd: apiDir, stdio: 'inherit' }
);
console.log('Functions compiladas en dist/_worker.js');

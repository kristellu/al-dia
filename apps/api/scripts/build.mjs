#!/usr/bin/env node
// Copia los estáticos de @al-dia/web a apps/api/dist. Cloudflare Pages (v2 root directory)
// exige que el directorio de salida esté dentro del Root directory (apps/api).
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../web/public', import.meta.url));
const out = fileURLToPath(new URL('../dist', import.meta.url));

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });
console.log(`Estáticos copiados: ${src} → ${out}`);

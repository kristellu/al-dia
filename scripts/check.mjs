// Verificación de sintaxis de todo el JavaScript del proyecto (usada en CI)
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const roots = ['public/app.js', 'functions', 'src', 'scripts'];
const files = [];
const walk = (p) => statSync(p).isDirectory() ? readdirSync(p).forEach((f) => walk(join(p, f))) : /\.m?js$/.test(p) && files.push(p);
roots.forEach(walk);
for (const f of files) execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });
console.log(`Sintaxis correcta en ${files.length} archivos.`);

// Verificaciones rápidas sin dependencias (usadas en CI):
//   1. Sintaxis de todo el JavaScript del monorepo.
//   2. Importaciones relativas del frontend: el archivo existe y exporta los nombres pedidos.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const roots = ['apps/web/public/js', 'apps/api/functions', 'apps/api/src', 'apps/api/scripts', 'scripts'];
const files = [];
const walk = (p) => statSync(p).isDirectory() ? readdirSync(p).forEach((f) => walk(join(p, f))) : /\.m?js$/.test(p) && files.push(p);
roots.forEach(walk);
for (const f of files) execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });
console.log(`Sintaxis correcta en ${files.length} archivos.`);

const exportsOf = (file) => {
  const src = readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+(?:const|let|var)\s+[\w$]+\s*=[^;\n]*?,\s*([\w$]+)\s*=/gm)) names.add(m[1]);
  return names;
};
const problems = [];
const webFiles = files.filter((f) => f.startsWith('apps/web/'));
for (const f of webFiles) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';/gm)) {
    const target = resolve(dirname(f), m[2]);
    if (!m[2].startsWith('.') || !m[2].endsWith('.js')) { problems.push(`${f}: la ruta '${m[2]}' debe ser relativa y terminar en .js`); continue; }
    if (!existsSync(target)) { problems.push(`${f}: no existe '${m[2]}'`); continue; }
    const available = exportsOf(target);
    for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!available.has(name)) problems.push(`${f}: '${m[2]}' no exporta '${name}'`);
    }
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Importaciones correctas en ${webFiles.length} módulos del frontend.`);

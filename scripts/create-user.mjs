#!/usr/bin/env node
// Crea o restablece un usuario directamente en D1. Úsalo para el primer administrador.
//   npm run user:create -- --username kristell --name "Kristell" --role admin
//   npm run user:create:local -- --username prueba --name "Prueba"
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline';
import { hashPassword, passwordProblem } from '../src/lib/password.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, [])
);
const DB_NAME = args.db || 'al-dia';
const target = args.local ? '--local' : '--remote';
const username = String(args.username || '').trim().toLowerCase();
const name = String(args.name || username).trim();
const role = args.role === 'admin' ? 'admin' : 'user';
const retention = Math.min(24, Math.max(1, Number(args.retention || 4)));

if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error('Uso: npm run user:create -- --username <usuario> --name "<Nombre>" [--role admin] [--retention 4] [--local]');
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (!rl.muted) rl.output.write(s); };
    rl.question(question, (v) => { rl.close(); process.stdout.write('\n'); resolve(v); });
    rl.muted = true;
  });
}

const pw = process.env.AL_DIA_PASSWORD || (await askHidden(`Contraseña para ${username}: `));
const problem = passwordProblem(pw);
if (problem) { console.error(problem); process.exit(1); }
if (!process.env.AL_DIA_PASSWORD) {
  const again = await askHidden('Repítela: ');
  if (again !== pw) { console.error('Las contraseñas no coinciden.'); process.exit(1); }
}

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const hash = await hashPassword(pw);
const sql = `INSERT INTO users (id, username, display_name, password_hash, role, retention_months, must_change_password)
VALUES (${q(crypto.randomUUID())}, ${q(username)}, ${q(name)}, ${q(hash)}, ${q(role)}, ${retention}, 0)
ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, display_name = excluded.display_name,
  role = excluded.role, retention_months = excluded.retention_months, active = 1, failed_attempts = 0,
  locked_until = NULL, must_change_password = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`;

const dir = mkdtempSync(join(tmpdir(), 'al-dia-'));
const file = join(dir, 'user.sql');
writeFileSync(file, sql);
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', DB_NAME, target, '--file', file, '--yes'], { stdio: 'inherit' });
  console.log(`\nUsuario "${username}" listo (${role}, ${retention} meses de retención, ${target === '--local' ? 'base local' : 'base remota'}).`);
} finally {
  unlinkSync(file);
}

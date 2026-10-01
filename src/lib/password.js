// Hash de contraseñas con PBKDF2-SHA256 (WebCrypto). Funciona en Workers y en Node 20+.
// 60.000 iteraciones: equilibrio entre seguridad y el límite de CPU del plan gratuito de Workers.
// El número de iteraciones queda guardado en cada hash, así que se puede subir después sin migrar.
export const PBKDF2_ITERATIONS = 60_000;
const enc = new TextEncoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 100_000) return false;
  const actual = await derive(password, fromB64(parts[2]), iterations);
  const expected = fromB64(parts[3]);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function passwordProblem(password) {
  const p = String(password || '');
  if (p.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (p.length > 200) return 'La contraseña es demasiado larga.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'La contraseña debe combinar letras y números.';
  return null;
}

// Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe
let dummy;
export const dummyHash = () => (dummy ??= hashPassword('usuario-inexistente-0'));

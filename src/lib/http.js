// Respuestas JSON y lectura segura del cuerpo de la solicitud
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function error(status, message, headers = {}) {
  return json({ error: message }, status, headers);
}

export async function readJson(request, maxBytes = 64_000) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > maxBytes) return null;
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Minimal, private visitor log for a static site (seongwoolee.com).
//
// Two routes:
//   POST /log   - beacon endpoint called from every page load; records the
//                 visitor's IP, Cloudflare's own free ASN-org lookup
//                 (request.cf.asOrganization - this is how "which company"
//                 gets answered, no external API needed), country/city,
//                 path, referrer, and user-agent into KV.
//   GET  /view  - a private HTML table of the most recent visits, gated by a
//                 secret query token (?key=...) checked against the
//                 VIEW_TOKEN secret. Wrong/missing token -> plain 404, so
//                 there's nothing to distinguish "wrong token" from "route
//                 doesn't exist" to a stranger probing the URL.
//
// Storage: a single KV namespace (VISITS binding, see wrangler.toml). Keys
// are "<ISO timestamp>-<random>" so KV's own lexicographic key order is
// chronological - list() + reverse() gives newest-first without needing a
// real database.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function handleLog(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body = {};
  try { body = await request.json(); } catch (e) {}

  const cf = request.cf || {};
  const entry = {
    ts: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") || "",
    org: cf.asOrganization || "",
    asn: cf.asn || "",
    country: cf.country || "",
    city: cf.city || "",
    path: typeof body.path === "string" ? body.path.slice(0, 300) : "",
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 300) : "",
    ua: (request.headers.get("user-agent") || "").slice(0, 300),
  };

  const key = `${entry.ts}-${crypto.randomUUID().slice(0, 8)}`;
  await env.VISITS.put(key, JSON.stringify(entry), {
    expirationTtl: 60 * 60 * 24 * 180, // 180 days - keeps the free KV tier tidy
  });

  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function handleView(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!env.VIEW_TOKEN || key !== env.VIEW_TOKEN) {
    return new Response("Not found", { status: 404 });
  }

  const limit = Math.min(parseInt(url.searchParams.get("n") || "300", 10) || 300, 1000);
  const list = await env.VISITS.list({ limit: 1000 });
  const keys = list.keys.map((k) => k.name).sort().reverse().slice(0, limit);
  const entries = await Promise.all(keys.map((k) => env.VISITS.get(k, "json")));

  const rows = entries.filter(Boolean).map((e) => `
    <tr>
      <td>${esc(e.ts.replace("T", " ").replace(/\.\d+Z$/, "Z"))}</td>
      <td>${esc(e.org) || "&mdash;"}</td>
      <td>${esc(e.ip)}</td>
      <td>${esc(e.country)}${e.city ? " / " + esc(e.city) : ""}</td>
      <td>${esc(e.path)}</td>
      <td>${esc(e.referrer)}</td>
    </tr>`).join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Visitor log</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 2rem; background: #111; color: #eee; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: .4rem .6rem; border-bottom: 1px solid #333; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 22ch; }
  th { position: sticky; top: 0; background: #111; }
  tr:hover { background: #1c1c1c; }
</style></head>
<body>
<h1>Visitor log (last ${entries.length})</h1>
<table>
<thead><tr><th>Time (UTC)</th><th>Org</th><th>IP</th><th>Country/City</th><th>Path</th><th>Referrer</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/log") return handleLog(request, env);
    if (url.pathname === "/view") return handleView(request, env);
    return new Response("Not found", { status: 404 });
  },
};

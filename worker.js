// Wendy Coach - Cloudflare Worker with KV Storage
// Only handles /api/* routes, static assets served automatically

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Only handle API routes
    if (path.startsWith('/api/')) {
      return handleAPI(request, env, path);
    }

    // All other requests → serve static assets
    return env.ASSETS.fetch(request);
  }
};

async function handleAPI(request, env, path) {
  const userKey = 'wendy';

  try {
    // GET /api/data/:type
    if (request.method === 'GET' && path.startsWith('/api/data/')) {
      const dataType = path.replace('/api/data/', '');
      const value = await env.COACH_DATA.get(`${userKey}:${dataType}`);
      return jsonResponse({ data: value ? JSON.parse(value) : null });
    }

    // POST /api/data/:type
    if (request.method === 'POST' && path.startsWith('/api/data/')) {
      const dataType = path.replace('/api/data/', '');
      const body = await request.json();
      await env.COACH_DATA.put(`${userKey}:${dataType}`, JSON.stringify(body.data));
      return jsonResponse({ success: true });
    }

    // GET /api/sync
    if (request.method === 'GET' && path === '/api/sync') {
      const [log, diary, reviews] = await Promise.all([
        env.COACH_DATA.get(`${userKey}:training_log`),
        env.COACH_DATA.get(`${userKey}:diary`),
        env.COACH_DATA.get(`${userKey}:reviews`),
      ]);
      return jsonResponse({
        training_log: log ? JSON.parse(log) : [],
        diary: diary ? JSON.parse(diary) : {},
        reviews: reviews ? JSON.parse(reviews) : [],
      });
    }

    // POST /api/sync
    if (request.method === 'POST' && path === '/api/sync') {
      const body = await request.json();
      const ops = [];
      if (body.training_log !== undefined)
        ops.push(env.COACH_DATA.put(`${userKey}:training_log`, JSON.stringify(body.training_log)));
      if (body.diary !== undefined)
        ops.push(env.COACH_DATA.put(`${userKey}:diary`, JSON.stringify(body.diary)));
      if (body.reviews !== undefined)
        ops.push(env.COACH_DATA.put(`${userKey}:reviews`, JSON.stringify(body.reviews)));
      await Promise.all(ops);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Not found' }, 404);

  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

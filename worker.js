// Wendy Coach - Cloudflare Worker with KV Storage
// Handles data sync across all devices

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-User-Key',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Serve static HTML app
    if (path === '/' || path === '/index.html') {
      const asset = await env.ASSETS.fetch(request);
      return asset;
    }

    // API routes for KV data
    if (path.startsWith('/api/')) {
      return handleAPI(request, env, path);
    }

    // All other static assets
    return env.ASSETS.fetch(request);
  }
};

async function handleAPI(request, env, path) {
  const userKey = 'wendy'; // Single user app
  
  try {
    // GET /api/data/:type - read data
    if (request.method === 'GET' && path.startsWith('/api/data/')) {
      const dataType = path.replace('/api/data/', '');
      const value = await env.COACH_DATA.get(`${userKey}:${dataType}`);
      return jsonResponse({ data: value ? JSON.parse(value) : null });
    }

    // POST /api/data/:type - write data
    if (request.method === 'POST' && path.startsWith('/api/data/')) {
      const dataType = path.replace('/api/data/', '');
      const body = await request.json();
      await env.COACH_DATA.put(`${userKey}:${dataType}`, JSON.stringify(body.data));
      return jsonResponse({ success: true });
    }

    // DELETE /api/data/:type - delete data
    if (request.method === 'DELETE' && path.startsWith('/api/data/')) {
      const dataType = path.replace('/api/data/', '');
      await env.COACH_DATA.delete(`${userKey}:${dataType}`);
      return jsonResponse({ success: true });
    }

    // GET /api/sync - get all data at once
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

    // POST /api/sync - save all data at once
    if (request.method === 'POST' && path === '/api/sync') {
      const body = await request.json();
      await Promise.all([
        body.training_log !== undefined && env.COACH_DATA.put(`${userKey}:training_log`, JSON.stringify(body.training_log)),
        body.diary !== undefined && env.COACH_DATA.put(`${userKey}:diary`, JSON.stringify(body.diary)),
        body.reviews !== undefined && env.COACH_DATA.put(`${userKey}:reviews`, JSON.stringify(body.reviews)),
      ]);
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

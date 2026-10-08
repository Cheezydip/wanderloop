export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Backend base URL (configured via BACKEND_URL in Cloudflare Pages or fallback)
  const backendBase = (context.env.BACKEND_URL || 'https://wanderloop-backend.onrender.com').replace(/\/$/, '');
  const targetUrl = `${backendBase}${url.pathname}${url.search}`;

  const requestHeaders = new Headers(context.request.headers);
  try {
    const backendHost = new URL(backendBase).host;
    requestHeaders.set('host', backendHost);
  } catch (e) {
    // Ignore invalid URL parsing for host header
  }

  const init = {
    method: context.request.method,
    headers: requestHeaders,
    redirect: 'follow',
  };

  // Only attach body for non-GET / non-HEAD requests
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    init.body = context.request.body;
  }

  try {
    const response = await fetch(targetUrl, init);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Backend unreachable', details: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

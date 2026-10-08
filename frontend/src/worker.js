export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy API calls directly to Render backend
    if (url.pathname.startsWith('/api')) {
      const backendBase = (env.BACKEND_URL || 'https://wanderloop-backend.onrender.com').replace(/\/$/, '');
      const targetUrl = `${backendBase}${url.pathname}${url.search}`;

      const newHeaders = new Headers(request.headers);
      try {
        newHeaders.set('host', new URL(backendBase).host);
      } catch (e) {
        // ignore url parsing error
      }

      const init = {
        method: request.method,
        headers: newHeaders,
        redirect: 'follow',
      };

      if (!['GET', 'HEAD'].includes(request.method)) {
        init.body = request.body;
      }

      try {
        return await fetch(targetUrl, init);
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Backend unreachable', details: err.message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Serve static Vite SPA assets from the ASSETS binding
    return env.ASSETS.fetch(request);
  },
};

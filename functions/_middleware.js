// Pages edge middleware: canonical-host redirects.
// Runs on EVERY host this project is served from (elmtree.app, www.elmtree.app,
// *.elmtree.pages.dev). Redirects the non-canonical hosts to the apex (https://elmtree.app)
// so links always land on one clean origin. Uses 301 (moved permanently).
const APEX = 'elmtree.app';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  let host = url.hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);

  const isApex = host === APEX;
  const isWww = /^www\.[^.]+\.[^.]+$/.test(host);
  const isPagesDev = /\belmtree\.pages\.dev$/.test(host);

  if (!isApex && (isWww || isPagesDev)) {
    return new Response('', {
      status: 301,
      headers: { Location: `https://${APEX}${url.pathname}${url.search}`, 'Cache-Control': 'no-store' },
    });
  }

  // pass through to the site
  return next();
}
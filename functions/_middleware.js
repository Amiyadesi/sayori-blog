// Legacy standalone entry is retired; the settings control enters the blog itself.
export async function onRequest(context) {
 const url = new URL(context.request.url);
 if (/^\/(?:en\/|zh-hant\/)?(?:project-34|p34-record)\/?$/.test(url.pathname) && url.searchParams.get('paper') !== '0617') {
  url.pathname = url.pathname.replace(/(?:project-34|p34-record)\/?$/, '');
  url.search = '?paper=0617';
  url.hash = '';
  return new Response(null, {status:302,headers:{Location:url.href,'Cache-Control':'no-store'}});
 }
 const response = await context.next();
 if (!response.headers.get('Content-Type')?.startsWith('text/html')) return response;
 // Keep domain-level Cloudflare HTML transforms from injecting a second tracker.
 const html = new Response(response.body, response);
 html.headers.append('Cache-Control', 'no-transform');
 return compress(context.request, html);
}

// no-transform also stops Cloudflare compressing the page, so the page is compressed here.
function compress(request, html) {
 html.headers.append('Vary', 'Accept-Encoding');
 // On Cloudflare the Accept-Encoding header is rewritten; cf.clientAcceptEncoding is what the reader sent.
 const accepted = request.cf ? request.cf.clientAcceptEncoding : request.headers.get('Accept-Encoding');
 // The largest page is under 200 KB (about 3 ms to gzip); a far larger one is sent as is to stay within the CPU limit.
 const tooLarge = Number(html.headers.get('Content-Length')) > 400_000;
 if (request.method !== 'GET' || html.status !== 200 || !html.body || tooLarge || html.headers.has('Content-Encoding') || !acceptsGzip(accepted)) return html;
 const headers = new Headers(html.headers);
 headers.set('Content-Encoding', 'gzip');
 headers.delete('Content-Length');
 const etag = headers.get('ETag');
 if (etag && !etag.startsWith('W/')) headers.set('ETag', `W/${etag}`);
 return new Response(html.body.pipeThrough(new CompressionStream('gzip')), {status:200,headers,encodeBody:'manual'});
}

function acceptsGzip(header) {
 return (header || '').toLowerCase().split(',').some((part) => {
  const [coding, ...params] = part.trim().split(/\s*;\s*/);
  const q = params.find((param) => param.startsWith('q='));
  return coding === 'gzip' && (!q || Number(q.slice(2)) > 0);
 });
}

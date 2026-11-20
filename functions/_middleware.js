// Legacy standalone entry is retired; the settings control enters the blog itself.
export async function onRequest(context) {
 const url = new URL(context.request.url);
 if (/^\/(?:en\/|zh-hant\/)?(?:project-34|p34-record)\/?$/.test(url.pathname) && url.searchParams.get('paper') !== '0617') {
  url.pathname = url.pathname.replace(/(?:project-34|p34-record)\/?$/, '');
  url.search = '?paper=0617';
  url.hash = '';
  return new Response(null, {status:302,headers:{Location:url.href,'Cache-Control':'no-store'}});
 }
 return context.next();
}

(() => {
  if (new URLSearchParams(location.search).get('paper') !== '0617') return;
  const root = document.documentElement;
  const previous = document.referrer ? new URL(document.referrer) : null;
  root.dataset.p34FromDesk = String(previous?.origin === location.origin && previous.searchParams.get('paper') !== '0617' && !history.state?.p34Space);
  let dark = false;
  const saved = document.cookie.split('; ').find(row => row.startsWith('p34_journey_v2='));
  if (saved) {
    try { dark = ['closed', 'found'].includes(JSON.parse(decodeURIComponent(saved.slice(saved.indexOf('=') + 1))).phase); }
    catch (error) { console.warn('Cannot read the entry colour; the journey loader will report the save error', error); }
  }
  root.style.setProperty('--p34-entry-color', dark ? '#08090a' : '#294b7a');
  const style = document.createElement('style');
  style.textContent = 'html.p34-loading{background:var(--p34-entry-color)!important;color-scheme:dark}html.p34-loading body{visibility:hidden!important;background:transparent!important}';
  document.head.append(style);
  root.classList.add('p34-loading');
  window.addEventListener('p34:entry-error', () => {
    root.classList.remove('p34-loading');
    const notice = document.createElement('p');
    notice.setAttribute('role', 'alert');
    notice.textContent = '她的空间没能打开，请刷新重试。原网页仍可使用。';
    document.body.prepend(notice);
  });
})();

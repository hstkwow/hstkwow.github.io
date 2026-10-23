// MathJax (2 MB) is loaded only for notes that contain math, and never blocks the text.
const SRC = new URL('../../vendor/tex-svg.js', import.meta.url).href;
let loading = null;

export function loadMath() {
  if (loading) return loading;
  window.MathJax = {
    tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], processEscapes: true },
    options: { ignoreHtmlClass: '.*', processHtmlClass: 'arithmatex' },
    svg: { fontCache: 'local' },
    startup: { typeset: false },
  };
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.onload = () => window.MathJax.startup.promise.then(resolve, reject);
    script.onerror = () => { loading = null; script.remove(); reject(new Error('MathJax failed to load')); };
    document.head.append(script);
  });
  return loading;
}

// Warm the HTTP cache while the reader is still browsing the collection.
export function prefetchMath() {
  const net = navigator.connection;
  if (net && (net.saveData || /2g/.test(net.effectiveType))) return;
  if (loading || document.querySelector(`link[href="${SRC}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = SRC;
  link.as = 'script';
  document.head.append(link);
}

export async function typeset(element) {
  await loadMath();
  await window.MathJax.typesetPromise([element]);
}
export function clearMath(element) { window.MathJax?.typesetClear?.([element]); }

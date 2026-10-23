// Small DOM helpers shared by every page module.
export const $ = id => document.getElementById(id);
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Run low-priority work once the main thread is quiet.
export const idle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600));

// Shared initialization for Home, Projects and Reading.
window.Site = { escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); } };
(function(){

const themeButton=document.getElementById('theme');
function setTheme(dark){document.documentElement.classList.toggle('dark',dark);themeButton.textContent=dark?'Light ◑':'Dark ◐';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');}
setTheme(true);
themeButton.addEventListener('click',()=>{const dark=!document.documentElement.classList.contains('dark');setTheme(dark);});

})();
window.MathJax={tex:{inlineMath:[["\\(","\\)"]],displayMath:[["\\[","\\]"]],processEscapes:true},options:{ignoreHtmlClass:".*",processHtmlClass:"arithmatex"},svg:{fontCache:"local"},startup:{typeset:false}};
// Show the current page and entry in the compact masthead after its introduction scrolls away.
(() => {
  const masthead = document.querySelector('.masthead');
  if (!masthead) return;
  const current = document.createElement('span');
  current.className = 'nav-context';
  current.setAttribute('aria-hidden', 'true');
  masthead.insertBefore(current, masthead.querySelector('nav'));
  const filename = location.pathname.split('/').pop();
  const page = filename === 'papers.html' ? 'Reading' : filename === 'projects.html' ? 'Projects' : 'Home';
  const marker = document.querySelector('.reading-banner') || document.querySelector('.reading-head') || document.querySelector('main > header');
  let scheduled = false;
  function update() {
    scheduled = false;
    const entry = document.querySelector('#detail .paper-title')?.textContent.trim();
    const label = page + ' / ' + (entry || (page === 'Home' ? 'Sun Tao' : page));
    if (current.textContent !== label) { current.textContent = label; current.title = label; }
    const passed = marker ? marker.getBoundingClientRect().bottom <= masthead.getBoundingClientRect().bottom : window.scrollY > 160;
    current.classList.toggle('visible', passed && window.scrollY > 32);
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  const detail = document.getElementById('detail');
  if (detail) new MutationObserver(schedule).observe(detail, { childList: true, subtree: true });
  update();
})();

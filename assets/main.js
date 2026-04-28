/* Midnight Dejavu — shared interactions */
(function(){
  // Nav scrolled state
  const nav = document.getElementById('nav');
  if(nav){
    // pages with .hero (full hero) get transparent->solid behavior
    // pages with .nav.solid keep solid look from start
    if(!nav.classList.contains('solid')){
      const setNav = () => nav.classList.toggle('scrolled', window.scrollY > 40);
      window.addEventListener('scroll', setNav, {passive:true});
      setNav();
    }
  }

  // Mobile burger
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  if(burger && menu){
    const close = () => { menu.classList.remove('open'); burger.classList.remove('open'); };
    burger.addEventListener('click', (e)=>{
      e.stopPropagation();
      menu.classList.toggle('open');
      burger.classList.toggle('open');
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
    // close when tapping outside
    document.addEventListener('click', (e)=>{
      if(!menu.classList.contains('open')) return;
      if(menu.contains(e.target) || burger.contains(e.target)) return;
      close();
    });
    // close on escape
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); });
  }

  // Active link tracker (only for index-style pages with multiple sections)
  if(menu && document.body.dataset.activeTracking === 'scroll'){
    const links = menu.querySelectorAll('a[data-section]');
    const sectionIds = [...links].map(a => a.dataset.section);
    const sections = sectionIds
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .sort((a,b)=> a.offsetTop - b.offsetTop);
    const setActive = () => {
      const y = window.scrollY + window.innerHeight*0.35;
      let current = sections[0]?.id;
      sections.forEach(s => { if (s.offsetTop <= y) current = s.id; });
      links.forEach(a => a.classList.toggle('active', a.dataset.section === current));
    };
    window.addEventListener('scroll', setActive, {passive:true});
    setActive();
  }

  // Reveal on scroll
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, {threshold:0.14, rootMargin:'0px 0px -60px 0px'});
  document.querySelectorAll('.reveal, .reveal-stagger').forEach(el=> io.observe(el));

  // ============ LIGHTBOX ============
  // Opens any background-image photo at original size on click.
  // Disabled on the index page (cards there navigate to detail pages instead).
  (function initLightbox(){
    const filename = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const isIndex = filename === '' || filename === 'index.html';
    if (isIndex) return;

    // Element types that hold photos (excludes navigation cards like .card / .travel-card / .luxury-item)
    const selectors = [
      '.gallery > div',
      '.zone-grid-5 > div',
      '.zone-pair > div',
      '.zone-quad > div',
      '.zone-feature',
      '.zone-cap .img',
      '.zone-cap-full .img',
      '.detail-feature',
      '.hero-img'
    ].join(',');

    // Collect unique photo srcs from inline background-image
    const photos = [];
    const srcToIdx = new Map();
    document.querySelectorAll(selectors).forEach(el => {
      const bg = el.style.backgroundImage || '';
      const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (!m || !m[1]) return; // skip placeholders without an image
      const src = m[1];
      let idx;
      if (srcToIdx.has(src)) {
        idx = srcToIdx.get(src);
      } else {
        idx = photos.length;
        photos.push(src);
        srcToIdx.set(src, idx);
      }
      el.classList.add('lightbox-trigger');
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openAt(idx);
      });
    });

    if (photos.length === 0) return;

    // Build lightbox DOM
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '' +
      '<span class="lightbox-counter"></span>' +
      '<button class="lightbox-prev" aria-label="previous">‹</button>' +
      '<img alt="" />' +
      '<button class="lightbox-next" aria-label="next">›</button>' +
      '<button class="lightbox-close" aria-label="close">×</button>';
    document.body.appendChild(lb);

    const img = lb.querySelector('img');
    const counter = lb.querySelector('.lightbox-counter');
    const closeBtn = lb.querySelector('.lightbox-close');
    const prevBtn = lb.querySelector('.lightbox-prev');
    const nextBtn = lb.querySelector('.lightbox-next');

    let cur = 0;
    const pad = n => String(n).padStart(2, '0');

    const setSrc = (src) => {
      img.classList.add('swapping');
      // small delay so the fade is visible between swaps
      setTimeout(() => {
        img.src = src;
        img.onload = () => img.classList.remove('swapping');
      }, 120);
    };

    const openAt = (idx) => {
      cur = idx;
      img.src = photos[idx];
      counter.textContent = pad(idx + 1) + ' / ' + pad(photos.length);
      const showArrows = photos.length > 1;
      prevBtn.style.display = showArrows ? '' : 'none';
      nextBtn.style.display = showArrows ? '' : 'none';
      requestAnimationFrame(() => lb.classList.add('open'));
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      lb.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => { img.removeAttribute('src'); }, 400);
    };
    const next = () => { cur = (cur + 1) % photos.length; counter.textContent = pad(cur+1)+' / '+pad(photos.length); setSrc(photos[cur]); };
    const prev = () => { cur = (cur - 1 + photos.length) % photos.length; counter.textContent = pad(cur+1)+' / '+pad(photos.length); setSrc(photos[cur]); };

    // backdrop click closes; clicks on inner content do not
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    img.addEventListener('click', (e) => e.stopPropagation());
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); next(); });

    // keyboard
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    });
  })();
})();

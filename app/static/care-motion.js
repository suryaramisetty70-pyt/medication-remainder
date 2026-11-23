(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const hero = document.querySelector('.care-hero');
  if (!hero || reduced.matches) return;
  if (fine.matches) {
    let frame = 0;
    hero.addEventListener('pointermove', e => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (e.clientX-r.left)/r.width*2-1));
        const y = Math.max(-1, Math.min(1, (e.clientY-r.top)/r.height*2-1));
        hero.style.setProperty('--rx', `${-y*10}deg`);
        hero.style.setProperty('--ry', `${x*13}deg`);
        hero.style.setProperty('--mx', `${x*16}px`);
        hero.style.setProperty('--my', `${y*13}px`);
        hero.style.setProperty('--glow-x', `${(x+1)*50}%`);
        hero.style.setProperty('--glow-y', `${(y+1)*50}%`);
      });
    });
    hero.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      for (const key of ['--rx','--ry','--mx','--my','--glow-x','--glow-y']) hero.style.removeProperty(key);
    });
    document.querySelectorAll('.feature-grid > div,.dashboard-stats > div').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--card-rx', `${(0.5-(e.clientY-r.top)/r.height)*12}deg`);
        card.style.setProperty('--card-ry', `${((e.clientX-r.left)/r.width-0.5)*14}deg`);
        card.classList.add('pointer-tilt');
      });
      card.addEventListener('pointerleave', () => card.classList.remove('pointer-tilt'));
    });
  }
  if ('IntersectionObserver' in window) {
    const items = document.querySelectorAll('.feature-grid > div,.motion-story');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
      });
    }, {threshold:0.08});
    items.forEach(item => {item.classList.add('reveal-item');observer.observe(item);});
    document.documentElement.classList.add('motion-ready');
  }
})();

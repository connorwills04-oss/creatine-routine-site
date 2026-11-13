/**
 * Home hero: "the line". One CSS variable --s (0..1) on [data-hero] places the amber line and the night panel.
 *   load: wipe 1 -> 0.5 (1.2s, wipe ease)
 *   desktop (hover + fine pointer): line follows pointer x with lag (lerp 0.12), eases back to 0.5 on leave
 *   touch: drag the 44px handle (pointer events, touch-action: pan-y)
 *   scroll: hero pins, sFinal = sInteractive * (1 - p); at p = 1 the hero is fully night
 *   keyboard: handle is role="slider" (arrow keys, Home/End, PageUp/PageDown)
 *   reduced motion: static 0.5, no pin, no pointer follow (keyboard and drag still set the position instantly)
 */
import { gsap, ScrollTrigger, EASE, onMotionCleanup, prefersReducedMotion } from '../motion';

const EDGE = 22; // px reserved each side of the track, must match the CSS calc

function lineClear(): Promise<void> {
  const busy = (window as unknown as { __pageLine?: { busy: boolean } }).__pageLine?.busy;
  if (!busy) return Promise.resolve();
  return new Promise((res) => {
    const done = () => { document.removeEventListener('line:revealing', done); res(); };
    document.addEventListener('line:revealing', done);
    window.setTimeout(done, 1500);
  });
}

async function initHero(): Promise<void> {
  await Promise.resolve(); // run after motion.ts initMotion() (which tears down earlier cleanups)
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const handle = hero?.querySelector<HTMLElement>('[data-hero-handle]');
  if (!hero || !handle || hero.dataset.bound === '1') return;
  hero.dataset.bound = '1';

  const reduced = prefersReducedMotion();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const st = { s: reduced ? 0.5 : 1, target: 0.5, p: 0, wiping: !reduced, dragging: false };
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const track = () => Math.max(1, hero.clientWidth - EDGE * 2);

  const render = () => {
    const sf = st.s * (1 - st.p);
    // at p = 1 the panel edge reaches x = 0 so the hero is fully night
    const css = sf - (st.p * EDGE) / track();
    hero.style.setProperty('--s', css.toFixed(5));
    handle.setAttribute('aria-valuenow', String(Math.round(st.s * 100)));
  };
  const xToS = (clientX: number) => clamp((clientX - hero.getBoundingClientRect().left - EDGE) / track());

  render();

  let wipe: gsap.core.Tween | null = null;
  const stopWipe = () => { if (wipe) { wipe.kill(); wipe = null; } st.wiping = false; };

  if (!reduced) {
    lineClear().then(() => {
      if (!hero.isConnected || hero.dataset.bound !== '1' || !st.wiping) return;
      wipe = gsap.to(st, {
        s: 0.5, duration: 1.2, ease: EASE.wipe, onUpdate: render,
        onComplete: () => { st.wiping = false; wipe = null; },
      });
    });
  }

  // desktop: lagged follow
  const tick = () => {
    if (reduced || st.wiping || st.dragging) return;
    const d = st.target - st.s;
    if (Math.abs(d) > 0.0004) { st.s += d * 0.12; render(); }
    else if (st.s !== st.target) { st.s = st.target; render(); }
  };
  const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') st.target = xToS(e.clientX); };
  const onLeave = (e: PointerEvent) => { if (e.pointerType === 'mouse') st.target = 0.5; };
  if (!reduced && fine) {
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    gsap.ticker.add(tick);
  }

  // touch / pen drag
  let grab = 0;
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && fine) return;
    stopWipe();
    st.dragging = true;
    handle.setPointerCapture(e.pointerId);
    grab = EDGE + track() * st.s + hero.getBoundingClientRect().left - e.clientX;
  };
  const onDrag = (e: PointerEvent) => {
    if (!st.dragging) return;
    st.s = st.target = xToS(e.clientX + grab);
    render();
  };
  const onUp = (e: PointerEvent) => {
    if (!st.dragging) return;
    st.dragging = false;
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
  };
  handle.addEventListener('pointerdown', onDown);
  handle.addEventListener('pointermove', onDrag);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);

  // keyboard
  const onKey = (e: KeyboardEvent) => {
    const step = 0.05;
    let v: number | null = null;
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': v = st.s - step; break;
      case 'ArrowRight': case 'ArrowUp': v = st.s + step; break;
      case 'PageDown': v = st.s - 0.2; break;
      case 'PageUp': v = st.s + 0.2; break;
      case 'Home': v = 0; break;
      case 'End': v = 1; break;
    }
    if (v === null) return;
    e.preventDefault();
    stopWipe();
    st.s = st.target = clamp(v);
    render();
  };
  handle.addEventListener('keydown', onKey);

  // scroll: pin and sweep to night
  if (!reduced) {
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: () => '+=' + Math.round(window.innerHeight * 0.9),
      pin: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => { st.p = self.progress; render(); },
      onRefresh: (self) => { st.p = self.progress; render(); },
    });
  }
  const onResize = () => render();
  window.addEventListener('resize', onResize);

  onMotionCleanup(() => {
    stopWipe();
    gsap.ticker.remove(tick);
    hero.removeEventListener('pointermove', onMove);
    hero.removeEventListener('pointerleave', onLeave);
    handle.removeEventListener('pointerdown', onDown);
    handle.removeEventListener('pointermove', onDrag);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onUp);
    handle.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    delete hero.dataset.bound;
  });
}

// Module executes once per document; page-load fires for every ClientRouter navigation.
document.addEventListener('astro:page-load', () => { void initHero(); });

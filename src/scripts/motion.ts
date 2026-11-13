/**
 * Motion bootstrap (GSAP + ScrollTrigger + SplitText + CustomEase, Lenis).
 *
 * Public API for page agents:
 *   bootMotion()            call ONCE from Base.astro; wires initMotion on 'astro:page-load' and cleanup on 'astro:before-swap'
 *   initMotion()            (re)initialises Lenis + headline reveals for the current DOM
 *   destroyMotion()         kills ScrollTriggers, destroys Lenis, reverts SplitText
 *   onMotionCleanup(fn)     register teardown for page-specific animations/listeners; runs on the next destroyMotion().
 *                           Page scripts: `document.addEventListener('astro:page-load', () => { ...build; onMotionCleanup(() => ...) })`
 *                           Create page ScrollTriggers AFTER initMotion (astro:page-load listeners run in registration order;
 *                           page scripts register later than Base, so this holds). Use gsap/ScrollTrigger from this module's exports.
 *   prefersReducedMotion()  true when the user asked for reduced motion: skip movement, show end states
 *   getLenis()              current Lenis instance or null (call .stop()/.start() when a drawer opens)
 *   EASE                    named GSAP eases: 'standard' | 'entrance' | 'squeeze' | 'wipe' (use as `ease: EASE.entrance`)
 *   gsap, ScrollTrigger, SplitText   re-exported, already registered
 *
 * Headlines: any element with [data-reveal-lines] (the <Headline> component) is split by line behind a clipping
 * mask and each line rises 110% -> 0 (700ms, 80ms stagger, entrance ease) once on entry. Body copy never animates.
 * Anti-flash: html.js-motion (set by an inline head script when motion is allowed) hides [data-reveal-lines]
 * until it has been split; a safety timeout guarantees text can never stay hidden.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

CustomEase.create('standard', '0.2,0.8,0.2,1');
CustomEase.create('entrance', '0.16,1,0.3,1');
CustomEase.create('squeeze', '0.34,1.3,0.5,1');
CustomEase.create('wipe', '0.83,0,0.17,1');

export const EASE = { standard: 'standard', entrance: 'entrance', squeeze: 'squeeze', wipe: 'wipe' } as const;
export { gsap, ScrollTrigger, SplitText };

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;
let tickerFn: ((time: number) => void) | null = null;
let splits: SplitText[] = [];
let cleanups: Array<() => void> = [];
let initToken = 0;

export const getLenis = (): Lenis | null => lenis;

export function onMotionCleanup(fn: () => void): void {
  cleanups.push(fn);
}

function startLenis(): void {
  if (prefersReducedMotion() || lenis) return;
  lenis = new Lenis({ autoRaf: false, lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  tickerFn = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);
}

/** Resolves when the page-transition line has uncovered the page (or immediately if it is not running). */
function lineClear(): Promise<void> {
  const busy = (window as unknown as { __pageLine?: { busy: boolean } }).__pageLine?.busy;
  if (!busy) return Promise.resolve();
  return new Promise((res) => {
    const done = () => { document.removeEventListener('line:revealing', done); res(); };
    document.addEventListener('line:revealing', done);
    window.setTimeout(done, 1500);
  });
}

function showAll(els: HTMLElement[]): void {
  els.forEach((el) => { el.style.visibility = 'visible'; });
}

async function initReveals(token: number): Promise<void> {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal-lines]'));
  if (!els.length || prefersReducedMotion()) { showAll(els); return; }

  // Safety net: never leave headlines hidden.
  const safety = window.setTimeout(() => showAll(els), 3000);
  cleanups.push(() => window.clearTimeout(safety));

  try { await document.fonts.ready; } catch { /* ignore */ }
  await lineClear();
  if (token !== initToken) return; // a newer init (or destroy) superseded this one

  els.forEach((el) => {
    let revealed = false;
    let lines: Element[] = [];
    const split = SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit(self) {
        lines = self.lines;
        if (revealed) { gsap.set(lines, { yPercent: 0 }); return; }
        gsap.set(lines, { yPercent: 110 });
        el.style.visibility = 'visible';
      },
    });
    splits.push(split);
    const reveal = (instant = false) => {
      if (revealed) return;
      revealed = true;
      if (instant) gsap.set(lines, { yPercent: 0 });
      else gsap.to(lines, { yPercent: 0, duration: 0.7, stagger: 0.08, ease: EASE.entrance, overwrite: 'auto' });
    };
    const st = ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => reveal() });
    if (st.progress >= 1 && !revealed) reveal(true); // already scrolled past (e.g. restored scroll position)
  });
  window.clearTimeout(safety);
}

export function destroyMotion(): void {
  initToken++;
  cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  cleanups = [];
  splits.forEach((s) => s.revert());
  splits = [];
  ScrollTrigger.getAll().forEach((t) => t.kill());
  if (tickerFn) { gsap.ticker.remove(tickerFn); tickerFn = null; }
  lenis?.destroy();
  lenis = null;
}

export function initMotion(): void {
  destroyMotion();
  const token = initToken;
  startLenis();
  void initReveals(token);
  ScrollTrigger.refresh();
}

let booted = false;
/** Call once (Base.astro). Safe to call again; listeners are registered a single time. */
export function bootMotion(): void {
  if (booted) return;
  booted = true;
  document.addEventListener('astro:page-load', () => initMotion());
  document.addEventListener('astro:before-swap', (e) => {
    destroyMotion();
    // Astro replaces <html> attributes on swap; keep the anti-flash class on the incoming document.
    const ev = e as Event & { newDocument: Document };
    if (!prefersReducedMotion()) ev.newDocument.documentElement.classList.add('js-motion');
  });
}

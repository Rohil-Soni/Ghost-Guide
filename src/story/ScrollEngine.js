import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

// Scroll is only turned into a number here; the render loop reads it and damps the camera.
export class ScrollEngine {
  constructor({ onProgress, onReduce }) {
    this.lenis = null;
    this.trigger = null;
    const touch = matchMedia('(pointer: coarse)').matches;

    if (!touch) {
      this.lenis = new Lenis({ lerp: 0.1 });
      this.lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => this.lenis?.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    this.mm = gsap.matchMedia();
    this.mm.add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, ({ conditions }) => {
      if (conditions.reduce) { onReduce?.(); return; }
      this.trigger = ScrollTrigger.create({
        trigger: '#tour', start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => onProgress(self.progress),
      });
      onProgress(this.trigger.progress);
    });
  }

  stop() {
    this.lenis?.stop();
    this.trigger?.disable(false);
  }

  start() {
    this.trigger?.enable();
    this.lenis?.start();
    this.scrollTo(0);
    ScrollTrigger.refresh();
  }

  scrollTo(y) {
    if (this.lenis) this.lenis.scrollTo(y, { immediate: true });
    else window.scrollTo(0, y);
  }
}

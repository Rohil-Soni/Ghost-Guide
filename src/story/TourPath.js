import * as THREE from 'three';
import gsap from 'gsap';
import { v3, clamp01 } from '../utils/math.js';

const TRAVEL = 0.45; // share of each chapter's scroll spent travelling; the rest is a hold for reading
const ease = gsap.parseEase('power2.inOut');

export class TourPath {
  constructor(shots) {
    this.n = shots.length;
    this.pos = new THREE.CatmullRomCurve3(shots.map((s) => v3(s.pos)), false, 'centripetal');
    this.tgt = new THREE.CatmullRomCurve3(shots.map((s) => v3(s.target)), false, 'centripetal');
  }

  // Scroll progress (0..1) → curve parameter u (0..1). Chapter 0 is the hero hold.
  progressToU(progress) {
    const n = this.n;
    const seg = Math.min(n - 1, Math.floor(progress * n));
    const p = progress * n - seg;
    const k = p < TRAVEL ? ease(p / TRAVEL) : 1;
    return clamp01((seg - 1 + k) / (n - 1));
  }

  chapterAt(progress) {
    const seg = Math.min(this.n - 1, Math.floor(progress * this.n));
    return { index: seg, local: progress * this.n - seg };
  }

  // getPoint (not getPointAt) so shot i sits exactly at u = i/(n-1).
  sample(u, outPos, outTarget, t = 0) {
    this.pos.getPoint(u, outPos);
    this.tgt.getPoint(u, outTarget);
    // tiny drift so holds don't feel frozen
    outPos.x += Math.sin(t * 0.25) * 0.6;
    outPos.y += Math.sin(t * 0.33) * 0.3;
  }
}

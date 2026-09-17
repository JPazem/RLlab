import { updateGlowValue } from "./glow";

export class PSLayer {
  w: number; h: number; hvals: Float32Array; gvals: Float32Array;
  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.hvals = new Float32Array(w * h * 4).fill(1);
    this.gvals = new Float32Array(w * h * 4);
  }
  idx(x: number, y: number, a: number) { return ((y * this.w) + x) * 4 + a; }
  getH(x: number, y: number, a: number) { return this.hvals[this.idx(x, y, a)]; }
  getG(x: number, y: number, a: number) { return this.gvals[this.idx(x, y, a)]; }
  updateGlow(x: number, y: number, action: number, eta: number) {
    const selected = this.idx(x, y, action);
    for (let i = 0; i < this.gvals.length; i++) this.gvals[i] = updateGlowValue(this.gvals[i], eta, i === selected);
  }
  rewardUpdate(r: number, gamma: number, lambda: number) {
    for (let i = 0; i < this.hvals.length; i++) {
      const h = this.hvals[i];
      this.hvals[i] = h - gamma * (h - 1) + this.gvals[i] * r * lambda;
    }
  }
  normalize() {
    for (let i = 0; i < this.hvals.length; i++) this.hvals[i] = Math.max(0.1, Math.min(10, this.hvals[i]));
    for (let i = 0; i < this.gvals.length; i++) this.gvals[i] = Math.max(0, Math.min(1, this.gvals[i]));
  }
  copy() {
    const snapshot = new PSLayer(this.w, this.h);
    snapshot.hvals = this.hvals.slice();
    snapshot.gvals = this.gvals.slice();
    return snapshot;
  }
}

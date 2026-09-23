import { updateGlowValue } from "./glow";

export class PSLayer {
  w: number; h: number; hvals: Float32Array; gvals: Float32Array;
  private slotAt: (x: number, y: number, keys: number) => number;
  private slotCount: number;
  constructor(w: number, h: number, slotAt?: (x: number, y: number, keys: number) => number, slotCount = w * h) {
    this.w = w; this.h = h;
    this.slotAt = slotAt ?? ((x, y) => y * w + x);
    this.slotCount = slotCount;
    this.hvals = new Float32Array(slotCount * 4).fill(1);
    this.gvals = new Float32Array(slotCount * 4);
  }
  idx(x: number, y: number, a: number, keys = 0) { return this.slotAt(x, y, keys) * 4 + a; }
  getH(x: number, y: number, a: number, keys = 0) { return this.hvals[this.idx(x, y, a, keys)]; }
  getG(x: number, y: number, a: number, keys = 0) { return this.gvals[this.idx(x, y, a, keys)]; }
  updateGlow(x: number, y: number, action: number, eta: number, keys = 0) {
    const selected = this.idx(x, y, action, keys);
    for (let i = 0; i < this.gvals.length; i++) this.gvals[i] = updateGlowValue(this.gvals[i], eta, i === selected);
  }
  rewardUpdate(r: number, gamma: number, lambda: number) {
    for (let i = 0; i < this.hvals.length; i++) {
      const h = this.hvals[i];
      this.hvals[i] = h - gamma * (h - 1) + this.gvals[i] * r * lambda;
    }
  }
  normalize() {
    // H-values are signed connection strengths. Softmax subtracts their maximum,
    // so there is no need to restrict them to a positive 0.1–10 display range.
    for (let i = 0; i < this.hvals.length; i++) {
      if (!Number.isFinite(this.hvals[i])) this.hvals[i] = 1;
    }
    for (let i = 0; i < this.gvals.length; i++) this.gvals[i] = Math.max(0, Math.min(1, this.gvals[i]));
  }
  copy() {
    const snapshot = new PSLayer(this.w, this.h, this.slotAt, this.slotCount);
    snapshot.hvals = this.hvals.slice();
    snapshot.gvals = this.gvals.slice();
    return snapshot;
  }
}

// Mesures de performance (FPS, p95, latence saut→image) affichées avec F3 et lues par les tests.

class PerfMonitor {
  private frames = new Float32Array(240);
  private idx = 0;
  private count = 0;
  private loads: Record<string, number> = {};
  private loadStarts: Record<string, number> = {};
  private latencies: number[] = [];
  private pendingInput: number | null = null;

  frame(ms: number): void {
    this.frames[this.idx] = ms;
    this.idx = (this.idx + 1) % this.frames.length;
    this.count = Math.min(this.count + 1, this.frames.length);
  }

  startLoad(k: string): void {
    this.loadStarts[k] = performance.now();
  }

  endLoad(k: string): void {
    const t = this.loadStarts[k];
    if (t != null) this.loads[k] = Math.round(performance.now() - t);
  }

  markInput(t: number): void {
    this.pendingInput = t;
  }

  presented(): void {
    if (this.pendingInput == null) return;
    const d = performance.now() - this.pendingInput;
    if (d >= 0 && d < 1000) {
      this.latencies.push(d);
      if (this.latencies.length > 60) this.latencies.shift();
    }
    this.pendingInput = null;
  }

  stats() {
    const n = this.count;
    const sorted = Array.from(this.frames.subarray(0, n)).sort((a, b) => a - b);
    const avg = n ? sorted.reduce((a, b) => a + b, 0) / n : 0;
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
    return {
      fps: avg ? 1000 / avg : 0,
      frameAvg: avg,
      frameP95: n ? sorted[Math.min(n - 1, Math.floor(n * 0.95))] : 0,
      frameWorst: n ? sorted[n - 1] : 0,
      samples: n,
      memoryMB: mem == null ? null : mem / 1048576,
      inputLatencyMs: this.latencies.length ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length : null,
      loads: { ...this.loads },
    };
  }
}

export const perf = new PerfMonitor();
(globalThis as Record<string, unknown>).__perf = perf;

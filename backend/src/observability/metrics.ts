import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

interface TimingEntry {
  count: number;
  total: number;
  max: number;
  avg?: number;
}

export class MetricsRegistry {
  private startedAt: number;
  private counters: Map<string, number>;
  private timings: Map<string, TimingEntry>;
  private gauges: Map<string, number>;
  private eventLoop: ReturnType<typeof monitorEventLoopDelay>;
  private lastCpuUsage: NodeJS.CpuUsage;
  private lastCpuSampleAt: number;

  constructor() {
    this.startedAt = Date.now();
    this.counters = new Map();
    this.timings = new Map();
    this.gauges = new Map();
    this.eventLoop = monitorEventLoopDelay({ resolution: 20 });
    this.eventLoop.enable();
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuSampleAt = performance.now();
  }

  private key(name: string, labels: Record<string, string | number> = {}): string {
    const labelText = Object.keys(labels).sort().map((key) => `${key}=${labels[key]}`).join(',');
    return labelText ? `${name}{${labelText}}` : name;
  }

  increment(name: string, labels: Record<string, string | number> = {}, value: number = 1): void {
    const key = this.key(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  gauge(name: string, value: number, labels: Record<string, string | number> = {}): void {
    this.gauges.set(this.key(name, labels), Number(value) || 0);
  }

  observe(name: string, durationMs: number, labels: Record<string, string | number> = {}): void {
    const key = this.key(name, labels);
    const current = this.timings.get(key) ?? { count: 0, total: 0, max: 0 };
    current.count += 1;
    current.total += durationMs;
    current.max = Math.max(current.max, durationMs);
    this.timings.set(key, current);
  }

  async time<T>(name: string, labels: Record<string, string | number>, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.observe(name, performance.now() - start, labels);
    }
  }

  private sampleCpuPercent(): number {
    const now = performance.now();
    const usage = process.cpuUsage();
    const elapsedMicros = Math.max((now - this.lastCpuSampleAt) * 1000, 1);
    const usedMicros =
      usage.user - this.lastCpuUsage.user +
      usage.system - this.lastCpuUsage.system;

    this.lastCpuUsage = usage;
    this.lastCpuSampleAt = now;
    return Math.max(0, (usedMicros / elapsedMicros) * 100);
  }

  snapshot(extra: Record<string, any> = {}): Record<string, any> {
    const memory = process.memoryUsage();
    const timings: Record<string, TimingEntry & { avg: number }> = {};
    for (const [key, value] of this.timings.entries()) {
      timings[key] = {
        ...value,
        avg: value.count ? value.total / value.count : 0
      };
    }

    return {
      uptime_seconds: Math.round(process.uptime()),
      started_at: new Date(this.startedAt).toISOString(),
      memory,
      cpu_percent: this.sampleCpuPercent(),
      event_loop_lag_ms: {
        mean: Number.isFinite(this.eventLoop.mean) ? this.eventLoop.mean / 1e6 : 0,
        max: Number.isFinite(this.eventLoop.max) ? this.eventLoop.max / 1e6 : 0,
        p99: this.eventLoop.percentile(99) / 1e6
      },
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      timings,
      ...extra
    };
  }
}

export const metrics = new MetricsRegistry();

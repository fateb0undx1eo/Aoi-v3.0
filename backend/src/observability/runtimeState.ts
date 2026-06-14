interface DegradedEntry {
  reason: string;
  metadata: Record<string, any>;
  since: string;
  updated_at: string;
}

interface HealthEntry {
  status: string;
  metadata: Record<string, any>;
  checked_at: string;
}

export class RuntimeState {
  public startedAt: Date;
  public degraded: Map<string, DegradedEntry>;
  public lastHealth: Map<string, HealthEntry>;
  public shuttingDown: boolean;

  constructor() {
    this.startedAt = new Date();
    this.degraded = new Map();
    this.lastHealth = new Map();
    this.shuttingDown = false;
  }

  setDegraded(component: string, reason: string, metadata: Record<string, any> = {}): void {
    this.degraded.set(component, {
      reason,
      metadata,
      since: this.degraded.get(component)?.since ?? new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  clearDegraded(component: string): void {
    this.degraded.delete(component);
  }

  setHealth(component: string, status: string, metadata: Record<string, any> = {}): void {
    this.lastHealth.set(component, {
      status,
      metadata,
      checked_at: new Date().toISOString()
    });
    if (status === 'healthy') {
      this.clearDegraded(component);
    } else {
      this.setDegraded(component, status, metadata);
    }
  }

  snapshot(): Record<string, any> {
    return {
      started_at: this.startedAt.toISOString(),
      uptime_seconds: Math.round((Date.now() - this.startedAt.getTime()) / 1000),
      shutting_down: this.shuttingDown,
      degraded: Object.fromEntries(this.degraded),
      health: Object.fromEntries(this.lastHealth)
    };
  }
}

export const runtimeState = new RuntimeState();

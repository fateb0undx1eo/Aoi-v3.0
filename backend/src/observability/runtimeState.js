export class RuntimeState {
  constructor() {
    this.startedAt = new Date();
    this.degraded = new Map();
    this.lastHealth = new Map();
    this.shuttingDown = false;
  }

  setDegraded(component, reason, metadata = {}) {
    this.degraded.set(component, {
      reason,
      metadata,
      since: this.degraded.get(component)?.since ?? new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  clearDegraded(component) {
    this.degraded.delete(component);
  }

  setHealth(component, status, metadata = {}) {
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

  snapshot() {
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

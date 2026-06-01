"use client";

import { useEffect } from "react";

const PING_INTERVAL = 10 * 60 * 1000;

export function KeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch("/api/keep-alive").catch(() => {});
    };

    ping();
    const id = setInterval(ping, PING_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return null;
}

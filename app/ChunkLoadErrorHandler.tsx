"use client";

import { useEffect } from "react";

const RELOAD_KEY = "chunk-reload-at";
const RELOAD_COOLDOWN_MS = 15000; // don't reload again within 15s (avoid loop)

/**
 * In production, catch ChunkLoadError (stale chunk after deploy) and force a full reload
 * so the user gets the latest assets. Limits reloads to once per cooldown to avoid loops.
 */
export function ChunkLoadErrorHandler() {
  useEffect(() => {
    const shouldReload = (): boolean => {
      const lastReload = typeof window !== "undefined" ? sessionStorage.getItem(RELOAD_KEY) : null;
      const now = Date.now();
      if (lastReload) {
        const elapsed = now - Number(lastReload);
        if (elapsed < RELOAD_COOLDOWN_MS) return false;
      }
      if (typeof window !== "undefined") sessionStorage.setItem(RELOAD_KEY, String(now));
      return true;
    };

    const isChunkError = (msg: string, name?: string): boolean => {
      const s = (msg ?? "") + (name ?? "");
      return (
        name === "ChunkLoadError" ||
        s.includes("ChunkLoadError") ||
        s.includes("Loading chunk") ||
        s.includes("Loading CSS chunk") ||
        s.includes("Failed to fetch dynamically imported module")
      );
    };

    const handleError = (event: ErrorEvent) => {
      const msg = event.message ?? "";
      const name = event.error?.name;
      if (!isChunkError(msg, name)) return;
      if (!shouldReload()) return;
      window.location.reload();
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? String(event.reason ?? "");
      const name = event.reason?.name;
      if (!isChunkError(msg, name)) return;
      if (!shouldReload()) return;
      event.preventDefault();
      window.location.reload();
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

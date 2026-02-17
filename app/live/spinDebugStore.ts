const MAX_ENTRIES = 500;
const STORAGE_KEY = "spin-debug-logs";
const GLOBAL_LOGS_KEY = "__SPIN_DEBUG_LOGS__";
const GLOBAL_LISTENERS_KEY = "__SPIN_DEBUG_LISTENERS__";

export type SpinLogType =
  | "SPIN_REQUEST"
  | "SPIN_IGNORED"
  | "ANIMATION_START"
  | "ANIM_PROGRESS"
  | "MICRO_START"
  | "SPIN_COMPLETE"
  | "RESET"
  | "CANCEL_PREVIOUS"
  | "ERROR";

export type SpinLogEntry = {
  id: string;
  type: SpinLogType;
  timestamp: number;
  data?: unknown;
};

let idCounter = 0;

function getLogsArray(): SpinLogEntry[] {
  if (typeof window !== "undefined") {
    const w = window as unknown as Record<string, unknown>;
    if (!Array.isArray(w[GLOBAL_LOGS_KEY])) {
      w[GLOBAL_LOGS_KEY] = [];
    }
    return w[GLOBAL_LOGS_KEY] as SpinLogEntry[];
  }
  return [];
}

function getListenersSet(): Set<() => void> {
  if (typeof window !== "undefined") {
    const w = window as unknown as Record<string, unknown>;
    if (!(w[GLOBAL_LISTENERS_KEY] instanceof Set)) {
      w[GLOBAL_LISTENERS_KEY] = new Set<() => void>();
    }
    return w[GLOBAL_LISTENERS_KEY] as Set<() => void>;
  }
  return new Set<() => void>();
}

function nextId(): string {
  return `spin-${Date.now()}-${++idCounter}`;
}

export function addSpinLog(entry: Omit<SpinLogEntry, "id" | "timestamp">): void {
  console.log("LOG ADDED:", entry);
  const full: SpinLogEntry = {
    ...entry,
    id: nextId(),
    timestamp: typeof performance !== "undefined" ? performance.now() : Date.now(),
  };
  const logs = getLogsArray();
  logs.unshift(full);
  const trimmed = logs.slice(0, MAX_ENTRIES);
  logs.length = 0;
  logs.push(...trimmed);
  persistToStorage();
  getListenersSet().forEach((fn) => fn());
}

function persistToStorage(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getLogsArray()));
    }
  } catch {
    // ignore
  }
}

export function subscribeSpinLogs(listener: () => void): () => void {
  const set = getListenersSet();
  set.add(listener);
  return () => set.delete(listener);
}

export function getSpinLogs(): SpinLogEntry[] {
  return [...getLogsArray()];
}

export function clearSpinLogs(): void {
  const logs = getLogsArray();
  logs.length = 0;
  persistToStorage();
  getListenersSet().forEach((fn) => fn());
}

/** Read logs from localStorage (for /live/log when open in another tab). */
export function getSpinLogsFromStorage(): SpinLogEntry[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SpinLogEntry[];
        return Array.isArray(parsed) ? parsed : [];
      }
    }
  } catch {
    // ignore
  }
  return [];
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getBaseUrl, getCsrfToken } from "@/lib/api";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const INTERVAL_PRESETS = [15, 30, 45, 60];
const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTime(s: string) {
  return typeof s === "string" && HH_MM_REGEX.test(s);
}

type CreateGameDrawerProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export function CreateGameDrawer({ onClose, onSuccess }: CreateGameDrawerProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [scheduleType, setScheduleType] = useState<"daily" | "weekly" | "interval">("daily");
  const [dailyTimes, setDailyTimes] = useState<string[]>(["09:00"]);
  const [weeklyDays, setWeeklyDays] = useState<string[]>([]);
  const [weeklyTimes, setWeeklyTimes] = useState<string[]>(["09:00"]);
  const [intervalStartTime, setIntervalStartTime] = useState("09:00");
  const [intervalEndTime, setIntervalEndTime] = useState("18:00");
  const [intervalMinutes, setIntervalMinutes] = useState<number | "custom">(30);
  const [customInterval, setCustomInterval] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const toggleWeekday = (day: string) => {
    setWeeklyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const addDailyTime = () => setDailyTimes((prev) => [...prev, "09:00"]);
  const removeDailyTime = (index: number) =>
    setDailyTimes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  const setDailyTimeAt = (index: number, value: string) =>
    setDailyTimes((prev) => prev.map((t, i) => (i === index ? value : t)));

  const addWeeklyTime = () => setWeeklyTimes((prev) => [...prev, "09:00"]);
  const removeWeeklyTime = (index: number) =>
    setWeeklyTimes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  const setWeeklyTimeAt = (index: number, value: string) =>
    setWeeklyTimes((prev) => prev.map((t, i) => (i === index ? value : t)));

  const getEffectiveInterval = (): number | null => {
    if (intervalMinutes === "custom") {
      const v = parseInt(customInterval, 10);
      return Number.isInteger(v) && v >= 1 && v <= 1440 ? v : null;
    }
    return intervalMinutes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Game name is required";
    if (!startDate) errs.startDate = "Start date is required";

    if (scheduleType === "daily") {
      const valid = dailyTimes.filter(isValidTime);
      if (valid.length === 0) errs.dailyTimes = "Add at least one valid time (HH:mm)";
    }
    if (scheduleType === "weekly") {
      if (weeklyDays.length === 0) errs.weeklyDays = "Select at least one day";
      const valid = weeklyTimes.filter(isValidTime);
      if (valid.length === 0) errs.weeklyTimes = "Add at least one valid time (HH:mm)";
    }
    if (scheduleType === "interval") {
      if (!isValidTime(intervalStartTime)) errs.intervalStartTime = "Enter start time (HH:mm)";
      if (!isValidTime(intervalEndTime)) errs.intervalEndTime = "Enter end time (HH:mm)";
      if (isValidTime(intervalStartTime) && isValidTime(intervalEndTime)) {
        const [sh, sm] = intervalStartTime.split(":").map(Number);
        const [eh, em] = intervalEndTime.split(":").map(Number);
        const startM = sh * 60 + sm;
        const endM = eh * 60 + em;
        if (startM >= endM) errs.intervalEndTime = "End time start time se baad hona chahiye";
      }
      const interval = getEffectiveInterval();
      if (interval == null) errs.interval = "Enter interval between 1 and 1440 minutes";
    }

    // Past date / past time validation (Interval, Daily, Weekly)
    if (startDate) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [startY, startM, startD] = startDate.split("-").map(Number);
      const selectedDateOnly = new Date(startY, startM - 1, startD);

    if (selectedDateOnly < todayStart) {
      errs.startDate = "Past date pe game create nahi ho sakta";
      toast.error("Past date pe game create nahi ho sakta");
    } else {
      const now = new Date();
      const isToday =
        selectedDateOnly.getFullYear() === todayStart.getFullYear() &&
        selectedDateOnly.getMonth() === todayStart.getMonth() &&
        selectedDateOnly.getDate() === todayStart.getDate();

      // Interval + today: backend will set first slot from creation time; no past-time check needed
      if (scheduleType === "interval" && !isToday) {
        const gameStart = new Date(startY, startM - 1, startD, ...intervalStartTime.split(":").map(Number));
        if (gameStart <= now) {
          errs.intervalStartTime = "Game ka starting time current time se jyada hona chahiye";
          toast.error("Game ka starting time current time se jyada hona chahiye");
        }
      } else if (scheduleType === "daily" && isToday) {
        const validTimes = dailyTimes.filter(isValidTime);
        const hasPastTime = validTimes.some((t) => {
          const [h, m] = t.split(":").map(Number);
          return new Date(startY, startM - 1, startD, h, m, 0) <= now;
        });
        if (hasPastTime) {
          errs.dailyTimes = "Game ka starting time current time se jyada hona chahiye";
          toast.error("Game ka starting time current time se jyada hona chahiye");
        }
      } else if (scheduleType === "weekly" && isToday) {
        const todayDay = WEEKDAYS[new Date().getDay()];
        if (weeklyDays.includes(todayDay)) {
          const validTimes = weeklyTimes.filter(isValidTime);
          const hasPastTime = validTimes.some((t) => {
            const [h, m] = t.split(":").map(Number);
            return new Date(startY, startM - 1, startD, h, m, 0) <= now;
          });
          if (hasPastTime) {
            errs.weeklyTimes = "Game ka starting time current time se jyada hona chahiye";
            toast.error("Game ka starting time current time se jyada hona chahiye");
          }
        }
      }
    }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    const csrf = getCsrfToken();
    if (!csrf) {
      setError("Session expired. Please log in again.");
      return;
    }

    setLoading(true);
    try {
      const base = getBaseUrl();
      let body: Record<string, unknown> = {
        name: name.trim(),
        startDate: new Date(startDate).toISOString().slice(0, 10),
        scheduleType,
      };

      if (scheduleType === "daily") {
        body.resultTimes = dailyTimes.filter(isValidTime);
      } else if (scheduleType === "weekly") {
        body.weeklyDays = weeklyDays;
        body.resultTimes = weeklyTimes.filter(isValidTime);
      } else {
        body.resultTime = intervalStartTime;
        body.slotEndTime = intervalEndTime;
        body.slotIntervalMinutes = getEffectiveInterval() ?? 30;
      }

      const res = await fetch(`${base}/api/admin/games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      const message = typeof data?.message === "string" ? data.message : "Failed to create game";

      if (!res.ok) {
        setError(message);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close drawer"
      />
      <div
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col"
        style={{ animation: "slideIn 0.2s ease-out" }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-800">Create Game</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="game-name" className="block text-sm font-medium text-slate-700 mb-1">
              Game name
            </label>
            <input
              id="game-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 disabled:opacity-60"
              placeholder="e.g. Morning Game"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-slate-700 mb-1">
              Game starting date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 disabled:opacity-60"
            />
            {fieldErrors.startDate && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.startDate}</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-4">
            <p className="text-sm font-medium text-slate-700">Schedule type</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === "daily"}
                  onChange={() => setScheduleType("daily")}
                  disabled={loading}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-800">Daily</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === "weekly"}
                  onChange={() => setScheduleType("weekly")}
                  disabled={loading}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-800">Weekly</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === "interval"}
                  onChange={() => setScheduleType("interval")}
                  disabled={loading}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-800">Interval</span>
              </label>
            </div>

            {scheduleType === "daily" && (
              <div>
                <p className="text-sm text-slate-600 mb-2">Times (every day)</p>
                <div className="space-y-2">
                  {dailyTimes.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={t}
                        onChange={(e) => setDailyTimeAt(i, e.target.value)}
                        disabled={loading}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => removeDailyTime(i)}
                        disabled={loading || dailyTimes.length === 1}
                        className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        aria-label="Remove time"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDailyTime}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 text-sm"
                  >
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-slate-200 text-slate-700">+</span>
                    Add time
                  </button>
                </div>
                {fieldErrors.dailyTimes && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.dailyTimes}</p>
                )}
              </div>
            )}

            {scheduleType === "weekly" && (
              <>
                <div>
                  <p className="text-sm text-slate-600 mb-2">Select days</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => (
                      <label
                        key={day}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${
                          weeklyDays.includes(day)
                            ? "border-slate-600 bg-slate-100 text-slate-900"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={weeklyDays.includes(day)}
                          onChange={() => toggleWeekday(day)}
                          disabled={loading}
                          className="sr-only"
                        />
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </label>
                    ))}
                  </div>
                  {fieldErrors.weeklyDays && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.weeklyDays}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-2">Times (on selected days)</p>
                  <div className="space-y-2">
                    {weeklyTimes.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={t}
                          onChange={(e) => setWeeklyTimeAt(i, e.target.value)}
                          disabled={loading}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => removeWeeklyTime(i)}
                          disabled={loading || weeklyTimes.length === 1}
                          className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          aria-label="Remove time"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addWeeklyTime}
                      disabled={loading}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 text-sm"
                    >
                      <span className="w-5 h-5 flex items-center justify-center rounded bg-slate-200 text-slate-700">+</span>
                      Add time
                    </button>
                  </div>
                  {fieldErrors.weeklyTimes && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.weeklyTimes}</p>
                  )}
                </div>
              </>
            )}

            {scheduleType === "interval" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 mb-2">Start time</p>
                  <input
                    type="time"
                    value={intervalStartTime}
                    onChange={(e) => setIntervalStartTime(e.target.value)}
                    disabled={loading}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  />
                  {fieldErrors.intervalStartTime && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.intervalStartTime}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-2">End time</p>
                  <input
                    type="time"
                    value={intervalEndTime}
                    onChange={(e) => setIntervalEndTime(e.target.value)}
                    disabled={loading}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  />
                  {fieldErrors.intervalEndTime && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.intervalEndTime}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-2">Slot every</p>
                  <div className="flex flex-wrap gap-2">
                    {INTERVAL_PRESETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setIntervalMinutes(m)}
                        disabled={loading}
                        className={`px-3 py-1.5 rounded-lg border text-sm ${
                          intervalMinutes === m
                            ? "border-slate-600 bg-slate-100 text-slate-900"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {m} min
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIntervalMinutes("custom")}
                      disabled={loading}
                      className={`px-3 py-1.5 rounded-lg border text-sm ${
                        intervalMinutes === "custom"
                          ? "border-slate-600 bg-slate-100 text-slate-900"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {intervalMinutes === "custom" && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={customInterval}
                        onChange={(e) => setCustomInterval(e.target.value)}
                        disabled={loading}
                        placeholder="Minutes"
                        className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <span className="text-sm text-slate-500">minutes</span>
                    </div>
                  )}
                  {fieldErrors.interval && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.interval}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Game"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

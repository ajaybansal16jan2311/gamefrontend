import { apiClient, getBaseUrl, getCsrfToken } from "./apiClient";

export { getBaseUrl, getCsrfToken };

export async function login(email: string, password: string): Promise<string> {
  const { data } = await apiClient.post<{
    token?: string;
    accessToken?: string;
    access_token?: string;
    message?: string;
  }>("/api/auth/login", { email, password });

  const token = data?.token ?? data?.accessToken ?? data?.access_token;
  if (!token || typeof token !== "string") {
    throw new Error("Invalid response: no token received");
  }
  return token;
}

/**
 * Admin logout: clears cookies on backend. Call before clearing local state.
 */
export async function adminLogout(): Promise<void> {
  try {
    await apiClient.post("/api/admin/logout");
  } catch {
    // Ignore network errors; we still clear local state
  }
}

export async function checkAdminSessionCookie(): Promise<boolean> {
  try {
    const res = await apiClient.get("/api/admin/me");
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Verify admin token by calling a protected endpoint.
 */
export async function verifyAdminSession(token: string): Promise<boolean> {
  if (!getBaseUrl()) return true; // no API URL: trust token presence
  try {
    const res = await apiClient.get("/api/admin/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export type DailyPlannerItem = {
  gameId: string;
  name: string;
  resultTime: string;
  scheduleType: string;
  resultNumber: string | null;
  source: string | null;
  status: string;
  resultStatus: "Publish" | "Random Publish" | "Scheduled" | "pending";
  isRandom?: boolean;
  publishAt?: string;
};

export type DailyPlannerResponse = {
  date: string;
  items: DailyPlannerItem[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

export async function getDailyPlanner(
  date: string,
  params?: { page?: number; limit?: number }
): Promise<DailyPlannerResponse> {
  const search = new URLSearchParams();
  search.set("date", date);
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const { data } = await apiClient.get<DailyPlannerResponse>(
    `/api/admin/daily-planner?${search.toString()}`
  );
  return data;
}

export type SubmitResultPayload = {
  gameId: string;
  date: string;
  time?: string;
  resultNumber: string;
};

export async function submitResult(payload: SubmitResultPayload): Promise<void> {
  await apiClient.post("/api/admin/result", payload);
}

// --- Game Manager (unpublished scheduled results) ---

export type UnpublishedItem = {
  _id: string | null;
  gameId: string;
  gameName: string;
  date: string;
  time: string;
  fullDateTime: string;
  resultNumber: string | null;
};

export type UnpublishedResponse = {
  items: UnpublishedItem[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  games?: { gameId: string; gameName: string }[];
};

export type UnpublishedParams = {
  start?: string;
  end?: string;
  gameId?: string;
  futureOnly?: boolean;
  page?: number;
  limit?: number;
};

export async function getUnpublishedScheduledResults(
  params?: UnpublishedParams
): Promise<UnpublishedResponse> {
  const search = new URLSearchParams();
  if (params?.start) search.set("start", params.start);
  if (params?.end) search.set("end", params.end);
  if (params?.gameId) search.set("gameId", params.gameId);
  if (params?.futureOnly === true) search.set("futureOnly", "true");
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const qs = search.toString();
  const url = `/api/admin/scheduled-results/unpublished${qs ? `?${qs}` : ""}`;
  const { data } = await apiClient.get<UnpublishedResponse>(url);
  return data;
}

export async function deleteScheduledResult(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/scheduled-results/${encodeURIComponent(id)}`);
}

export type CancelSlotPayload = {
  gameId: string;
  date: string;
  time: string;
};

export async function cancelSlot(payload: CancelSlotPayload): Promise<void> {
  await apiClient.post("/api/admin/slots/cancel", payload);
}

export type DeleteScheduledResultsByGameResponse = {
  deletedCount: number;
  skippedCount: number;
  cancelledPendingCount: number;
};

export async function deleteScheduledResultsByGame(
  gameId: string
): Promise<DeleteScheduledResultsByGameResponse> {
  const { data } = await apiClient.delete<DeleteScheduledResultsByGameResponse>(
    "/api/admin/scheduled-results/bulk-by-game",
    { data: { gameId } }
  );
  return data;
}

export async function deleteScheduledResultsBulk(
  ids: string[]
): Promise<{ deletedCount: number; skippedCount: number }> {
  const { data } = await apiClient.delete<{ deletedCount: number; skippedCount: number }>(
    "/api/admin/scheduled-results/bulk",
    { data: { ids } }
  );
  return data;
}

export async function updateScheduledResultsBulk(
  ids: string[],
  resultNumber: string
): Promise<{ updatedCount: number; skippedCount: number }> {
  const { data } = await apiClient.patch<{ updatedCount: number; skippedCount: number }>(
    "/api/admin/scheduled-results/bulk",
    { ids, resultNumber }
  );
  return data;
}

export async function hardReset(): Promise<{ ok: true; message: string }> {
  const { data } = await apiClient.post<{ ok: true; message: string }>(
    "/api/admin/hard-reset",
    {}
  );
  return data;
}

// --- Public API (no login, for live/results page) ---

export type PublicCurrentResult = {
  _id?: string;
  gameId?: { name?: string } | string;
  gameName: string | null;
  fullDateTime: string;
  resultNumber: string;
  isRandom?: boolean;
};

export type PublicNextSlot = {
  nextSlotTime: string;
  remainingSeconds: number;
};

export type PublicPastResultItem = {
  _id?: string;
  gameId?: { name?: string } | string;
  gameName: string | null;
  fullDateTime: string;
  resultNumber: string;
  isRandom?: boolean;
};

export type PublicPastResultsResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: PublicPastResultItem[];
};

export type PublicNowResponse = {
  timestamp: number;
  iso: string;
};

/** Latest published result. No auth. */
export async function getPublicCurrentResult(): Promise<PublicCurrentResult | null> {
  const res = await apiClient.get<PublicCurrentResult>("/api/current-result", {
    validateStatus: (s) => s === 200 || s === 404,
  });
  if (res.status === 404) return null;
  return res.data;
}

/** Next draw slot time and remaining seconds. No auth. */
export async function getPublicNextSlot(): Promise<PublicNextSlot | null> {
  const res = await apiClient.get<PublicNextSlot>("/api/next-slot", {
    validateStatus: (s) => s === 200 || s === 404,
  });
  if (res.status === 404) return null;
  return res.data;
}

/** Past results with pagination and optional date range. No auth. */
export async function getPublicPastResults(params?: {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
}): Promise<PublicPastResultsResponse> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.fromDate) search.set("fromDate", params.fromDate);
  if (params?.toDate) search.set("toDate", params.toDate);
  const qs = search.toString();
  const { data } = await apiClient.get<PublicPastResultsResponse>(
    `/api/past-results${qs ? `?${qs}` : ""}`
  );
  return data;
}

/** Current server time in IST (for live clock). No auth. */
export async function getPublicNow(): Promise<PublicNowResponse> {
  const { data } = await apiClient.get<PublicNowResponse>("/api/now");
  return data;
}

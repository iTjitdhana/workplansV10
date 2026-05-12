import { getApiUrl as getApiUrlFromConfig } from "@/lib/config";

type JsonRecord = Record<string, unknown>;

const getApiUrl = (endpoint: string): string => {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return getApiUrlFromConfig(clean);
};

const parseJsonSafe = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const fetchJson = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const message = typeof data === "object" && data?.message ? String(data.message) : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
};

export const planningApi = {
  getUsers: () => fetchJson("/api/users"),
  getMachines: () => fetchJson("/api/machines"),
  getProductionRooms: () => fetchJson("/api/production-rooms"),
  getSettings: () => fetchJson("/api/settings"),
  getLogsByWorkPlan: (workPlanId: string) => fetchJson(`/api/logs?work_plan_id=${encodeURIComponent(workPlanId)}`),
  getLogsStatusByWorkPlanIds: (ids: (string | number)[]) =>
    fetchJson(getApiUrl(`/api/logs/work-plans/status?workPlanIds=${ids.join(",")}`)),

  searchProcessSteps: (query: string) => fetchJson(getApiUrl(`/api/process-steps/search?query=${encodeURIComponent(query)}`)),
  searchWorkPlansByName: (name: string) => fetchJson(getApiUrl(`/api/work-plans/search?name=${encodeURIComponent(name)}`)),
  getLatestByJob: (params: URLSearchParams) => fetchJson(`/api/work-plans/latest-by-job?${params.toString()}`),

  createWorkPlan: (payload: JsonRecord) =>
    fetchJson("/api/work-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateWorkPlan: (id: string, payload: JsonRecord) =>
    fetchJson(getApiUrl(`/api/work-plans/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteWorkPlan: (id: string) =>
    fetchJson(getApiUrl(`/api/work-plans/${id}`), {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }),
  cancelWorkPlan: (id: string) =>
    fetchJson(getApiUrl(`/api/work-plans/${id}/cancel`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({}),
    }),
  deleteDraftByCandidateUrls: async (urls: string[]): Promise<any> => {
    let lastError: unknown;
    for (const url of urls) {
      try {
        return await fetchJson(url, { method: "DELETE", headers: { Accept: "application/json" } });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Delete draft failed");
  },

  printWorkPlans: (payload: JsonRecord) =>
    fetchJson(getApiUrl("/api/work-plans/print"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  syncDraftsToPlans: (targetDate?: string) =>
    fetchJson(getApiUrl("/api/work-plans/sync-drafts-to-plans"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(targetDate ? { targetDate } : {}),
    }),
  createDefaultTasks: (date: string) =>
    fetchJson("/api/work-plans/create-defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Keep backward compatibility: backend expects production_date.
      body: JSON.stringify({ production_date: date, date }),
    }),
  syncWorkOrder: (date: string) =>
    fetchJson(getApiUrl(`/api/work-plans/sync-work-order?date=${encodeURIComponent(date)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }),

  getWorkPlansPaged: (page: number, limit: number) => fetchJson(getApiUrl(`/api/work-plans?page=${page}&limit=${limit}`)),
  getWorkPlansByDate: (date: string, page = 1, limit = 100) =>
    fetchJson(getApiUrl(`/api/work-plans?date=${encodeURIComponent(date)}&page=${page}&limit=${limit}`)),
  getWorkPlansByDateNoStore: (date: string) =>
    fetchJson(getApiUrl(`/api/work-plans?date=${encodeURIComponent(date)}&limit=100&_ts=${Date.now()}`), { cache: "no-store" }),
};

export { getApiUrl };

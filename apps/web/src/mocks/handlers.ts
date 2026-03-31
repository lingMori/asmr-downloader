import { http, HttpResponse } from "msw";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

export const handlers = [
  http.get(`${API_BASE}/tasks`, () => {
    return HttpResponse.json({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });
  }),
  http.get(`${API_BASE}/sync/report`, () => {
    return HttpResponse.json({
      totals: { metadata: 0, subtitle: 0 },
      downloads: { completed: 0 },
    });
  }),
];

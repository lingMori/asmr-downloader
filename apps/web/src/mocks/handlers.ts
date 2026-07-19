import { http, HttpResponse } from "msw";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

function envelope<T>(data: T) {
  return { code: "OK", message: "", data };
}

const emptyWorkList = { items: [], page: 1, page_size: 20, total: 0 };

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
  http.get(`${API_BASE}/discover/popular`, () => {
    return HttpResponse.json(envelope(emptyWorkList));
  }),
  http.get(`${API_BASE}/discover/recommend`, () => {
    return HttpResponse.json(envelope(emptyWorkList));
  }),
  http.get(`${API_BASE}/discover/works/:sourceId/neighbors`, () => {
    return HttpResponse.json(envelope(emptyWorkList));
  }),
  http.post(`${API_BASE}/discover/feedback`, () => {
    return HttpResponse.json(envelope({ sent: true }));
  }),
  http.put(`${API_BASE}/playback/progress`, () => {
    return HttpResponse.json(envelope({ saved: true }));
  }),
  http.get(`${API_BASE}/playback/progress/latest`, () => {
    return HttpResponse.json(envelope({ items: [] }));
  }),
  http.get(`${API_BASE}/playback/progress/:sourceId`, () => {
    return HttpResponse.json(
      { code: "NOT_FOUND", message: "no playback progress", data: null },
      { status: 404 },
    );
  }),
];

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Queue } from "./Queue";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Tasks screen", () => {
  it("renders loading state", () => {
    vi.spyOn(apiClient, "getTasks").mockImplementation(
      () => new Promise(() => {}),
    );

    const queryClient = new QueryClient();
    const view = render(
      <QueryClientProvider client={queryClient}>
        <Queue />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/loading queue/i)).toBeInTheDocument();
    view.unmount();
    queryClient.clear();
  });
});

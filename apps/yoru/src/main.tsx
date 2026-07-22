import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { router } from "./routes/router";
import { initPlatform } from "./lib/platform";
import "./styles/index.css";

// bootstrap 平台检测:?desktop=1 → data-platform="desktop"(详见 lib/platform.ts)
initPlatform();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        closeButton
        expand
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--panelSolid)",
            color: "var(--ink)",
            border: "1.5px solid var(--line)",
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);

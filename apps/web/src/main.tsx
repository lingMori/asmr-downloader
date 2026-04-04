import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TaskRealtimeBridge } from "./components/TaskRealtimeBridge";
import { router } from "./routes/router";
import "./styles/index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TaskRealtimeBridge />
      <RouterProvider router={router} />
      <Toaster closeButton expand richColors position="top-right" />
    </QueryClientProvider>
  </StrictMode>
);

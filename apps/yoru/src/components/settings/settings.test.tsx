import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ConfigResponse } from "@/lib/api";
import { apiClient } from "@/lib/api";
import { SettingsProvider } from "@/lib/settings";
import { SettingsScreen } from "@/routes/screens/Settings";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/api", () => ({
  apiClient: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getAuthStatus: vi.fn(),
    checkAuth: vi.fn(),
    loginAuth: vi.fn(),
    getHealth: vi.fn(),
  },
}));

const mocked = vi.mocked(apiClient);

const baseConfig: ConfigResponse = {
  user: { account: "guest", password: "***" },
  downloader: {
    api_url: "https://api.asmr-300.com",
    proxy_url: "",
    sync_data_folder: "./syncdata",
    prefer_media: "all",
    max_workers: 5,
    max_retries: 3,
    http: {
      user_agent: "UA",
      origin: "https://asmr.one",
      referer: "https://asmr.one/",
      accept_language: "en-US",
      sec_ch_ua: "",
      sec_ch_ua_platform: "",
      extra: {},
    },
  },
  limit: {
    sync_qps: 2,
    download_qps: 0.2,
    sync_jitter_min: 100,
    sync_jitter_max: 500,
    download_jitter_min: 2000,
    download_jitter_max: 5000,
  },
  auth: { state: "success", message: "已登录" },
};

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <SettingsScreen />
      </SettingsProvider>
    </QueryClientProvider>,
  );
}

describe("设置页", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.palette;
    delete document.documentElement.dataset.stickers;
    mocked.getConfig.mockResolvedValue(baseConfig);
    mocked.updateConfig.mockResolvedValue(baseConfig);
    mocked.getAuthStatus.mockResolvedValue({ state: "success", message: "已登录" });
    mocked.checkAuth.mockResolvedValue({ state: "success", message: "已登录" });
    mocked.loginAuth.mockResolvedValue({ state: "success", message: "登录成功" });
    mocked.getHealth.mockResolvedValue({ status: "ok", version: "2.0.0", time: "" });
  });

  it("主题/palette 切换即时生效并持久化", async () => {
    renderScreen();
    await screen.findByText("下载 · だうんろーど");

    fireEvent.click(screen.getByRole("radio", { name: /デイモード/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(
      JSON.parse(window.localStorage.getItem("yoru:settings")!),
    ).toMatchObject({ theme: "light" });

    fireEvent.click(screen.getByRole("radio", { name: "配色 ブルー" }));
    expect(document.documentElement.dataset.palette).toBe("blue");
    expect(
      JSON.parse(window.localStorage.getItem("yoru:settings")!),
    ).toMatchObject({ palette: "blue" });

    fireEvent.click(screen.getByRole("switch", { name: "贴纸徽章" }));
    expect(document.documentElement.dataset.stickers).toBe("false");
  });

  it("并发步进保存:updateConfig 只带改动字段 + 合并保护底(不含 user)", async () => {
    renderScreen();
    const group = await screen.findByRole("group", { name: "并发任务数" });
    fireEvent.click(within(group).getByLabelText("增加")); // 5 → 6
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mocked.updateConfig).toHaveBeenCalledTimes(1));
    const payload = mocked.updateConfig.mock.calls[0][0];
    expect(payload).toEqual({
      downloader: {
        proxy_url: "",
        max_retries: 3,
        http: baseConfig.downloader.http,
        max_workers: 6,
      },
      limit: baseConfig.limit,
    });
    expect(payload).not.toHaveProperty("user");
  });

  it("保存账号触发 CONFIG_AUTH_FAILED → 粉色错误条显示 message", async () => {
    mocked.updateConfig.mockRejectedValue(new Error("CONFIG_AUTH_FAILED: 账号或密码错误"));
    renderScreen();
    await screen.findByText("数据源 · みらー");

    fireEvent.change(screen.getByLabelText("账号"), { target: { value: "someone" } });
    fireEvent.click(screen.getByRole("button", { name: "保存并重新登录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CONFIG_AUTH_FAILED: 账号或密码错误",
    );
    expect(mocked.loginAuth).not.toHaveBeenCalled();
    // 合并语义:只带 user + 保护底
    const payload = mocked.updateConfig.mock.calls[0][0];
    expect(payload.user).toEqual({ account: "someone" });
    expect(payload.downloader).not.toHaveProperty("api_url");
  });

  it("账号未改 → 仅 loginAuth,不调 updateConfig", async () => {
    renderScreen();
    await screen.findByText("数据源 · みらー");

    fireEvent.click(screen.getByRole("button", { name: "保存并重新登录" }));
    await waitFor(() => expect(mocked.loginAuth).toHaveBeenCalledTimes(1));
    expect(mocked.updateConfig).not.toHaveBeenCalled();
  });

  it("连接状态 error → 红点 + message 回显", async () => {
    mocked.getAuthStatus.mockResolvedValue({ state: "error", message: "认证失败,请重新登录" });
    renderScreen();
    expect(await screen.findByText("认证失败,请重新登录")).toBeInTheDocument();
  });

  it("config 加载失败 → 错误条 + 重试成功", async () => {
    mocked.getConfig.mockRejectedValueOnce(new Error("网络不可达"));
    renderScreen();
    expect(await screen.findByRole("alert")).toHaveTextContent("配置加载失败:网络不可达");

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("下载 · だうんろーど")).toBeInTheDocument();
  });
});

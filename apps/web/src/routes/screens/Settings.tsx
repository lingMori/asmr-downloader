import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BracketsCurly, Gauge, HardDrives, Plug, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionReviewDialog, DeckDialog, type ReviewRow } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader, RouteFeedback } from "@/components/ui/sweet";
import { apiClient, type AuthStatus, type ConfigResponse } from "@/lib/api";

type SaveIntent = "settings" | "login";
type SettingsSection = "connection" | "storage" | "performance" | "advanced";
type DownloaderConfig = ConfigResponse["downloader"];
type HTTPConfig = NonNullable<DownloaderConfig["http"]>;
type ConnectionDraft = {
  account: string;
  password: string;
  apiUrl: string;
  proxyUrl: string;
};

const settingsSections = [
  { id: "connection", label: "连接", description: "账号与远端 API", icon: Plug },
  { id: "storage", label: "存储", description: "目录与媒体格式", icon: HardDrives },
  { id: "performance", label: "性能", description: "并发与请求节奏", icon: Gauge },
  { id: "advanced", label: "高级请求头", description: "HTTP 请求标头", icon: BracketsCurly },
] as const;

export function Settings() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiClient.getConfig(),
  });
  const authLiveQuery = useQuery({
    queryKey: ["auth", "live-check"],
    queryFn: () => apiClient.checkAuth(),
    enabled: configQuery.isSuccess,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: false,
  });
  const [form, setForm] = useState<ConfigResponse | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [reviewConnectionDraft, setReviewConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [lastAuthCheckedAt, setLastAuthCheckedAt] = useState("");
  const [activeSection, setActiveSection] = useState<SettingsSection>("connection");

  useEffect(() => {
    if (configQuery.data) {
      setForm((previous) => previous ?? toEditableConfig(configQuery.data));
    }
  }, [configQuery.data]);

  useEffect(() => {
    const auth = authLiveQuery.data;
    if (!auth) {
      return;
    }
    setForm((prev) => (prev ? { ...prev, auth } : prev));
    queryClient.setQueryData<ConfigResponse | undefined>(["settings"], (prev) =>
      prev ? { ...prev, auth } : prev,
    );
    setLastAuthCheckedAt(formatCheckTime(new Date()));
  }, [authLiveQuery.data, queryClient]);

  const dirty = useMemo(
    () => Boolean(form && configQuery.data && configFingerprint(form) !== configFingerprint(configQuery.data)),
    [form, configQuery.data],
  );
  const validationErrors = useMemo(() => (form ? validateSettings(form) : []), [form]);

  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);

  const applyAuthStatus = (auth: AuthStatus) => {
    setForm((prev) => (prev ? { ...prev, auth } : prev));
    queryClient.setQueryData<ConfigResponse | undefined>(["settings"], (prev) =>
      prev ? { ...prev, auth } : prev,
    );
    setLastAuthCheckedAt(formatCheckTime(new Date()));
  };

  const saveMutation = useMutation({
    mutationFn: ({ payload }: { payload: ConfigResponse; intent: SaveIntent }) =>
      apiClient.updateConfig(payload),
    onSuccess: (data, variables) => {
      const editableData = toEditableConfig(data);
      setForm(editableData);
      queryClient.setQueryData(["settings"], editableData);
      if (variables.intent === "login") {
        if (data.auth?.state === "success") {
          toast.success("账号已连接，配置也已保存");
        } else if (data.auth?.state === "error") {
          toast.error(data.auth.message || "配置已保存，但账号连接失败");
        } else {
          toast.success("配置已保存，正在等待登录状态");
        }
        return;
      }

      if (data.auth?.state === "error") {
        toast.error(data.auth.message || "设置已保存，但账号连接失败");
      } else {
        toast.success("设置已保存");
      }
    },
    onError: (error, variables) => {
      toast.error(
        `${variables.intent === "login" ? "账号连接失败" : "保存设置失败"}：${formatErrorMessage(error)}`,
      );
    },
  });
  const authLoginMutation = useMutation({
    mutationFn: () => apiClient.loginAuth(),
    onSuccess: (auth) => {
      applyAuthStatus(auth);
      if (auth.state === "success") {
        toast.success(auth.message || "重新登录成功");
      } else {
        toast.error(auth.message || "重新登录失败");
      }
    },
    onError: (error) => {
      toast.error(`重新登录失败：${formatErrorMessage(error)}`);
    },
  });
  const isAuthActionBusy =
    saveMutation.isPending ||
    authLoginMutation.isPending;

  function openConnectionEditor() {
    if (!form) {
      return;
    }
    setConnectionDraft(connectionDraftFromConfig(form));
  }

  function confirmConnectionSave() {
    if (!form || !reviewConnectionDraft) {
      return;
    }
    saveMutation.mutate(
      {
        payload: applyConnectionDraft(form, reviewConnectionDraft),
        intent: "login",
      },
      {
        onSuccess: () => {
          setConnectionDraft(null);
          setReviewConnectionDraft(null);
        },
      },
    );
  }

  if (configQuery.isError) {
    return (
      <RouteFeedback
        tone="halt"
        title="配置加载失败"
        description={`没有拿到本地配置。请确认后端服务正在运行，或检查 API 地址。${configQuery.error ? `错误信息：${formatErrorMessage(configQuery.error)}` : ""}`}
        action={
          <Button variant="secondary" onClick={() => void configQuery.refetch()}>
            重新加载配置
          </Button>
        }
      />
    );
  }

  if (configQuery.isLoading || !form) {
    return (
      <RouteFeedback
        title="正在读取配置"
        description="正在连接本地后端，读取账号连接、下载目录、限流和请求头设置。"
      />
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        kicker="设置"
        title="设置"
        description="管理账号连接、下载目录、媒体偏好、限流和请求头。"
        meta={
          <div className="flex flex-col items-start gap-2 md:items-end">
            {form.auth ? (
              <Badge variant={authBadgeVariant(form.auth.state)}>
                {authLabel(form.auth.state)}
              </Badge>
            ) : null}
            <span className="console-mono text-xs text-[color:var(--text-mute)]">
              配置写入 .asmroner-data/config.toml
            </span>
          </div>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="deck-chassis p-2 lg:sticky lg:top-24">
          <nav
            className="grid grid-cols-2 gap-1 lg:grid-cols-1"
            aria-label="设置分区"
          >
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const selected = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-pressed={selected}
                  className={`flex min-w-0 items-start gap-2.5 border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tape-pink)] ${
                    selected
                      ? "border-[color:var(--tape-pink)] bg-[color:var(--surface-elevated)] text-[color:var(--text-display)]"
                      : "border-transparent text-[color:var(--text-body)] hover:border-[color:var(--chassis-edge)] hover:bg-[color:var(--surface-elevated)]"
                  }`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" weight={selected ? "fill" : "regular"} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{section.label}</span>
                    <span className="mt-0.5 hidden text-xs text-[color:var(--text-mute)] lg:block">
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-2 border-t border-[color:var(--chassis-edge)] px-2 pt-3">
            <Badge variant={validationErrors.length > 0 ? "halt" : dirty ? "warn" : "signal"}>
              {validationErrors.length > 0
                ? `${validationErrors.length} 项待修正`
                : dirty
                  ? "有未保存修改"
                  : "设置已保存"}
            </Badge>
          </div>
        </aside>

        <div className="min-w-0">
          <div
            id={`settings-panel-${activeSection}`}
            role="region"
            aria-label={`${settingsSections.find((section) => section.id === activeSection)?.label ?? "当前"}设置`}
          >
            {activeSection === "connection" ? (
              <FormSection
                title="账号连接"
                hint="连接 ASMR.one API。后端会自动检查登录是否有效，只有失效时才需要重新登录。"
              >
                <AuthStatusPanel
                  auth={form.auth}
                  account={form.user.account}
                  apiUrl={form.downloader.api_url || ""}
                  checking={authLiveQuery.isFetching}
                  lastCheckedAt={lastAuthCheckedAt}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  {form.auth?.state === "error" ? (
                    <Button
                      busy={authLoginMutation.isPending}
                      onClick={() => authLoginMutation.mutate()}
                      disabled={isAuthActionBusy}
                    >
                      重新登录
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    onClick={openConnectionEditor}
                    disabled={isAuthActionBusy}
                  >
                    编辑连接信息
                  </Button>
                </div>
              </FormSection>
            ) : null}

            {activeSection === "storage" ? (
              <FormSection
                title="存储与媒体"
                hint="设置文件落地位置、目标容量与音频格式偏好。"
              >
                <LabeledField label="同步目录">
                  <Input
                    value={form.downloader.sync_data_folder}
                    aria-label="同步目录"
                    onChange={(event) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              downloader: {
                                ...prev.downloader,
                                sync_data_folder: event.target.value,
                              },
                            }
                          : prev,
                      )
                    }
                  />
                </LabeledField>
                <LabeledField label="优先音频格式">
                  <Select
                    value={form.downloader.prefer_media}
                    aria-label="优先音频格式"
                    onChange={(event) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              downloader: {
                                ...prev.downloader,
                                prefer_media: event.target.value,
                              },
                            }
                          : prev,
                      )
                    }
                  >
                    <option value="all">保留全部格式</option>
                    <option value="mp3">仅 MP3</option>
                    <option value="wav">仅 WAV</option>
                    <option value="flac">仅 FLAC</option>
                    <option value="mp3&gt;wav&gt;flac">MP3 优先，其次 WAV / FLAC</option>
                    <option value="flac&gt;wav&gt;mp3">FLAC 优先，其次 WAV / MP3</option>
                  </Select>
                </LabeledField>
                <SizeField
                  value={form.downloader.sync_wanted_size || ""}
                  onChange={(value) => updateDownloader(setForm, "sync_wanted_size", value)}
                />
              </FormSection>
            ) : null}

            {activeSection === "performance" ? (
              <FormSection
                title="并发与限流"
                hint="控制后台并发、重试和请求节奏。数值越高并不一定越稳定。"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <NumberField
                    label="最大并发数"
                    value={form.downloader.max_workers ?? 0}
                    onChange={(value) => updateDownloader(setForm, "max_workers", value)}
                  />
                  <NumberField
                    label="最大重试次数"
                    value={form.downloader.max_retries ?? 0}
                    onChange={(value) => updateDownloader(setForm, "max_retries", value)}
                  />
                  <FloatField
                    label="同步 QPS"
                    value={form.limit.sync_qps}
                    onChange={(value) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, limit: { ...prev.limit, sync_qps: value } }
                          : prev,
                      )
                    }
                  />
                  <FloatField
                    label="下载 QPS"
                    value={form.limit.download_qps}
                    onChange={(value) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, limit: { ...prev.limit, download_qps: value } }
                          : prev,
                      )
                    }
                  />
                  <NumberField
                    label="同步抖动最小值"
                    value={form.limit.sync_jitter_min ?? 0}
                    onChange={(value) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, limit: { ...prev.limit, sync_jitter_min: value } }
                          : prev,
                      )
                    }
                  />
                  <NumberField
                    label="同步抖动最大值"
                    value={form.limit.sync_jitter_max ?? 0}
                    onChange={(value) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, limit: { ...prev.limit, sync_jitter_max: value } }
                          : prev,
                      )
                    }
                  />
                  <NumberField
                    label="下载抖动最小值"
                    value={form.limit.download_jitter_min ?? 0}
                    onChange={(value) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, limit: { ...prev.limit, download_jitter_min: value } }
                          : prev,
                      )
                    }
                  />
                  <NumberField
                    label="下载抖动最大值"
                    value={form.limit.download_jitter_max ?? 0}
                    onChange={(value) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, limit: { ...prev.limit, download_jitter_max: value } }
                          : prev,
                      )
                    }
                  />
                </div>
              </FormSection>
            ) : null}

            {activeSection === "advanced" ? (
              <FormSection
                title="高级请求头"
                hint="仅在远端接口要求特定浏览器请求头时修改。空值会使用后端默认值。"
              >
                <HeaderFields
                  value={form.downloader.http ?? {}}
                  onChange={(http) => updateDownloader(setForm, "http", http)}
                />
              </FormSection>
            ) : null}
          </div>

          <div
            className={`settings-save-bar z-20 mt-4 flex flex-wrap items-center justify-between gap-3 border p-3 md:sticky ${
              dirty
                ? "border-[color:var(--tape-pink)] bg-[color:var(--surface-elevated)]"
                : "border-[color:var(--chassis-edge)] bg-[color:var(--surface-section)]"
            }`}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant={validationErrors.length > 0 ? "halt" : dirty ? "warn" : "signal"}>
                {validationErrors.length > 0
                  ? `${validationErrors.length} 项需要修正`
                  : dirty
                    ? "有未保存修改"
                    : "设置已保存"}
              </Badge>
              {validationErrors[0] ? (
                <span className="text-sm text-[color:var(--text-body)]">{validationErrors[0]}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={dirty ? "primary" : "secondary"}
                busy={saveMutation.isPending}
                onClick={() => saveMutation.mutate({ payload: form, intent: "settings" })}
                disabled={isAuthActionBusy || !dirty || validationErrors.length > 0}
              >
                保存全部设置
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (configQuery.data) {
                    setForm(toEditableConfig(configQuery.data));
                  }
                }}
                disabled={isAuthActionBusy || !dirty}
              >
                放弃未保存修改
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConnectionEditorDialog
        draft={connectionDraft}
        busy={isAuthActionBusy}
        onDraftChange={setConnectionDraft}
        onOpenChange={(open) => {
          if (!open && !isAuthActionBusy) {
            setConnectionDraft(null);
          }
        }}
        onReview={() => {
          if (connectionDraft) {
            setReviewConnectionDraft(connectionDraft);
            setConnectionDraft(null);
          }
        }}
      />
      <ActionReviewDialog
        open={Boolean(reviewConnectionDraft)}
        onOpenChange={(open) => {
          if (!open && !saveMutation.isPending) {
            setConnectionDraft(reviewConnectionDraft);
            setReviewConnectionDraft(null);
          }
        }}
        title="确认保存连接信息"
        description="保存后后端会使用这组连接信息重新登录，后续搜索、同步和下载都会使用新的授权状态。"
        rows={
          reviewConnectionDraft
            ? buildConnectionReviewRows(reviewConnectionDraft)
            : []
        }
        warning="如果账号、API 地址或代理填写错误，当前登录状态会变为失败；密码留空时不会覆盖已保存密码。"
        confirmLabel="保存并重新登录"
        busy={saveMutation.isPending}
        onConfirm={confirmConnectionSave}
      />
    </section>
  );
}

function toEditableConfig(config: ConfigResponse): ConfigResponse {
  return {
    ...config,
    user: {
      ...config.user,
      password: "",
    },
  };
}

function connectionDraftFromConfig(config: ConfigResponse): ConnectionDraft {
  return {
    account: config.user.account,
    password: "",
    apiUrl: config.downloader.api_url || "",
    proxyUrl: config.downloader.proxy_url || "",
  };
}

function applyConnectionDraft(
  config: ConfigResponse,
  draft: ConnectionDraft,
): ConfigResponse {
  return {
    ...config,
    user: {
      ...config.user,
      account: draft.account.trim(),
      password: draft.password,
    },
    downloader: {
      ...config.downloader,
      api_url: draft.apiUrl.trim(),
      proxy_url: draft.proxyUrl.trim(),
    },
  };
}

function buildConnectionReviewRows(draft: ConnectionDraft): ReviewRow[] {
  return [
    {
      label: "账号",
      value: draft.account.trim() || "未填写",
    },
    {
      label: "远端 API",
      value: draft.apiUrl.trim() || "未填写",
    },
    {
      label: "代理",
      value: draft.proxyUrl.trim() || "不使用代理",
    },
    {
      label: "密码",
      value: draft.password.trim() ? (
        <Badge variant="warn">将替换已保存密码</Badge>
      ) : (
        <Badge variant="mute">保持已保存密码</Badge>
      ),
    },
  ];
}

function ConnectionEditorDialog({
  draft,
  busy,
  onDraftChange,
  onOpenChange,
  onReview,
}: {
  draft: ConnectionDraft | null;
  busy: boolean;
  onDraftChange: (draft: ConnectionDraft | null) => void;
  onOpenChange: (open: boolean) => void;
  onReview: () => void;
}) {
  if (!draft) {
    return null;
  }

  return (
    <DeckDialog
      open={Boolean(draft)}
      onOpenChange={onOpenChange}
      kicker="Connection"
      title="编辑账号连接"
      description="这些信息决定后端如何连接 ASMR.one。密码默认不显示，只有输入新密码时才会替换已保存密码。"
      tone="signal"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={onReview}
            disabled={busy}
          >
            复核并继续
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="border border-[color:var(--chassis-edge)] bg-[color:var(--surface-elevated)] p-4 text-sm leading-6 text-[color:var(--text-body)]">
          编辑连接信息不会立刻生效。下一步会先展示复核面板，确认后才保存并重新登录。
        </div>
        <LabeledField label="ASMR.one 账号">
          <Input
            autoComplete="username"
            placeholder="输入 ASMR.one 账号"
            aria-label="ASMR.one 账号"
            value={draft.account}
            onChange={(event) =>
              onDraftChange({ ...draft, account: event.target.value })
            }
          />
        </LabeledField>
        <LabeledField label="ASMR.one 新密码">
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="保持空白则不修改已保存密码"
            aria-label="ASMR.one 新密码"
            value={draft.password}
            onChange={(event) =>
              onDraftChange({ ...draft, password: event.target.value })
            }
          />
        </LabeledField>
        <LabeledField label="远端 API 地址">
          <Input
            placeholder="https://api.asmr.one"
            aria-label="远端 API 地址"
            value={draft.apiUrl}
            onChange={(event) =>
              onDraftChange({ ...draft, apiUrl: event.target.value })
            }
          />
        </LabeledField>
        <LabeledField label="代理地址">
          <Input
            placeholder="可选，例如 http://127.0.0.1:7890"
            aria-label="代理地址"
            value={draft.proxyUrl}
            onChange={(event) =>
              onDraftChange({ ...draft, proxyUrl: event.target.value })
            }
          />
        </LabeledField>
      </div>
    </DeckDialog>
  );
}

function AuthStatusPanel({
  auth,
  account,
  apiUrl,
  checking,
  lastCheckedAt,
}: {
  auth?: ConfigResponse["auth"];
  account: string;
  apiUrl: string;
  checking?: boolean;
  lastCheckedAt?: string;
}) {
  const state = auth?.state ?? "unknown";

  return (
    <div className="space-y-4 border border-[color:var(--chassis-edge)] bg-[color:var(--surface-elevated)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-[color:var(--text-mute)]">当前连接</div>
          <div className="mt-1 text-lg font-semibold text-[color:var(--text-display)]">
            {authHeadline(state)}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {checking ? <Badge variant="live">检查中</Badge> : null}
          <Badge variant={authBadgeVariant(state)}>{authLabel(state)}</Badge>
        </div>
      </div>
      <p className="text-sm leading-6 text-[color:var(--text-body)]">
        {auth?.message || authDescription(state)}
      </p>
      <div className="grid gap-2 text-xs text-[color:var(--text-mute)]">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="shrink-0">账号</span>
          <span className="min-w-0 truncate text-[color:var(--text-display)]">
            {account || "未填写"}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="shrink-0">接口</span>
          <span className="min-w-0 truncate text-[color:var(--text-display)]">
            {apiUrl || "未填写"}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="shrink-0">最近检查</span>
          <span className="min-w-0 truncate text-[color:var(--text-display)]">
            {lastCheckedAt || "等待检查"}
          </span>
        </div>
      </div>
    </div>
  );
}

function authBadgeVariant(state: string) {
  switch (state) {
    case "success":
      return "signal" as const;
    case "error":
      return "halt" as const;
    default:
      return "mute" as const;
  }
}

function authLabel(state: string) {
  switch (state) {
    case "success":
      return "已登录";
    case "error":
      return "登录失败";
    default:
      return "未确认";
  }
}

function authHeadline(state: string) {
  switch (state) {
    case "success":
      return "账号已连接";
    case "error":
      return "账号连接失败";
    default:
      return "尚未确认账号";
  }
}

function authDescription(state: string) {
  switch (state) {
    case "success":
      return "后端已经拿到远端接口授权，并会在设置页停留期间自动检查状态。";
    case "error":
      return "登录状态已不可用。确认连接信息无误后，点击重新登录恢复搜索、同步和下载。";
    default:
      return "正在等待后台检测；检测完成后会自动更新这里的连接状态。";
  }
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function formatCheckTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function configFingerprint(config: ConfigResponse) {
  return JSON.stringify({
    user: { account: config.user.account },
    downloader: config.downloader,
    limit: config.limit,
  });
}

function validateSettings(config: ConfigResponse) {
  const errors: string[] = [];
  if (!config.downloader.sync_data_folder.trim()) errors.push("同步目录不能为空");
  if (!/^\d+(MB|GB|TB|PB)$/.test((config.downloader.sync_wanted_size || "").trim())) {
    errors.push("目标容量需要使用整数加 MB、GB、TB 或 PB");
  }
  if ((config.downloader.max_workers ?? 0) <= 0) errors.push("最大并发数必须大于 0");
  if ((config.downloader.max_retries ?? 0) < 0) errors.push("最大重试次数不能小于 0");
  if (config.limit.sync_qps <= 0 || config.limit.download_qps <= 0) errors.push("QPS 必须大于 0");
  if ((config.limit.sync_jitter_min ?? 0) > (config.limit.sync_jitter_max ?? 0)) {
    errors.push("同步抖动最大值不能小于最小值");
  }
  if ((config.limit.download_jitter_min ?? 0) > (config.limit.download_jitter_max ?? 0)) {
    errors.push("下载抖动最大值不能小于最小值");
  }
  return errors;
}

function updateDownloader<K extends keyof DownloaderConfig>(
  setForm: Dispatch<SetStateAction<ConfigResponse | null>>,
  key: K,
  value: DownloaderConfig[K],
) {
  setForm((previous) => previous ? {
    ...previous,
    downloader: { ...previous.downloader, [key]: value },
  } : previous);
}

function SizeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const match = value.trim().match(/^(\d+)(MB|GB|TB|PB)$/);
  const amount = match?.[1] ?? value.replace(/\D/g, "");
  const unit = match?.[2] ?? "GB";

  return (
    <LabeledField label="目标容量">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <Input
          type="number"
          min={1}
          value={amount}
          aria-label="目标容量数值"
          onChange={(event) => onChange(`${event.target.value}${unit}`)}
        />
        <Select
          value={unit}
          aria-label="目标容量单位"
          onChange={(event) => onChange(`${amount || "0"}${event.target.value}`)}
        >
          <option value="MB">MB</option>
          <option value="GB">GB</option>
          <option value="TB">TB</option>
          <option value="PB">PB</option>
        </Select>
      </div>
    </LabeledField>
  );
}

function HeaderFields({ value, onChange }: { value: HTTPConfig; onChange: (value: HTTPConfig) => void }) {
  const standardFields: Array<[keyof Omit<HTTPConfig, "extra">, string]> = [
    ["user_agent", "User-Agent"],
    ["origin", "Origin"],
    ["referer", "Referer"],
    ["accept_language", "Accept-Language"],
    ["sec_ch_ua", "Sec-CH-UA"],
    ["sec_ch_ua_platform", "Sec-CH-UA-Platform"],
  ];
  const extras = Object.entries(value.extra ?? {});

  const updateExtra = (index: number, key: string, fieldValue: string) => {
    const entries = extras.map((entry, entryIndex) => entryIndex === index ? [key, fieldValue] : entry);
    onChange({ ...value, extra: Object.fromEntries(entries.filter(([name]) => name.trim())) });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {standardFields.map(([field, label]) => (
          <LabeledField key={field} label={label}>
            <Input
              value={value[field] ?? ""}
              aria-label={label}
              onChange={(event) => onChange({ ...value, [field]: event.target.value })}
            />
          </LabeledField>
        ))}
      </div>
      <div className="space-y-3 border-t border-[color:var(--chassis-edge)] pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-[color:var(--text-display)]">附加请求头</div>
            <p className="mt-1 text-sm text-[color:var(--text-body)]">用于少量服务端要求的自定义键值。</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange({ ...value, extra: { ...(value.extra ?? {}), "": "" } })}>
            <Plus className="h-4 w-4" /> 添加
          </Button>
        </div>
        {extras.map(([name, fieldValue], index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_44px]">
            <Input
              value={name}
              placeholder="请求头名称"
              aria-label={`附加请求头 ${index + 1} 名称`}
              onChange={(event) => updateExtra(index, event.target.value, fieldValue)}
            />
            <Input
              value={fieldValue}
              placeholder="请求头值"
              aria-label={`附加请求头 ${index + 1} 值`}
              onChange={(event) => updateExtra(index, name, event.target.value)}
            />
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="h-11 w-11 px-0"
              title="删除请求头"
              aria-label="删除请求头"
              onClick={() => onChange({ ...value, extra: Object.fromEntries(extras.filter((_, entryIndex) => entryIndex !== index)) })}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="deck-chassis overflow-hidden">
      <header className="space-y-2 border-b border-[color:var(--chassis-edge)] p-4">
        <h2 className="text-base font-semibold text-[color:var(--text-display)]">{title}</h2>
        <p className="text-sm leading-6 text-[color:var(--text-body)]">{hint}</p>
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-[color:var(--text-display)]">{label}</div>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <LabeledField label={label}>
      <Input
        type="number"
        value={String(value)}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </LabeledField>
  );
}

function FloatField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <LabeledField label={label}>
      <Input
        type="number"
        step="0.1"
        value={String(value)}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </LabeledField>
  );
}

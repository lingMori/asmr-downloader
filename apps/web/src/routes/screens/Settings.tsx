import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionReviewDialog, DeckDialog, type ReviewRow } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader, RouteFeedback, fadeUpItem, staggerContainer } from "@/components/ui/sweet";
import { apiClient, type AuthStatus, type ConfigResponse } from "@/lib/api";

type SaveIntent = "settings" | "login";
type ConnectionDraft = {
  account: string;
  password: string;
  apiUrl: string;
  proxyUrl: string;
};

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

  useEffect(() => {
    if (configQuery.data) {
      setForm(toEditableConfig(configQuery.data));
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
    <motion.section
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="设置"
          title="设置"
          description="管理账号连接、下载目录、媒体偏好、限流和请求头。"
          meta={
            <div className="deck-screen space-y-3 p-4">
              <Badge variant="warn">配置中心</Badge>
              <div className="text-sm text-[color:var(--text-body)]">
                修改会持久化到 `.asmroner-data/config.toml`
              </div>
              {form.auth ? (
                <Badge variant={authBadgeVariant(form.auth.state)}>
                  {authLabel(form.auth.state)}: {form.auth.message}
                </Badge>
              ) : null}
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-3">
        <FormSection
          title="账号连接"
          hint="连接 ASMR.one API。后端会自动检查登录是否有效，只有失效时才需要重新登录。"
          badges={
            <>
              <Badge variant="decal">ASMR.one</Badge>
              <Badge variant="live">连接状态</Badge>
              {form.auth ? (
                <Badge variant={authBadgeVariant(form.auth.state)}>
                  {authLabel(form.auth.state)}
                </Badge>
              ) : null}
            </>
          }
        >
          <AuthStatusPanel
            auth={form.auth}
            account={form.user.account}
            apiUrl={form.downloader.api_url || ""}
            checking={authLiveQuery.isFetching}
            lastCheckedAt={lastAuthCheckedAt}
          />
          <div className="grid gap-2">
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
              className="w-full"
              onClick={openConnectionEditor}
              disabled={isAuthActionBusy}
            >
              编辑连接信息
            </Button>
          </div>
        </FormSection>

        <FormSection
          title="下载器"
          hint="本地保存位置、并发数量、重试次数和媒体格式偏好。"
          badges={
            <>
              <Badge variant="signal">本地目录</Badge>
              <Badge variant="warn">下载</Badge>
            </>
          }
        >
          <LabeledField label="同步目录">
            <Input
              value={form.downloader.sync_data_folder}
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
            <Input
              value={form.downloader.prefer_media}
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
            />
          </LabeledField>
          <NumberField
            label="最大并发数"
            value={form.downloader.max_workers ?? 0}
            onChange={(value) =>
              setForm((prev) =>
                prev
                  ? {
                      ...prev,
                      downloader: {
                        ...prev.downloader,
                        max_workers: value,
                      },
                    }
                  : prev,
              )
            }
          />
          <NumberField
            label="最大重试次数"
            value={form.downloader.max_retries ?? 0}
            onChange={(value) =>
              setForm((prev) =>
                prev
                  ? {
                      ...prev,
                      downloader: {
                        ...prev.downloader,
                        max_retries: value,
                      },
                    }
                  : prev,
              )
            }
          />
          <LabeledField label="目标容量">
            <Input
              value={form.downloader.sync_wanted_size || ""}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        downloader: {
                          ...prev.downloader,
                          sync_wanted_size: event.target.value,
                        },
                      }
                    : prev,
                )
              }
            />
          </LabeledField>
        </FormSection>

        <FormSection
          title="限流参数"
          hint="QPS 与抖动窗口控制访问节奏。"
          badges={
            <>
              <Badge variant="warn">限流</Badge>
              <Badge variant="signal">节奏</Badge>
            </>
          }
        >
          <FloatField
            label="同步 QPS"
            value={form.limit.sync_qps}
            onChange={(value) =>
              setForm((prev) =>
                prev
                  ? {
                      ...prev,
                      limit: {
                        ...prev.limit,
                        sync_qps: value,
                      },
                    }
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
                  ? {
                      ...prev,
                      limit: {
                        ...prev.limit,
                        download_qps: value,
                      },
                    }
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
                  ? {
                      ...prev,
                      limit: {
                        ...prev.limit,
                        sync_jitter_min: value,
                      },
                    }
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
                  ? {
                      ...prev,
                      limit: {
                        ...prev.limit,
                        sync_jitter_max: value,
                      },
                    }
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
                  ? {
                      ...prev,
                      limit: {
                        ...prev.limit,
                        download_jitter_min: value,
                      },
                    }
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
                  ? {
                      ...prev,
                      limit: {
                        ...prev.limit,
                        download_jitter_max: value,
                      },
                    }
                  : prev,
              )
            }
          />
        </FormSection>
      </motion.div>

      <motion.div variants={fadeUpItem} className="flex flex-wrap gap-3">
        <Button
          busy={saveMutation.isPending}
          onClick={() => saveMutation.mutate({ payload: form, intent: "settings" })}
          disabled={isAuthActionBusy}
        >
          保存全部设置
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (configQuery.data) {
              setForm(toEditableConfig(configQuery.data));
            }
          }}
          disabled={isAuthActionBusy}
        >
          放弃未保存修改
        </Button>
      </motion.div>

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
          }
        }}
      />
      <ActionReviewDialog
        open={Boolean(reviewConnectionDraft)}
        onOpenChange={(open) => {
          if (!open && !saveMutation.isPending) {
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
    </motion.section>
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
        <div className="deck-screen p-4 text-sm leading-6 text-[color:var(--text-body)]">
          编辑连接信息不会立刻生效。下一步会先展示复核面板，确认后才保存并重新登录。
        </div>
        <LabeledField label="ASMR.one 账号">
          <Input
            autoComplete="username"
            placeholder="输入 ASMR.one 账号"
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
            value={draft.password}
            onChange={(event) =>
              onDraftChange({ ...draft, password: event.target.value })
            }
          />
        </LabeledField>
        <LabeledField label="远端 API 地址">
          <Input
            placeholder="https://api.asmr.one"
            value={draft.apiUrl}
            onChange={(event) =>
              onDraftChange({ ...draft, apiUrl: event.target.value })
            }
          />
        </LabeledField>
        <LabeledField label="代理地址">
          <Input
            placeholder="可选，例如 http://127.0.0.1:7890"
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
    <div className="deck-screen space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="deck-decal">当前连接</div>
          <div className="console-title mt-3 text-xl font-black text-[color:var(--text-display)]">
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

function FormSection({
  title,
  hint,
  badges,
  children,
}: {
  title: string;
  hint: string;
  badges?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card foil className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <div className="flex flex-wrap gap-2">{badges}</div>
        </div>
        <p className="text-sm leading-6 text-[color:var(--text-body)]">{hint}</p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
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
      <div className="deck-decal">{label}</div>
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
      <div className="grid gap-2 sm:grid-cols-[6rem_1fr]">
        <div className="deck-screen flex items-center justify-center px-3">
          <span className="console-readout text-lg">{value}</span>
        </div>
        <Input
          type="number"
          value={String(value)}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
      </div>
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
      <div className="grid gap-2 sm:grid-cols-[6rem_1fr]">
        <div className="deck-screen flex items-center justify-center px-3">
          <span className="console-readout text-lg">{value}</span>
        </div>
        <Input
          type="number"
          step="0.1"
          value={String(value)}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
      </div>
    </LabeledField>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, fadeUpItem, staggerContainer } from "@/components/ui/sweet";
import { apiClient, type ConfigResponse } from "@/lib/api";

export function Settings() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiClient.getConfig(),
  });
  const [form, setForm] = useState<ConfigResponse | null>(null);

  useEffect(() => {
    if (configQuery.data) {
      setForm(configQuery.data);
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: ConfigResponse) => apiClient.updateConfig(payload),
    onSuccess: (data) => {
      setForm(data);
      queryClient.setQueryData(["settings"], data);
      if (data.auth?.state === "success") {
        toast.success("配置已保存，登录成功");
      } else if (data.auth?.state === "error") {
        toast.error(data.auth.message || "配置已保存，但登录失败");
      } else {
        toast.success("配置已保存");
      }
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  if (configQuery.isLoading || !form) {
    return <div className="text-[color:var(--text-body)]">正在加载配置...</div>;
  }

  if (configQuery.isError) {
    return (
      <div className="deck-screen p-6 text-[color:var(--telltale-red)]">
        从后端加载配置失败。
      </div>
    );
  }

  return (
    <motion.section
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="Settings"
          title="系统参数面板"
          description="这里替代旧的 config 命令，负责整理账号、下载器和限流参数。结构上改成更容易扫读的表单分区，避免长表单直接压到一整屏。"
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
          title="账号"
          hint="登录凭据与鉴权入口。"
          badges={
            <>
              <Badge variant="decal">登录</Badge>
              <Badge variant="live">凭据</Badge>
              {form.auth ? (
                <Badge variant={authBadgeVariant(form.auth.state)}>
                  {authLabel(form.auth.state)}
                </Badge>
              ) : null}
            </>
          }
        >
          <LabeledField label="账号">
            <Input
              value={form.user.account}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        user: {
                          ...prev.user,
                          account: event.target.value,
                        },
                      }
                    : prev,
                )
              }
            />
          </LabeledField>
          <LabeledField label="密码">
            <Input
              type="password"
              value={form.user.password}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        user: {
                          ...prev.user,
                          password: event.target.value,
                        },
                      }
                    : prev,
                )
              }
            />
          </LabeledField>
        </FormSection>

        <FormSection
          title="下载器"
          hint="下载 API、目标目录、并发和媒体偏好。"
          badges={
            <>
              <Badge variant="signal">网络</Badge>
              <Badge variant="warn">下载</Badge>
            </>
          }
        >
          <LabeledField label="API 地址">
            <Input
              value={form.downloader.api_url || ""}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        downloader: {
                          ...prev.downloader,
                          api_url: event.target.value,
                        },
                      }
                    : prev,
                )
              }
            />
          </LabeledField>
          <LabeledField label="代理">
            <Input
              value={form.downloader.proxy_url || ""}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        downloader: {
                          ...prev.downloader,
                          proxy_url: event.target.value,
                        },
                      }
                    : prev,
                )
              }
            />
          </LabeledField>
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
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
        >
          保存配置
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (configQuery.data) {
              setForm(configQuery.data);
            }
          }}
          disabled={saveMutation.isPending}
        >
          重置表单
        </Button>
      </motion.div>
    </motion.section>
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
      return "未知";
  }
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

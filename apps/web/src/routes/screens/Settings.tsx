import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      toast.success("配置已保存");
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  if (configQuery.isLoading || !form) {
    return <div className="text-slate-400">正在加载配置...</div>;
  }

  if (configQuery.isError) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
        从后端加载配置失败。
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          设置
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          运行参数与下载器配置
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          这个页面替代了旧的 `config` 命令。后端现在会使用默认值启动，并把这里的修改持久化到 `.asmroner-data/config.toml`。
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        <FormSection title="账号">
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

        <FormSection title="下载器">
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

        <FormSection title="限流参数">
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
      </div>

      <div className="flex gap-3">
        <Button
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
      </div>
    </section>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
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
      <div className="text-sm text-slate-500">{label}</div>
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
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </LabeledField>
  );
}

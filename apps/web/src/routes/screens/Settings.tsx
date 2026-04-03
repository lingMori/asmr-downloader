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
      toast.success("Configuration saved");
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  if (configQuery.isLoading || !form) {
    return <div className="text-slate-400">Loading settings...</div>;
  }

  if (configQuery.isError) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
        Failed to load configuration from backend.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          Settings
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Runtime and downloader configuration
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          This page replaces the old interactive `config` command. The backend
          now boots with defaults, and updates here persist to
          `.asmroner-data/config.toml`.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        <FormSection title="Account">
          <LabeledField label="Account">
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
          <LabeledField label="Password">
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

        <FormSection title="Downloader">
          <LabeledField label="API URL">
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
          <LabeledField label="Proxy">
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
          <LabeledField label="Sync folder">
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
          <LabeledField label="Prefer media">
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
            label="Max workers"
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
            label="Max retries"
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
          <LabeledField label="Wanted size">
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

        <FormSection title="Rate limits">
          <FloatField
            label="Sync QPS"
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
            label="Download QPS"
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
            label="Sync jitter min"
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
            label="Sync jitter max"
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
            label="Download jitter min"
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
            label="Download jitter max"
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
          Save configuration
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
          Reset form
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

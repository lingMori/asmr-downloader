import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, type ConfigResponse } from "@/lib/api";
import { keys } from "@/lib/keys";
import { Chip } from "@/components/ui";
import { SettingsCard } from "./SettingsCard";
import { ErrorStrip, errorMessage } from "./FieldRow";
import { useConfigSave } from "./useConfigSave";
import type { ConfigPatch } from "./configPatch";

/**
 * API 镜像预设(取自后端真实地址):
 * - asmr.one:internal/engine/checker.go 测速失败时的默认回退
 * - asmr-300:internal/consts/consts.go AsmrBaseApiUrl(内置默认)
 */
const MIRRORS = [
  { id: "asmr.one", url: "https://api.asmr.one" },
  { id: "asmr-300", url: "https://api.asmr-300.com" },
] as const;

/** 「数据源」卡:镜像/代理/连接状态/账号登录(原型 dc.html:412-429) */
export function SourceCard({ config }: { config: ConfigResponse }) {
  const queryClient = useQueryClient();
  const serverApiUrl = config.downloader.api_url ?? "";
  const serverProxy = config.downloader.proxy_url ?? "";
  const serverAccount = config.user.account;

  const [apiUrlDraft, setApiUrlDraft] = useState(serverApiUrl);
  const [proxyDraft, setProxyDraft] = useState(serverProxy);
  const [accountDraft, setAccountDraft] = useState(serverAccount);
  const [passwordDraft, setPasswordDraft] = useState("");

  useEffect(() => setApiUrlDraft(serverApiUrl), [serverApiUrl]);
  useEffect(() => setProxyDraft(serverProxy), [serverProxy]);
  useEffect(() => setAccountDraft(serverAccount), [serverAccount]);

  const authQuery = useQuery({
    queryKey: keys.authStatus,
    queryFn: () => apiClient.getAuthStatus(),
  });

  const save = useConfigSave(config);

  const checkMutation = useMutation({
    mutationFn: () => apiClient.checkAuth(),
    onSuccess: (auth) => {
      queryClient.setQueryData(keys.authStatus, auth);
    },
  });

  const reloginMutation = useMutation({
    mutationFn: () => apiClient.loginAuth(),
    onSuccess: (auth) => {
      queryClient.setQueryData(keys.authStatus, auth);
      if (auth.state === "success") {
        toast.success(auth.message || "重新登录成功");
      }
    },
  });

  const matchedMirror = MIRRORS.find((m) => m.url === apiUrlDraft.trim());
  const apiChanged = apiUrlDraft.trim() !== serverApiUrl;
  const proxyChanged = proxyDraft.trim() !== serverProxy;
  const accountChanged = accountDraft.trim() !== serverAccount;
  const passwordProvided = passwordDraft.trim() !== "";
  const connDirty = apiChanged || proxyChanged || accountChanged || passwordProvided;

  const busy = save.isPending || reloginMutation.isPending;

  const handleLoginSave = () => {
    if (!connDirty) {
      // 账号未改、无其他变更:只触发重新登录
      save.reset();
      reloginMutation.mutate();
      return;
    }
    const patch: ConfigPatch = {};
    const downloader: NonNullable<ConfigPatch["downloader"]> = {};
    if (apiChanged) {
      downloader.api_url = apiUrlDraft.trim();
    }
    if (proxyChanged) {
      downloader.proxy_url = proxyDraft.trim();
    }
    if (Object.keys(downloader).length > 0) {
      patch.downloader = downloader;
    }
    if (accountChanged || passwordProvided) {
      patch.user = {
        account: accountDraft.trim(),
        ...(passwordProvided ? { password: passwordDraft } : {}),
      };
    }
    save.mutate(patch, {
      onSuccess: () => setPasswordDraft(""),
    });
  };

  const auth = authQuery.data;
  const authState = auth?.state ?? "unknown";
  // 动作级错误(CONFIG_AUTH_FAILED / 登录失败)回显为粉色错误条
  const actionError =
    (save.isError && errorMessage(save.error)) ||
    (save.data?.auth?.state === "error" && save.data.auth.message) ||
    (reloginMutation.isError && errorMessage(reloginMutation.error)) ||
    (reloginMutation.data?.state === "error" && reloginMutation.data.message) ||
    "";

  return (
    <SettingsCard title="数据源 · みらー" color="lav" rotate={2}>
      <div className="y-set-field">
        <div className="y-set-field__label">API 镜像</div>
        <div className="y-set-chips">
          {MIRRORS.map((m) => (
            <Chip
              key={m.id}
              active={matchedMirror?.url === m.url}
              disabled={busy}
              onClick={() => {
                save.reset();
                reloginMutation.reset();
                setApiUrlDraft(m.url);
              }}
            >
              {m.id} <span className="y-set-mirror-host">{m.url.replace("https://", "")}</span>
            </Chip>
          ))}
          <Chip active={!matchedMirror} disabled>
            自定义
          </Chip>
        </div>
        {!matchedMirror && (
          <input
            className="y-set-input y-set-input--mono"
            value={apiUrlDraft}
            aria-label="自定义 API 地址"
            placeholder="https://api.example.com"
            disabled={busy}
            onChange={(e) => {
              save.reset();
              reloginMutation.reset();
              setApiUrlDraft(e.target.value);
            }}
          />
        )}
      </div>
      <div className="y-set-field">
        <div className="y-set-field__label">代理</div>
        <input
          className="y-set-input y-set-input--mono"
          value={proxyDraft}
          aria-label="代理地址"
          placeholder="留空 = 直连,例:http://127.0.0.1:7890"
          disabled={busy}
          onChange={(e) => {
            save.reset();
            reloginMutation.reset();
            setProxyDraft(e.target.value);
          }}
        />
      </div>
      <div className="y-set-status">
        <span
          className={
            authState === "success"
              ? "y-set-dot y-set-dot--ok"
              : authState === "error"
                ? "y-set-dot y-set-dot--err"
                : "y-set-dot"
          }
        />
        <span className="y-set-status__text">
          {authQuery.isLoading
            ? "正在读取连接状态…"
            : authState === "success"
              ? auth?.message || "连接正常"
              : authState === "error"
                ? auth?.message || "连接失败"
                : "状态未知 · 尚未检查"}
        </span>
        <button
          type="button"
          className="y-set-mini-btn"
          disabled={checkMutation.isPending}
          onClick={() => checkMutation.mutate()}
        >
          {checkMutation.isPending ? "检查中…" : "重新检查"}
        </button>
      </div>
      <div className="y-set-form">
        <div className="y-set-field">
          <label className="y-set-field__label" htmlFor="y-set-account">
            账号
          </label>
          <input
            id="y-set-account"
            className="y-set-input"
            autoComplete="username"
            value={accountDraft}
            disabled={busy}
            onChange={(e) => {
              save.reset();
              reloginMutation.reset();
              setAccountDraft(e.target.value);
            }}
          />
        </div>
        <div className="y-set-field">
          <label className="y-set-field__label" htmlFor="y-set-password">
            密码
          </label>
          <input
            id="y-set-password"
            className="y-set-input"
            type="password"
            autoComplete="new-password"
            placeholder="留空保持不变"
            value={passwordDraft}
            disabled={busy}
            onChange={(e) => {
              save.reset();
              reloginMutation.reset();
              setPasswordDraft(e.target.value);
            }}
          />
        </div>
        <div className="y-set-foot">
          <button
            type="button"
            className="y-btn-primary"
            disabled={busy || (connDirty && accountDraft.trim() === "")}
            onClick={handleLoginSave}
          >
            {busy ? "处理中…" : "保存并重新登录"}
          </button>
        </div>
      </div>
      <div className="y-hint">
        <span style={{ color: "var(--pink)" }}>♪</span>
        镜像仅代理检索与元数据,音频文件直连源站下载。
      </div>
      {actionError && <ErrorStrip message={actionError} />}
    </SettingsCard>
  );
}

import { useEffect, useState } from "react";
import type { ConfigResponse } from "@/lib/api";
import { Stepper } from "@/components/ui";
import { SettingsCard } from "./SettingsCard";
import { FieldRow, ErrorStrip, errorMessage } from "./FieldRow";
import { useConfigSave } from "./useConfigSave";
import type { ConfigDownloaderPatch } from "./configPatch";

/** 「下载」卡:并发/重试步进 + 存储路径(原型 dc.html:393-409) */
export function DownloadCard({ config }: { config: ConfigResponse }) {
  const serverWorkers = config.downloader.max_workers ?? 1;
  const serverRetries = config.downloader.max_retries ?? 0;
  const serverFolder = config.downloader.sync_data_folder;

  const [workers, setWorkers] = useState(serverWorkers);
  const [retries, setRetries] = useState(serverRetries);
  const [editingPath, setEditingPath] = useState(false);
  const [pathDraft, setPathDraft] = useState(serverFolder);

  const save = useConfigSave(config);

  // 服务端数据变化(保存成功回写/外部刷新)后同步草稿
  useEffect(() => {
    setWorkers(serverWorkers);
    setRetries(serverRetries);
  }, [serverWorkers, serverRetries]);
  useEffect(() => {
    if (!editingPath) {
      setPathDraft(serverFolder);
    }
  }, [serverFolder, editingPath]);

  const numbersDirty = workers !== serverWorkers || retries !== serverRetries;
  const trimmedPath = pathDraft.trim();
  const pathSavable = editingPath && trimmedPath !== "" && trimmedPath !== serverFolder;

  const saveNumbers = () => {
    const downloader: ConfigDownloaderPatch = {};
    if (workers !== serverWorkers) {
      downloader.max_workers = workers;
    }
    if (retries !== serverRetries) {
      downloader.max_retries = retries;
    }
    if (Object.keys(downloader).length === 0) {
      return;
    }
    save.mutate({ downloader });
  };

  const savePath = () => {
    if (!pathSavable) {
      return;
    }
    save.mutate(
      { downloader: { sync_data_folder: trimmedPath } },
      { onSuccess: () => setEditingPath(false) },
    );
  };

  return (
    <SettingsCard title="下载 · だうんろーど" color="pink" rotate={-2}>
      <FieldRow label="并发任务数" desc="同时进行的下载任务上限">
        <Stepper
          value={workers}
          min={1}
          max={8}
          label="并发任务数"
          onChange={(v) => {
            save.reset();
            setWorkers(v);
          }}
        />
      </FieldRow>
      <FieldRow label="重试次数" desc="失败任务自动重试的次数">
        <Stepper
          value={retries}
          min={0}
          max={10}
          label="重试次数"
          onChange={(v) => {
            save.reset();
            setRetries(v);
          }}
        />
      </FieldRow>
      <div className="y-set-row">
        <div className="y-set-row__text">
          <div className="y-set-row__label">存储路径</div>
          {editingPath ? (
            <input
              className="y-set-input y-set-input--mono"
              value={pathDraft}
              aria-label="存储路径"
              disabled={save.isPending}
              onChange={(e) => {
                save.reset();
                setPathDraft(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  savePath();
                }
              }}
            />
          ) : (
            <span className="y-set-mono">{serverFolder}</span>
          )}
        </div>
        {editingPath ? (
          <>
            <button
              type="button"
              className="y-set-mini-btn"
              disabled={!pathSavable || save.isPending}
              onClick={savePath}
            >
              {save.isPending ? "保存中…" : "保存"}
            </button>
            <button
              type="button"
              className="y-set-mini-btn"
              disabled={save.isPending}
              onClick={() => {
                save.reset();
                setPathDraft(serverFolder);
                setEditingPath(false);
              }}
            >
              取消
            </button>
          </>
        ) : (
          <button
            type="button"
            className="y-set-mini-btn"
            onClick={() => {
              save.reset();
              setPathDraft(serverFolder);
              setEditingPath(true);
            }}
          >
            更改…
          </button>
        )}
      </div>
      {numbersDirty && (
        <div className="y-set-foot">
          <span className="y-set-foot__hint">有未保存修改</span>
          <button
            type="button"
            className="y-btn-ghost"
            disabled={save.isPending}
            onClick={() => {
              save.reset();
              setWorkers(serverWorkers);
              setRetries(serverRetries);
            }}
          >
            重置
          </button>
          <button
            type="button"
            className="y-btn-primary"
            disabled={save.isPending}
            onClick={saveNumbers}
          >
            {save.isPending ? "保存中…" : "保存"}
          </button>
        </div>
      )}
      {save.isError && <ErrorStrip message={errorMessage(save.error)} />}
    </SettingsCard>
  );
}

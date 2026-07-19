import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, type ConfigResponse } from "@/lib/api";
import { keys } from "@/lib/keys";
import { buildConfigPatch, type ConfigPatch } from "./configPatch";

/**
 * 配置保存 mutation:只传改动字段(buildConfigPatch 附保护底),
 * 成功后 toast + 写回/失效 keys.config;失败由调用卡片渲染 ErrorStrip。
 */
export function useConfigSave(current: ConfigResponse) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changed: ConfigPatch) =>
      apiClient.updateConfig(buildConfigPatch(changed, current)),
    onSuccess: (data) => {
      queryClient.setQueryData(keys.config, data);
      if (data.auth) {
        queryClient.setQueryData(keys.authStatus, data.auth);
      }
      void queryClient.invalidateQueries({ queryKey: keys.config });
      toast.success("设置已保存");
    },
  });
}

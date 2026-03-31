import type { AgentRuntime, ChannelConfig } from "@agentx/runtime";
import { ChannelManager } from "@agentx/runtime";
import { CollectionStore, type NotifyFn, readJsonFile, writeJsonFile } from "../stores";
import type { HandlerMap } from "./register-handlers";

export function createChannelManager(
  runtime: AgentRuntime,
  channelsPath: string,
  channelConversationsPath: string,
  notify: NotifyFn,
): ChannelManager {
  return new ChannelManager(runtime, {
    configPath: channelsPath,
    conversationMapPath: channelConversationsPath,
    onStatusUpdate: (states) => {
      notify("channel:statusUpdate", states);
    },
    onQRCode: (channelId, qrDataUrl) => {
      notify("channel:qrCode", { channelId, qrDataUrl });
    },
    onConversationsChanged: () => {
      notify("channel:conversationsChanged", {});
    },
    onConfigUpdate: (channelId, settingsUpdate) => {
      const configs = readJsonFile<ChannelConfig[]>(channelsPath, []);
      const idx = configs.findIndex((c) => c.id === channelId);
      if (idx >= 0) {
        configs[idx]!.settings = { ...configs[idx]!.settings, ...settingsUpdate };
        writeJsonFile(channelsPath, configs);
        notify("channel:changed", configs);
      }
    },
  });
}

export function createChannelStore(
  filePath: string,
  notify: NotifyFn,
): CollectionStore<ChannelConfig> {
  return new CollectionStore<ChannelConfig>(filePath, notify, "channel");
}

export function registerChannelHandlers(
  handlers: HandlerMap,
  store: CollectionStore<ChannelConfig>,
  channelManager: ChannelManager,
): void {
  handlers["channel:list"] = () => store.list();
  handlers["channel:set"] = async (config: ChannelConfig) => {
    store.set(config);
    await channelManager.setConfigs(store.list());
  };
  handlers["channel:remove"] = async (id: string) => {
    store.remove(id);
    await channelManager.setConfigs(store.list());
  };
  handlers["channel:status"] = () => channelManager.getStates();
  handlers["channel:start"] = async (id: string) => {
    await channelManager.startChannel(id);
  };
  handlers["channel:stop"] = async (id: string) => {
    await channelManager.stopChannel(id);
  };
}

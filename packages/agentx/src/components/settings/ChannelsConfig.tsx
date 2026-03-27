import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  loadChannels,
  upsertChannel,
  deleteChannel,
  type ChannelConfig,
} from "@/slices/settingsSlice";
import { l10n } from "@agentx/l10n";
import { InputBox } from "@/components/ui/InputBox";
import { v4 as uuidv4 } from "uuid";
import { RefreshCwIcon, PowerIcon, PowerOffIcon } from "lucide-react";
import { AccordionSection, AccordionCard, FieldRow, ToggleSwitch } from "./SettingsAccordion";

function StatusDot({ status }: { status: ChannelStateData["status"] }) {
  const color =
    status === "running"
      ? "bg-green-500"
      : status === "starting"
        ? "bg-yellow-500 animate-pulse"
        : status === "error"
          ? "bg-red-500"
          : "bg-foreground/[0.12]";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export function ChannelsConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const channels = useSelector((state: RootState) => state.settings.channels);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [channelStates, setChannelStates] = useState<ChannelStateData[]>([]);
  const [qrCode, setQrCode] = useState<{ channelId: string; qrDataUrl: string } | null>(null);

  useEffect(() => {
    dispatch(loadChannels());
    window.api.channel
      .status()
      .then(setChannelStates)
      .catch(() => {});
  }, [dispatch]);

  // Subscribe to live status updates
  useEffect(() => {
    const unsub = window.api.channel.onStatusUpdate((states) => {
      setChannelStates(states);
    });
    return unsub;
  }, []);

  // Subscribe to QR code events
  useEffect(() => {
    const unsub = window.api.channel.onQRCode((data) => {
      setQrCode(data);
    });
    return unsub;
  }, []);

  const getChannelState = useCallback(
    (id: string) => channelStates.find((s) => s.id === id),
    [channelStates],
  );

  const handleAdd = (type: "telegram" | "discord") => {
    const config: ChannelConfig = {
      id: uuidv4(),
      type,
      name: type === "telegram" ? "Telegram" : "Discord",
      enabled: false,
      settings: {},
    };
    dispatch(upsertChannel(config));
    setExpandedId(config.id);
  };

  const handleSave = (config: ChannelConfig) => {
    dispatch(upsertChannel(config));
  };

  const handleStart = async (id: string) => {
    const channel = channels.find((c) => c.id === id);
    const chType = (channel?.type ?? "telegram") as ChannelStateData["type"];

    // Show "starting" immediately so user sees feedback
    setChannelStates((prev) => {
      const existing = prev.find((s) => s.id === id);
      if (existing) {
        return prev.map((s) =>
          s.id === id ? { ...s, status: "starting" as const, error: undefined } : s,
        );
      }
      return [...prev, { id, type: chType, status: "starting" as const }];
    });

    // Ensure latest config is persisted before starting
    if (channel) {
      await window.api.channel.set(channel).catch(() => {});
    }
    try {
      await window.api.channel.start(id);
    } catch (err) {
      // Surface the error via channelStates so the error banner shows
      const errorMsg = err instanceof Error ? err.message : String(err);
      setChannelStates((prev) => {
        const existing = prev.find((s) => s.id === id);
        if (existing) {
          return prev.map((s) =>
            s.id === id ? { ...s, status: "error" as const, error: errorMsg } : s,
          );
        }
        return [...prev, { id, type: chType, status: "error" as const, error: errorMsg }];
      });
    }
  };

  const handleStop = (id: string) => {
    window.api.channel.stop(id).catch(() => {});
    // Clear QR code if it belongs to this channel
    if (qrCode?.channelId === id) setQrCode(null);
  };

  const toggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <AccordionSection
      hasItems={channels.length > 0}
      emptyMessage={l10n.t("No channels configured")}
      addActions={[
        { label: "Telegram", onClick: () => handleAdd("telegram") },
        { label: "Discord", onClick: () => handleAdd("discord") },
      ]}
    >
      {channels.map((channel) => {
        const state = getChannelState(channel.id);
        const isRunning = state?.status === "running" || state?.status === "starting";
        return (
          <AccordionCard
            key={channel.id}
            expanded={expandedId === channel.id}
            onToggle={() => toggle(channel.id)}
            onRemove={() => {
              if (isRunning) handleStop(channel.id);
              dispatch(deleteChannel(channel.id));
              if (expandedId === channel.id) setExpandedId(null);
            }}
            title={channel.name || l10n.t("Untitled")}
            subtitle={
              <span className="inline-flex items-center gap-1.5">
                {state && <StatusDot status={state.status} />}
                {channel.type}
                {state?.displayName && (
                  <span className="text-muted-foreground/50">{state.displayName}</span>
                )}
              </span>
            }
            enabled={channel.enabled}
          >
            {/* Error banner */}
            {state?.status === "error" && state.error && (
              <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-md bg-destructive/10 text-destructive text-[11px]">
                <span className="flex-1 truncate">{state.error}</span>
                <button
                  type="button"
                  onClick={() => handleStart(channel.id)}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] hover:underline"
                >
                  <RefreshCwIcon className="w-3 h-3" />
                  {l10n.t("Retry")}
                </button>
              </div>
            )}

            <FieldRow label={l10n.t("Name")}>
              <InputBox
                value={channel.name}
                onChange={(e) => handleSave({ ...channel, name: e.target.value })}
                placeholder={l10n.t("Channel name")}
                className="h-7 text-[12px] rounded-md bg-background"
              />
            </FieldRow>

            {channel.type === "telegram" && (
              <>
                <FieldRow label={l10n.t("Bot Token")}>
                  <InputBox
                    type="password"
                    value={(channel.settings.botToken as string) ?? ""}
                    onChange={(e) =>
                      handleSave({
                        ...channel,
                        settings: { ...channel.settings, botToken: e.target.value },
                      })
                    }
                    placeholder="123456:ABC-DEF..."
                    className="h-7 text-[12px] rounded-md bg-background font-mono"
                  />
                </FieldRow>
                <p className="text-[10px] text-muted-foreground/60 px-1">
                  {l10n.t("Create a bot via")}{" "}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-muted-foreground"
                  >
                    @BotFather
                  </a>
                  {" — "}
                  {l10n.t(
                    "paste the token above, click Start, then scan the QR code to open the bot",
                  )}
                </p>
              </>
            )}

            {channel.type === "discord" && (
              <>
                <FieldRow label={l10n.t("Bot Token")}>
                  <InputBox
                    type="password"
                    value={(channel.settings.botToken as string) ?? ""}
                    onChange={(e) =>
                      handleSave({
                        ...channel,
                        settings: { ...channel.settings, botToken: e.target.value },
                      })
                    }
                    placeholder="MTExxxx..."
                    className="h-7 text-[12px] rounded-md bg-background font-mono"
                  />
                </FieldRow>
                <p className="text-[10px] text-muted-foreground/60 px-1">
                  {l10n.t("Create a bot at")}{" "}
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-muted-foreground"
                  >
                    Discord Developer Portal
                  </a>
                  {" — "}
                  {l10n.t(
                    "enable Message Content intent, paste the token above, click Start, then use the invite link to add bot to your server",
                  )}
                </p>
              </>
            )}

            {qrCode?.channelId === channel.id && (
              <div className="flex flex-col items-center gap-2 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {channel.type === "telegram"
                    ? l10n.t("Scan to open the bot in Telegram and start chatting")
                    : l10n.t("Scan to add bot to your Discord server")}
                </p>
                <img
                  src={qrCode.qrDataUrl}
                  alt={`${channel.type === "telegram" ? "Telegram" : "Discord"} QR Code`}
                  className="w-40 h-40 rounded-lg border border-border/60"
                />
              </div>
            )}

            <FieldRow label={l10n.t("Enabled")}>
              <ToggleSwitch
                checked={channel.enabled}
                onChange={(v) => handleSave({ ...channel, enabled: v })}
              />
            </FieldRow>

            <FieldRow label={l10n.t("Control")}>
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <button
                    type="button"
                    onClick={() => handleStop(channel.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-background bg-foreground hover:bg-foreground/90 transition-colors"
                  >
                    <PowerOffIcon className="w-3 h-3" />
                    {l10n.t("Stop")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStart(channel.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-background bg-foreground hover:bg-foreground/90 transition-colors"
                  >
                    <PowerIcon className="w-3 h-3" />
                    {l10n.t("Start")}
                  </button>
                )}
                {state?.status === "running" && state.displayName && (
                  <span className="text-[11px] text-muted-foreground">{state.displayName}</span>
                )}
              </div>
            </FieldRow>
          </AccordionCard>
        );
      })}
    </AccordionSection>
  );
}

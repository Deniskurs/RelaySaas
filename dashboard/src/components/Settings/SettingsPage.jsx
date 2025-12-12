import { useState, useEffect } from "react";
import {
  Save,
  RotateCcw,
  AlertCircle,
  Check,
  Loader2,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  Send,
  Shield,
  RefreshCw,
  Unplug,
  Lock,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";

function SettingRow({ label, description, children, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-4 first:pt-0 last:pb-0",
        className
      )}
    >
      <div className="flex flex-col gap-0.5 pr-6 min-w-0">
        <span className="text-[14px] font-medium text-foreground">
          {label}
        </span>
        {description && (
          <span className="text-[12px] text-foreground-muted/60 leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step, suffix, className }) {
  const handleChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) onChange(val);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        className={cn(
          "w-24 h-9 px-3 text-center font-mono text-sm",
          "bg-white/[0.04] border-white/[0.08] rounded-lg",
          "focus:border-white/20 focus:bg-white/[0.06] focus:ring-0 focus:ring-offset-0",
          "transition-colors",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
      />
      {suffix && (
        <span className="text-[13px] text-foreground-muted/50 font-medium min-w-[20px]">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SymbolTags({ symbols, onChange }) {
  const [input, setInput] = useState("");

  const addSymbol = (e) => {
    if (e.key === "Enter" && input) {
      e.preventDefault();
      if (!symbols.includes(input.toUpperCase())) {
        onChange([...symbols, input.toUpperCase()]);
      }
      setInput("");
    }
  };

  const removeSymbol = (symbolToRemove) => {
    onChange(symbols.filter((s) => s !== symbolToRemove));
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center justify-end">
      {symbols.map((symbol) => (
        <span
          key={symbol}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white/[0.06] text-foreground/80 rounded-md hover:bg-white/[0.08] transition-colors"
        >
          {symbol}
          <button
            onClick={() => removeSymbol(symbol)}
            className="hover:text-foreground transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addSymbol}
        placeholder="+ Add"
        className="w-16 h-7 px-2 text-xs bg-transparent border-white/[0.06] border-dashed rounded-md focus:border-white/20 focus:bg-white/[0.03] transition-colors placeholder:text-foreground-muted/40"
      />
    </div>
  );
}

function ChannelTags({ channels, onChange }) {
  const [input, setInput] = useState("");

  const addChannel = (e) => {
    if (e.key === "Enter" && input) {
      e.preventDefault();
      if (!channels.includes(input)) {
        onChange([...channels, input]);
      }
      setInput("");
    }
  };

  const removeChannel = (channelToRemove) => {
    onChange(channels.filter((c) => c !== channelToRemove));
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center justify-end">
      {channels.map((channel) => (
        <span
          key={channel}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-white/[0.04] text-foreground/70 border border-white/[0.06] rounded-md hover:bg-white/[0.06] transition-colors"
        >
          {channel}
          <button
            onClick={() => removeChannel(channel)}
            className="hover:text-foreground transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addChannel}
        placeholder="+ Add ID"
        className="w-20 h-7 px-2 text-xs font-mono bg-transparent border-white/[0.06] border-dashed rounded-md focus:border-white/20 focus:bg-white/[0.03] transition-colors placeholder:text-foreground-muted/40"
      />
    </div>
  );
}

function TPRatioInputs({ ratios, onChange }) {
  const handleChange = (index, value) => {
    const newRatios = [...ratios];
    newRatios[index] = parseFloat(value);
    onChange(newRatios);
  };

  const total = ratios.reduce((a, b) => a + b, 0);
  const isValid = Math.abs(total - 1) < 0.001;

  return (
    <div className="flex items-center gap-2">
      {ratios.map((ratio, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-[10px] text-foreground-muted/50 font-medium">
            TP{i + 1}
          </span>
          <Input
            type="number"
            value={ratio}
            onChange={(e) => handleChange(i, e.target.value)}
            step={0.1}
            min={0}
            max={1}
            className={cn(
              "w-14 h-8 px-2 text-center font-mono text-xs",
              "bg-white/[0.04] border-white/[0.08] rounded-md",
              "focus:border-white/20 focus:bg-white/[0.06] focus:ring-0",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            )}
          />
        </div>
      ))}
      <span
        className={cn(
          "text-xs font-mono px-2 py-1 rounded-md",
          isValid
            ? "text-emerald-400/80 bg-emerald-500/10"
            : "text-rose-400/80 bg-rose-500/10"
        )}
      >
        {(total * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, className, disabled }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-9 pr-9 font-mono text-sm",
          "bg-white/[0.04] border-white/[0.08] rounded-lg",
          "focus:border-white/20 focus:bg-white/[0.06] focus:ring-0",
          className
        )}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted/50 hover:text-foreground-muted transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function TelegramSection({
  telegramCreds,
  onCredsChange,
  channels,
  onChannelsChange,
  isLoading: credsLoading,
  configStatus = {} // { telegram_api_hash_set, telegram_api_hash_preview }
}) {
  const { fetchData, postData } = useApi();
  const [connectionStatus, setConnectionStatus] = useState("loading");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  // Verification state
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    const result = await fetchData("/admin/telegram/status");
    if (result) {
      setConnectionStatus(result.status);
      setConnectionMessage(result.message);
    } else {
      setConnectionStatus("not_configured");
    }
  };

  const handleSendCode = async () => {
    if (!telegramCreds.telegram_api_id || !telegramCreds.telegram_api_hash || !telegramCreds.telegram_phone) {
      setConnectionError("Please save your credentials first (API ID, API Hash, Phone)");
      return;
    }
    setIsConnecting(true);
    setConnectionError("");

    const result = await postData("/admin/telegram/send-code", {
      api_id: telegramCreds.telegram_api_id,
      api_hash: telegramCreds.telegram_api_hash,
      phone: telegramCreds.telegram_phone,
    });

    if (result) {
      setConnectionStatus(result.status);
      setConnectionMessage(result.message);
    } else {
      setConnectionError("Failed to send verification code. Please check your credentials.");
    }
    setIsConnecting(false);
  };

  const handleVerifyCode = async () => {
    if (!code) {
      setConnectionError("Please enter the verification code");
      return;
    }
    setIsConnecting(true);
    setConnectionError("");

    const result = await postData("/admin/telegram/verify-code", { code });

    if (result) {
      setConnectionStatus(result.status);
      setConnectionMessage(result.message);
    } else {
      setConnectionError("Invalid code. Please try again.");
    }
    setIsConnecting(false);
  };

  const handleVerifyPassword = async () => {
    if (!password) {
      setConnectionError("Please enter your 2FA password");
      return;
    }
    setIsConnecting(true);
    setConnectionError("");

    const result = await postData("/admin/telegram/verify-password", { password });

    if (result) {
      setConnectionStatus(result.status);
      setConnectionMessage(result.message);
    } else {
      setConnectionError("Invalid password. Please try again.");
    }
    setIsConnecting(false);
  };

  const handleDisconnect = async () => {
    setIsConnecting(true);
    const result = await postData("/admin/telegram/disconnect", {});
    if (result) {
      setConnectionStatus(result.status);
      setConnectionMessage(result.message);
      setCode("");
      setPassword("");
    }
    setIsConnecting(false);
  };

  const handleReconnect = async () => {
    setIsConnecting(true);
    setConnectionError("");
    try {
      const result = await postData("/admin/telegram/reconnect");
      setConnectionMessage(result.message || "Reconnected successfully!");
    } catch (err) {
      setConnectionError(err.message || "Failed to reconnect");
    } finally {
      setIsConnecting(false);
    }
  };

  const inputClass = "h-9 font-mono text-sm bg-white/[0.04] border-white/[0.08] rounded-lg focus:border-white/20 focus:bg-white/[0.06] focus:ring-0 transition-colors placeholder:text-foreground-muted/40";

  if (credsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Instructions */}
      <div className="mb-4 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg">
        <p className="text-[12px] text-foreground-muted/60 leading-relaxed">
          Get your API credentials from{" "}
          <a
            href="https://my.telegram.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/70 hover:text-foreground inline-flex items-center gap-1 font-medium"
          >
            my.telegram.org
            <ExternalLink size={10} />
          </a>
        </p>
      </div>

      {/* Credentials Section */}
      <SettingRow
        label="API ID"
        description="Your Telegram application ID"
      >
        <Input
          type="text"
          value={telegramCreds.telegram_api_id}
          onChange={(e) => onCredsChange("telegram_api_id", e.target.value)}
          placeholder="12345678"
          className={cn(inputClass, "w-32")}
        />
      </SettingRow>

      <SettingRow
        label="API Hash"
        description="Your Telegram application hash"
      >
        <div className="flex items-center gap-2">
          <PasswordInput
            value={telegramCreds.telegram_api_hash}
            onChange={(e) => onCredsChange("telegram_api_hash", e.target.value)}
            placeholder={configStatus.telegram_api_hash_set ? "••••••••" : "Enter hash"}
            className={cn(inputClass, "w-44")}
          />
          {configStatus.telegram_api_hash_set && !telegramCreds.telegram_api_hash && (
            <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-1 rounded-md font-medium">
              Set
            </span>
          )}
        </div>
      </SettingRow>

      <SettingRow
        label="Phone Number"
        description="With country code"
      >
        <Input
          type="tel"
          value={telegramCreds.telegram_phone}
          onChange={(e) => onCredsChange("telegram_phone", e.target.value)}
          placeholder="+1234567890"
          className={cn(inputClass, "w-36")}
        />
      </SettingRow>

      {/* Connection Status & Actions */}
      <div className="pt-2 border-t border-white/[0.04]">
        {connectionError && (
          <div className="flex items-center gap-2 text-rose-400 text-sm mb-4">
            <AlertCircle size={14} />
            <span className="italic">{connectionError}</span>
          </div>
        )}

        {connectionStatus === "loading" && (
          <div className="flex items-center gap-2 text-foreground-muted text-sm">
            <Loader2 size={14} className="animate-spin" />
            <span className="italic">Checking connection status...</span>
          </div>
        )}

        {connectionStatus === "connected" && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Connected</p>
                <p className="text-xs text-foreground-muted/70 italic mt-0.5">{connectionMessage}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReconnect}
                disabled={isConnecting}
                className="h-8 px-3 text-foreground-muted hover:text-foreground hover:bg-white/[0.05]"
              >
                {isConnecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={isConnecting}
                className="h-8 px-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                <Unplug size={14} />
              </Button>
            </div>
          </div>
        )}

        {connectionStatus === "pending_password" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/[0.08] border border-amber-500/20">
              <Lock size={18} className="text-amber-400" />
              <div>
                <p className="text-sm font-medium text-foreground">2FA Required</p>
                <p className="text-xs text-foreground-muted/70 italic mt-0.5">{connectionMessage}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[15px] font-medium text-foreground">Telegram Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your 2FA password"
                className={inputClass}
              />
            </div>
            <Button
              onClick={handleVerifyPassword}
              disabled={isConnecting}
              className="w-full h-10 rounded-xl bg-white/[0.9] text-background hover:bg-white font-medium"
            >
              {isConnecting ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Shield size={14} className="mr-2" />
              )}
              Verify Password
            </Button>
          </div>
        )}

        {connectionStatus === "pending_code" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/[0.08] border border-blue-500/20">
              <MessageSquare size={18} className="text-blue-400" />
              <div>
                <p className="text-sm font-medium text-foreground">Enter Verification Code</p>
                <p className="text-xs text-foreground-muted/70 italic mt-0.5">{connectionMessage}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[15px] font-medium text-foreground">Verification Code</label>
              <Input
                placeholder="Enter the code from Telegram"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={cn(inputClass, "text-center text-lg tracking-[0.5em]")}
                maxLength={6}
              />
            </div>
            <Button
              onClick={handleVerifyCode}
              disabled={isConnecting}
              className="w-full h-10 rounded-xl bg-white/[0.9] text-background hover:bg-white font-medium"
            >
              {isConnecting ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Check size={14} className="mr-2" />
              )}
              Verify Code
            </Button>
          </div>
        )}

        {(connectionStatus === "not_configured" || connectionStatus === "disconnected") && (
          <Button
            onClick={handleSendCode}
            disabled={isConnecting || !telegramCreds.telegram_api_id || !telegramCreds.telegram_api_hash || !telegramCreds.telegram_phone}
            className="w-full h-10 rounded-xl bg-white/[0.9] text-background hover:bg-white font-medium disabled:opacity-40 disabled:bg-white/[0.1] disabled:text-foreground-muted"
          >
            {isConnecting ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <Send size={14} className="mr-2" />
            )}
            Connect Telegram
          </Button>
        )}
      </div>

      {/* Signal Channels */}
      <div className="pt-4 border-t border-white/[0.04]">
        <SettingRow
          label="Signal Channels"
          description="Channel IDs to monitor for trading signals"
          className="pt-0"
        >
          <ChannelTags
            channels={channels || []}
            onChange={onChannelsChange}
          />
        </SettingRow>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const {
    settings,
    isLoading,
    isSaving,
    error,
    updateSettings,
  } = useSettings();
  const { currencyData } = useCurrency();
  const { putData } = useApi();
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Telegram credentials state
  const [telegramCreds, setTelegramCreds] = useState({
    telegram_api_id: "",
    telegram_api_hash: "",
    telegram_phone: "",
  });
  const [telegramCredsOriginal, setTelegramCredsOriginal] = useState(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramError, setTelegramError] = useState("");
  const [hasTelegramChanges, setHasTelegramChanges] = useState(false);
  const [configStatus, setConfigStatus] = useState({});

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  // Load from admin config (where AdminPanel saved settings)
  // This ensures existing configured values are populated
  const { fetchData } = useApi();

  useEffect(() => {
    const loadAdminConfig = async () => {
      setTelegramLoading(true);
      try {
        // Fetch from admin config - this is where AdminPanel saved all settings
        const adminConfig = await fetchData("/admin/config");

        if (adminConfig) {
          // Track which sensitive fields are already set (for showing "Set" badges)
          setConfigStatus({
            telegram_api_hash_set: adminConfig.telegram_api_hash_set || false,
            telegram_api_hash_preview: adminConfig.telegram_api_hash_preview || "",
            metaapi_token_set: adminConfig.metaapi_token_set || false,
          });

          // Load Telegram credentials (backend now returns actual hash for admin editing)
          const creds = {
            telegram_api_id: adminConfig.telegram_api_id || "",
            telegram_api_hash: adminConfig.telegram_api_hash || "",
            telegram_phone: adminConfig.telegram_phone || "",
          };
          setTelegramCreds(creds);
          setTelegramCredsOriginal(creds);

          // If channels are not in user settings, load from admin config
          if (adminConfig.telegram_channel_ids && (!localSettings.telegram_channel_ids || localSettings.telegram_channel_ids.length === 0)) {
            const channelsFromAdmin = adminConfig.telegram_channel_ids
              .split(",")
              .map(c => c.trim())
              .filter(c => c);
            if (channelsFromAdmin.length > 0) {
              setLocalSettings(prev => ({
                ...prev,
                telegram_channel_ids: channelsFromAdmin
              }));
            }
          }
        }
      } catch (e) {
        console.error("Error loading admin config:", e);
      } finally {
        setTelegramLoading(false);
      }
    };

    loadAdminConfig();
  }, [fetchData]);

  const updateLocal = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const updateTelegramCred = (key, value) => {
    setTelegramCreds((prev) => ({ ...prev, [key]: value }));
    setHasTelegramChanges(true);
    setSaveSuccess(false);
    setTelegramError("");
  };

  const handleSave = async () => {
    const success = await updateSettings(localSettings);
    if (success) {
      setHasChanges(false);

      // Also sync telegram_channel_ids to admin config for backend compatibility
      // The backend telegram client reads from system_config, not user_settings
      if (localSettings.telegram_channel_ids) {
        try {
          const channelIdsString = Array.isArray(localSettings.telegram_channel_ids)
            ? localSettings.telegram_channel_ids.join(",")
            : localSettings.telegram_channel_ids;
          await putData("/admin/config", { telegram_channel_ids: channelIdsString });

          // Auto-refresh Telegram to pick up new channel list
          await postData("/admin/telegram/reconnect");
        } catch (e) {
          // Non-critical - user settings were saved, admin config sync is optional
          console.warn("Could not sync channels to admin config:", e);
        }
      }
    }
    return success;
  };

  const handleSaveTelegram = async () => {
    // Validation
    if (telegramCreds.telegram_api_id && !/^\d+$/.test(telegramCreds.telegram_api_id)) {
      setTelegramError("API ID must be a number");
      return false;
    }

    if (telegramCreds.telegram_phone && !/^\+?\d{10,15}$/.test(telegramCreds.telegram_phone.replace(/\s/g, ""))) {
      setTelegramError("Please enter a valid phone number with country code");
      return false;
    }

    setTelegramSaving(true);
    setTelegramError("");

    try {
      // Save to admin config (system_config table) for backend compatibility
      // This is where the backend telegram client reads credentials from
      const updates = {};
      if (telegramCreds.telegram_api_id) {
        updates.telegram_api_id = telegramCreds.telegram_api_id;
      }
      if (telegramCreds.telegram_api_hash) {
        updates.telegram_api_hash = telegramCreds.telegram_api_hash;
      }
      if (telegramCreds.telegram_phone) {
        updates.telegram_phone = telegramCreds.telegram_phone;
      }

      if (Object.keys(updates).length > 0) {
        const result = await putData("/admin/config", updates);
        if (!result) {
          setTelegramError("Failed to save Telegram credentials");
          return false;
        }
      }

      setTelegramCredsOriginal({ ...telegramCreds });
      setHasTelegramChanges(false);
      return true;
    } catch (e) {
      setTelegramError("An unexpected error occurred");
      return false;
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
  };

  const handleResetTelegram = () => {
    if (telegramCredsOriginal) {
      setTelegramCreds({ ...telegramCredsOriginal });
    }
    setHasTelegramChanges(false);
    setTelegramError("");
  };

  const anyChanges = hasChanges || hasTelegramChanges;
  const anySaving = isSaving || telegramSaving;

  const handleSaveAll = async () => {
    let allSuccess = true;

    if (hasChanges) {
      const success = await handleSave();
      if (!success) allSuccess = false;
    }
    if (hasTelegramChanges) {
      const success = await handleSaveTelegram();
      if (!success) allSuccess = false;
    }

    if (allSuccess) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleResetAll = () => {
    handleReset();
    handleResetTelegram();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="pb-16">
        {/* Header */}
        <div className="flex items-center justify-between py-8 mb-2">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Settings
            </h1>
            <p className="text-sm text-foreground-muted/70 italic mt-1">
              Configure your trading parameters and integrations
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {(error || telegramError) && (
              <span className="text-sm text-rose-400 flex items-center gap-1.5 bg-rose-500/10 px-3 py-1.5 rounded-lg">
                <AlertCircle size={14} />
                <span className="italic">{error || telegramError}</span>
              </span>
            )}
            {saveSuccess && (
              <span className="text-sm text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg animate-in fade-in slide-in-from-right-2">
                <Check size={14} />
                <span className="italic">Saved</span>
              </span>
            )}
            {anyChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAll}
                className="text-foreground-muted hover:text-foreground hover:bg-white/[0.05] h-9 px-3"
              >
                <RotateCcw size={14} className="mr-1.5" />
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={!anyChanges || anySaving}
              className={cn(
                "h-9 px-4 rounded-xl bg-white/[0.9] text-background hover:bg-white font-medium",
                "disabled:opacity-40 disabled:bg-white/[0.1] disabled:text-foreground-muted",
                "transition-all"
              )}
            >
              {anySaving ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Save size={14} className="mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Telegram Section */}
          <Card className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-6">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/60 uppercase tracking-widest">
                Telegram
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pt-4 pb-6">
              <TelegramSection
                telegramCreds={telegramCreds}
                onCredsChange={updateTelegramCred}
                channels={localSettings.telegram_channel_ids || []}
                onChannelsChange={(v) => updateLocal("telegram_channel_ids", v)}
                isLoading={telegramLoading}
                configStatus={configStatus}
              />
            </CardContent>
          </Card>

          {/* Risk Management */}
          <Card className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-6">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/60 uppercase tracking-widest">
                Risk Management
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pt-4 pb-6 space-y-1">
              <SettingRow
                label="Maximum Risk Per Trade"
                description="Percentage of account balance to risk per trade"
              >
                <NumberInput
                  value={localSettings.max_risk_percent}
                  onChange={(v) => updateLocal("max_risk_percent", v)}
                  min={0.1}
                  max={10}
                  step={0.1}
                  suffix="%"
                />
              </SettingRow>
              <SettingRow
                label="Maximum Lot Size"
                description="Upper limit for any single position size"
              >
                <NumberInput
                  value={localSettings.max_lot_size}
                  onChange={(v) => updateLocal("max_lot_size", v)}
                  min={0.01}
                  max={100}
                  step={0.01}
                />
              </SettingRow>
              <SettingRow
                label="Maximum Open Trades"
                description="Simultaneous open positions allowed"
              >
                <NumberInput
                  value={localSettings.max_open_trades}
                  onChange={(v) => updateLocal("max_open_trades", Math.round(v))}
                  min={1}
                  max={50}
                  step={1}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Lot Sizing */}
          <Card className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-6">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/60 uppercase tracking-widest">
                Lot Sizing
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pt-4 pb-6 space-y-1">
              <SettingRow
                label="Reference Balance"
                description="Account balance baseline for scaling lot sizes"
              >
                <NumberInput
                  value={localSettings.lot_reference_balance}
                  onChange={(v) => updateLocal("lot_reference_balance", v)}
                  min={100}
                  max={1000000}
                  step={100}
                  suffix={currencyData.symbol}
                />
              </SettingRow>
              <SettingRow
                label="GOLD Reference Lot"
                description="Base lot size for XAUUSD at reference balance"
              >
                <NumberInput
                  value={localSettings.lot_reference_size_gold}
                  onChange={(v) => updateLocal("lot_reference_size_gold", v)}
                  min={0.01}
                  max={50}
                  step={0.01}
                />
              </SettingRow>
              <SettingRow
                label="Default Reference Lot"
                description="Base lot size for other pairs at reference balance"
              >
                <NumberInput
                  value={localSettings.lot_reference_size_default}
                  onChange={(v) => updateLocal("lot_reference_size_default", v)}
                  min={0.01}
                  max={50}
                  step={0.01}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Trade Execution */}
          <Card className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-6">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/60 uppercase tracking-widest">
                Trade Execution
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pt-4 pb-6 space-y-1">
              <SettingRow
                label="Auto-Accept Symbols"
                description="These symbols bypass confirmation and execute instantly"
              >
                <SymbolTags
                  symbols={localSettings.auto_accept_symbols || []}
                  onChange={(v) => updateLocal("auto_accept_symbols", v)}
                />
              </SettingRow>
              <SettingRow
                label="GOLD Market Threshold"
                description="Max price deviation for pending-to-market conversion"
              >
                <NumberInput
                  value={localSettings.gold_market_threshold}
                  onChange={(v) => updateLocal("gold_market_threshold", v)}
                  min={0}
                  max={100}
                  step={0.5}
                  suffix={currencyData.symbol}
                />
              </SettingRow>
              <SettingRow
                label="Split Take Profits"
                description="Split position size across multiple TP targets"
              >
                <Switch
                  checked={localSettings.split_tps}
                  onCheckedChange={(v) => updateLocal("split_tps", v)}
                  className="data-[state=checked]:bg-foreground"
                />
              </SettingRow>

              {localSettings.split_tps && (
                <div className="bg-white/[0.02] rounded-xl p-4 mt-3 border border-white/[0.04] animate-in slide-in-from-top-1 duration-200 space-y-4">
                  <SettingRow
                    label="Lot Size Mode"
                    description="How lot size is handled for multiple TPs"
                    className="py-0"
                  >
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateLocal("tp_lot_mode", "split")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          localSettings.tp_lot_mode === "split" || !localSettings.tp_lot_mode
                            ? "bg-foreground text-background"
                            : "bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08]"
                        )}
                      >
                        Split
                      </button>
                      <button
                        onClick={() => updateLocal("tp_lot_mode", "equal")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          localSettings.tp_lot_mode === "equal"
                            ? "bg-foreground text-background"
                            : "bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08]"
                        )}
                      >
                        Equal
                      </button>
                    </div>
                  </SettingRow>
                  <p className="text-[10px] text-foreground-muted/60 -mt-2 ml-1">
                    {localSettings.tp_lot_mode === "equal"
                      ? "Each TP gets the FULL calculated lot size (e.g., 0.04 × 3 = 0.12 total)"
                      : "Total lot is SPLIT across TPs using ratios below (e.g., 0.04 total)"}
                  </p>

                  {(localSettings.tp_lot_mode === "split" || !localSettings.tp_lot_mode) && (
                    <SettingRow
                      label="TP Split Ratios"
                      description="Distribution of volume across TPs (must sum to 100%)"
                      className="py-0"
                    >
                      <TPRatioInputs
                        ratios={localSettings.tp_split_ratios || [0.5, 0.3, 0.2]}
                        onChange={(v) => updateLocal("tp_split_ratios", v)}
                      />
                    </SettingRow>
                  )}
                </div>
              )}

              <SettingRow
                label="Auto-Breakeven"
                description="Move Stop Loss to entry when TP1 is hit"
              >
                <Switch
                  checked={localSettings.enable_breakeven}
                  onCheckedChange={(v) => updateLocal("enable_breakeven", v)}
                  className="data-[state=checked]:bg-foreground"
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Broker */}
          <Card className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-6">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/60 uppercase tracking-widest">
                Broker
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pt-4 pb-6">
              <SettingRow
                label="Symbol Suffix"
                description="Broker-specific suffix (e.g., .raw, .pro)"
              >
                <Input
                  value={localSettings.symbol_suffix || ""}
                  onChange={(e) => updateLocal("symbol_suffix", e.target.value)}
                  placeholder=".pro"
                  className="w-20 h-9 px-3 text-center font-mono text-sm bg-white/[0.04] border-white/[0.08] rounded-lg focus:border-white/20 focus:bg-white/[0.06] focus:ring-0 transition-colors placeholder:text-foreground-muted/40"
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* System */}
          <Card className="bg-amber-500/[0.03] border border-amber-500/[0.12] rounded-2xl overflow-hidden">
            <CardContent className="px-6 py-5">
              <SettingRow
                label="Global Trading Pause"
                description="Stop all new signal processing and trade execution"
                className="py-0"
              >
                <Switch
                  checked={localSettings.paused}
                  onCheckedChange={(v) => updateLocal("paused", v)}
                  className="data-[state=checked]:bg-amber-500"
                />
              </SettingRow>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}

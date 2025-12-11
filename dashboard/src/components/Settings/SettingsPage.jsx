import { useState, useEffect } from "react";
import { Save, RotateCcw, AlertCircle, Check, Loader2, X, ExternalLink, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { getUserCredentials, updateUserCredentials } from "@/lib/supabase";
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
        "flex items-center justify-between py-5 first:pt-0 last:pb-0",
        className
      )}
    >
      <div className="flex flex-col gap-1 pr-8">
        <span className="text-[15px] font-medium text-foreground">
          {label}
        </span>
        {description && (
          <span className="text-[13px] text-foreground-muted/70 italic leading-relaxed max-w-sm">
            {description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step, suffix, className }) {
  const handleChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) onChange(val);
  };

  return (
    <div className="relative group">
      <Input
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        className={cn(
          "w-28 pr-8 font-mono text-sm bg-white/[0.03] border-white/[0.08] rounded-xl",
          "focus:border-white/20 focus:bg-white/[0.05] transition-all",
          "placeholder:text-foreground-muted/50",
          className
        )}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted/60 text-xs font-medium pointer-events-none">
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
    <div className="flex flex-wrap gap-2 items-center max-w-sm justify-end">
      {symbols.map((symbol) => (
        <Badge
          key={symbol}
          variant="secondary"
          className="bg-white/[0.06] text-foreground/80 hover:bg-white/[0.1] border-0 transition-colors pl-2.5 pr-1.5 py-1 h-7 rounded-lg font-medium"
        >
          {symbol}
          <button
            onClick={() => removeSymbol(symbol)}
            className="ml-1.5 hover:bg-white/10 rounded p-0.5 transition-colors"
          >
            <X size={12} className="opacity-60" />
          </button>
        </Badge>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addSymbol}
        placeholder="Add..."
        className="w-20 h-7 text-xs bg-white/[0.03] border-white/[0.08] rounded-lg focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-foreground-muted/40 placeholder:italic"
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
    <div className="flex flex-wrap gap-2 items-center max-w-sm justify-end">
      {channels.map((channel) => (
        <Badge
          key={channel}
          variant="outline"
          className="bg-white/[0.04] text-foreground/70 border-white/[0.08] hover:bg-white/[0.08] transition-colors pl-2.5 pr-1.5 py-1 h-7 rounded-lg font-mono text-xs"
        >
          {channel}
          <button
            onClick={() => removeChannel(channel)}
            className="ml-1.5 hover:bg-white/10 rounded p-0.5 transition-colors"
          >
            <X size={12} className="opacity-60" />
          </button>
        </Badge>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addChannel}
        placeholder="Add ID..."
        className="w-24 h-7 text-xs bg-white/[0.03] border-white/[0.08] rounded-lg focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-foreground-muted/40 placeholder:italic font-mono"
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
    <div className="flex items-center gap-3">
      {ratios.map((ratio, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] text-foreground-muted/60 font-medium uppercase tracking-wide">
            TP{i + 1}
          </span>
          <div className="relative">
            <Input
              type="number"
              value={ratio}
              onChange={(e) => handleChange(i, e.target.value)}
              step={0.1}
              min={0}
              max={1}
              className="w-16 h-8 px-2 bg-white/[0.03] border-white/[0.08] rounded-lg text-center font-mono text-sm focus:border-white/20 focus:bg-white/[0.05] transition-all"
            />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 ml-2">
        <div className="h-px w-3 bg-white/10" />
        <span
          className={cn(
            "text-sm font-medium font-mono",
            isValid ? "text-emerald-400/80" : "text-rose-400/80"
          )}
        >
          {(total * 100).toFixed(0)}%
        </span>
      </div>
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
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted/60 hover:text-foreground-muted transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
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
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Telegram credentials state
  const [telegramCreds, setTelegramCreds] = useState({
    telegram_api_id: "",
    telegram_api_hash: "",
    telegram_phone: "",
    telegram_connected: false,
  });
  const [telegramCredsOriginal, setTelegramCredsOriginal] = useState(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramError, setTelegramError] = useState("");
  const [telegramSuccess, setTelegramSuccess] = useState(false);
  const [hasTelegramChanges, setHasTelegramChanges] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  // Load Telegram credentials
  useEffect(() => {
    const loadTelegramCreds = async () => {
      if (!user?.id) return;

      setTelegramLoading(true);
      try {
        const { data, error } = await getUserCredentials(user.id);
        if (error) {
          console.error("Error loading telegram credentials:", error);
        } else if (data) {
          const creds = {
            telegram_api_id: data.telegram_api_id || "",
            telegram_api_hash: data.telegram_api_hash || "",
            telegram_phone: data.telegram_phone || "",
            telegram_connected: data.telegram_connected || false,
          };
          setTelegramCreds(creds);
          setTelegramCredsOriginal(creds);
        }
      } catch (e) {
        console.error("Error loading telegram credentials:", e);
      } finally {
        setTelegramLoading(false);
      }
    };

    loadTelegramCreds();
  }, [user?.id]);

  const updateLocal = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const updateTelegramCred = (key, value) => {
    setTelegramCreds((prev) => ({ ...prev, [key]: value }));
    setHasTelegramChanges(true);
    setTelegramSuccess(false);
    setTelegramError("");
  };

  const handleSave = async () => {
    const success = await updateSettings(localSettings);
    if (success) {
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleSaveTelegram = async () => {
    if (!user?.id) return;

    // Validation
    if (telegramCreds.telegram_api_id && !/^\d+$/.test(telegramCreds.telegram_api_id)) {
      setTelegramError("API ID must be a number");
      return;
    }

    if (telegramCreds.telegram_phone && !/^\+?\d{10,15}$/.test(telegramCreds.telegram_phone.replace(/\s/g, ""))) {
      setTelegramError("Please enter a valid phone number with country code");
      return;
    }

    setTelegramSaving(true);
    setTelegramError("");

    try {
      const { error } = await updateUserCredentials(user.id, {
        telegram_api_id: telegramCreds.telegram_api_id || null,
        telegram_api_hash: telegramCreds.telegram_api_hash || null,
        telegram_phone: telegramCreds.telegram_phone || null,
        telegram_connected: false, // Reset connection status when credentials change
      });

      if (error) {
        setTelegramError(error.message || "Failed to save Telegram credentials");
      } else {
        setTelegramCredsOriginal(telegramCreds);
        setHasTelegramChanges(false);
        setTelegramSuccess(true);
        setTimeout(() => setTelegramSuccess(false), 3000);
      }
    } catch (e) {
      setTelegramError("An unexpected error occurred");
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
    setSaveSuccess(false);
  };

  const handleResetTelegram = () => {
    if (telegramCredsOriginal) {
      setTelegramCreds(telegramCredsOriginal);
    }
    setHasTelegramChanges(false);
    setTelegramError("");
    setTelegramSuccess(false);
  };

  const anyChanges = hasChanges || hasTelegramChanges;
  const anySaving = isSaving || telegramSaving;

  const handleSaveAll = async () => {
    if (hasChanges) {
      await handleSave();
    }
    if (hasTelegramChanges) {
      await handleSaveTelegram();
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
            {(saveSuccess || telegramSuccess) && (
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
            <CardContent className="px-6 pt-4 pb-6 space-y-1">
              {/* Instructions */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 mb-4">
                <p className="text-[13px] text-foreground-muted/70 italic leading-relaxed">
                  Get your API credentials from{" "}
                  <a
                    href="https://my.telegram.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/80 hover:text-foreground inline-flex items-center gap-1 not-italic font-medium"
                  >
                    my.telegram.org
                    <ExternalLink size={12} />
                  </a>
                  {" "}&mdash; create an app under "API development tools" to get your ID and Hash.
                </p>
              </div>

              {telegramLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
                </div>
              ) : (
                <>
                  <SettingRow
                    label="API ID"
                    description="Your Telegram application ID (numbers only)"
                  >
                    <Input
                      type="text"
                      value={telegramCreds.telegram_api_id}
                      onChange={(e) => updateTelegramCred("telegram_api_id", e.target.value)}
                      placeholder="12345678"
                      className="w-36 font-mono text-sm bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-foreground-muted/40 placeholder:italic"
                    />
                  </SettingRow>

                  <SettingRow
                    label="API Hash"
                    description="Your Telegram application hash"
                  >
                    <PasswordInput
                      value={telegramCreds.telegram_api_hash}
                      onChange={(e) => updateTelegramCred("telegram_api_hash", e.target.value)}
                      placeholder="Your API hash"
                      className="w-48 font-mono text-sm bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-foreground-muted/40 placeholder:italic"
                    />
                  </SettingRow>

                  <SettingRow
                    label="Phone Number"
                    description="Include country code (e.g., +1 for US)"
                  >
                    <Input
                      type="tel"
                      value={telegramCreds.telegram_phone}
                      onChange={(e) => updateTelegramCred("telegram_phone", e.target.value)}
                      placeholder="+1234567890"
                      className="w-40 font-mono text-sm bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-foreground-muted/40 placeholder:italic"
                    />
                  </SettingRow>

                  <SettingRow
                    label="Signal Channels"
                    description="Channel IDs to monitor for trading signals"
                  >
                    <ChannelTags
                      channels={localSettings.telegram_channel_ids || []}
                      onChange={(v) => updateLocal("telegram_channel_ids", v)}
                    />
                  </SettingRow>

                  {telegramCreds.telegram_connected && (
                    <div className="flex items-center gap-2 pt-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-emerald-400/80 italic">Connected</span>
                    </div>
                  )}
                </>
              )}
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
                  suffix="$"
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
                  suffix="$"
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
                <div className="bg-white/[0.02] rounded-xl p-4 mt-3 border border-white/[0.04] animate-in slide-in-from-top-1 duration-200">
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
                description="Broker-specific suffix appended to symbols (e.g., .raw, .pro)"
              >
                <Input
                  value={localSettings.symbol_suffix || ""}
                  onChange={(e) => updateLocal("symbol_suffix", e.target.value)}
                  placeholder=".pro"
                  className="w-24 font-mono text-sm bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-foreground-muted/40 placeholder:italic"
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

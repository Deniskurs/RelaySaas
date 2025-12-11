import { useState, useEffect } from "react";
import { Save, RotateCcw, AlertCircle, Check, Loader2, Activity, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

function SettingRow({ label, description, children, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-6 first:pt-0 last:pb-0",
        className
      )}
    >
      <div className="flex flex-col gap-1.5 pr-8">
        <span className="text-base font-medium text-foreground tracking-tight">
          {label}
        </span>
        {description && (
          <span className="text-sm text-foreground-muted leading-relaxed max-w-md">
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
          "w-32 pr-8 font-mono text-sm bg-background/50 border-white/10 focus:border-primary/50 transition-all",
          className
        )}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted text-xs font-medium pointer-events-none group-focus-within:text-primary transition-colors">
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
    <div className="flex flex-wrap gap-2 items-center max-w-md justify-end">
      {symbols.map((symbol) => (
        <Badge
          key={symbol}
          variant="secondary"
          className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary-foreground border-primary/20 transition-colors pl-2 pr-1 py-1 h-7"
        >
          {symbol}
          <button
            onClick={() => removeSymbol(symbol)}
            className="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
          >
            <X size={12} />
          </button>
        </Badge>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addSymbol}
        placeholder="Add symbol..."
        className="w-28 h-8 text-xs bg-background/50 border-white/10 focus:border-primary/50 transition-all"
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
    <div className="flex flex-wrap gap-2 items-center max-w-md justify-end">
      {channels.map((channel) => (
        <Badge
          key={channel}
          variant="outline"
          className="bg-accent-purple/10 text-accent-purple border-accent-purple/20 hover:bg-accent-purple/20 transition-colors pl-2 pr-1 py-1 h-7"
        >
          {channel}
          <button
            onClick={() => removeChannel(channel)}
            className="ml-1 hover:bg-accent-purple/20 rounded-full p-0.5 transition-colors"
          >
            <X size={12} />
          </button>
        </Badge>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addChannel}
        placeholder="Add ID..."
        className="w-28 h-8 text-xs bg-background/50 border-white/10 focus:border-primary/50 transition-all"
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

  return (
    <div className="flex items-center gap-2">
      {ratios.map((ratio, i) => (
        <div key={i} className="relative group">
          <span className="absolute -top-5 left-0 text-xs text-foreground-muted font-medium">
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
              className="w-20 pl-3 pr-8 h-9 bg-background/50 border-white/10 focus:border-primary/50 text-center font-mono"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted text-xs">
              %
            </span>
          </div>
        </div>
      ))}
      <div className="h-px w-4 bg-white/10 mx-1" />
      <span
        className={cn(
          "text-sm font-medium",
          Math.abs(ratios.reduce((a, b) => a + b, 0) - 1) < 0.001
            ? "text-success"
            : "text-destructive"
        )}
      >
        Total: {(ratios.reduce((a, b) => a + b, 0) * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const {
    settings,
    isLoading,
    isSaving,
    error,
    updateSettings,
    reloadSettings,
  } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const updateLocal = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    const success = await updateSettings(localSettings);
    if (success) {
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
    setSaveSuccess(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-xl py-6 z-10 border-b border-white/5 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-foreground to-foreground-muted bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-sm text-foreground-muted font-medium mt-1">
              Configure your trading parameters and risk controls
            </p>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-sm text-destructive flex items-center gap-1.5 bg-destructive/10 px-3 py-1.5 rounded-full border border-destructive/20">
                <AlertCircle size={14} />
                {error}
              </span>
            )}
            {saveSuccess && (
              <span className="text-sm text-success flex items-center gap-1.5 bg-success/10 px-3 py-1.5 rounded-full border border-success/20 animate-in fade-in slide-in-from-right-4">
                <Check size={14} />
                Saved
              </span>
            )}
            {hasChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="border-white/10 hover:bg-white/5"
              >
                <RotateCcw size={14} className="mr-2" />
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={cn(
                "min-w-[140px] shadow-lg shadow-primary/20",
                hasChanges && "animate-pulse"
              )}
            >
              {isSaving ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Save size={14} className="mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <div className="grid gap-8">
          {/* Risk Management */}
          <Card className="glass-card border-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-transparent to-transparent pointer-events-none" />
            <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2.5">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <AlertCircle size={18} className="text-destructive" />
                </div>
                Risk Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-6">
              <SettingRow
                label="Maximum Risk Per Trade"
                description="Percentage of account balance to risk per trade. Used to calculate lot sizes automatically."
              >
                <div className="relative group">
                  <NumberInput
                    value={localSettings.max_risk_percent}
                    onChange={(v) => updateLocal("max_risk_percent", v)}
                    min={0.1}
                    max={10}
                    step={0.1}
                    suffix="%"
                    className="pr-8"
                  />
                </div>
              </SettingRow>
              <Separator className="bg-white/5" />
              <SettingRow
                label="Maximum Lot Size"
                description="Absolute upper limit for any single position size, regardless of risk calculations."
              >
                <NumberInput
                  value={localSettings.max_lot_size}
                  onChange={(v) => updateLocal("max_lot_size", v)}
                  min={0.01}
                  max={100}
                  step={0.01}
                />
              </SettingRow>
              <Separator className="bg-white/5" />
              <SettingRow
                label="Maximum Open Trades"
                description="Maximum number of simultaneous open positions allowed."
              >
                <NumberInput
                  value={localSettings.max_open_trades}
                  onChange={(v) =>
                    updateLocal("max_open_trades", Math.round(v))
                  }
                  min={1}
                  max={50}
                  step={1}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Lot Sizing */}
          <Card className="glass-card border-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Activity size={18} className="text-primary" />
                </div>
                Lot Sizing Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-6">
              <SettingRow
                label="Reference Balance"
                description="Account balance baseline used for scaling lot sizes dynamically."
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
              <Separator className="bg-white/5" />
              <SettingRow
                label="GOLD Reference Lot"
                description="Base lot size for XAUUSD/GOLD at the reference balance."
              >
                <NumberInput
                  value={localSettings.lot_reference_size_gold}
                  onChange={(v) => updateLocal("lot_reference_size_gold", v)}
                  min={0.01}
                  max={50}
                  step={0.01}
                />
              </SettingRow>
              <Separator className="bg-white/5" />
              <SettingRow
                label="Default Reference Lot"
                description="Base lot size for all other pairs at the reference balance."
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
          <Card className="glass-card border-0">
            <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2.5">
                <div className="p-2 bg-accent-purple/10 rounded-lg">
                  <Check size={18} className="text-accent-purple" />
                </div>
                Trade Execution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-6">
              <SettingRow
                label="Auto-Accept Symbols"
                description="Trades for these symbols will bypass confirmation and execute instantly."
              >
                <SymbolTags
                  symbols={localSettings.auto_accept_symbols || []}
                  onChange={(v) => updateLocal("auto_accept_symbols", v)}
                />
              </SettingRow>
              <Separator className="bg-white/5" />
              <SettingRow
                label="GOLD Market Threshold"
                description="Maximum price deviation ($) allowed for pending orders converted to market execution."
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
              <Separator className="bg-white/5" />
              <SettingRow
                label="Split Take Profits"
                description="Automatically split position size across multiple TP targets."
              >
                <Switch
                  checked={localSettings.split_tps}
                  onCheckedChange={(v) => updateLocal("split_tps", v)}
                />
              </SettingRow>

              {localSettings.split_tps && (
                <div className="bg-white/5 rounded-xl p-4 mt-2 mb-4 border border-white/5 animate-in slide-in-from-top-2">
                  <SettingRow
                    label="TP Split Ratios"
                    description="Distribution of volume across TPs (must sum to 100%)."
                    className="py-0 border-0"
                  >
                    <TPRatioInputs
                      ratios={localSettings.tp_split_ratios || [0.5, 0.3, 0.2]}
                      onChange={(v) => updateLocal("tp_split_ratios", v)}
                    />
                  </SettingRow>
                </div>
              )}

              <Separator className="bg-white/5" />
              <SettingRow
                label="Auto-Breakeven"
                description="Automatically move Stop Loss to entry price when TP1 is hit."
              >
                <Switch
                  checked={localSettings.enable_breakeven}
                  onCheckedChange={(v) => updateLocal("enable_breakeven", v)}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Broker & Telegram */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="glass-card border-0">
              <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  Broker Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-6">
                <SettingRow
                  label="Symbol Suffix"
                  description="Broker specific suffix (e.g. .raw)"
                >
                  <Input
                    value={localSettings.symbol_suffix || ""}
                    onChange={(e) =>
                      updateLocal("symbol_suffix", e.target.value)
                    }
                    placeholder="e.g., .pro"
                    className="w-32 font-mono text-sm bg-background/50 border-white/10"
                  />
                </SettingRow>
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  Telegram Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-6">
                <SettingRow
                  label="Signal Channels"
                  description="Monitor these channels for signals"
                >
                  <ChannelTags
                    channels={localSettings.telegram_channel_ids || []}
                    onChange={(v) => updateLocal("telegram_channel_ids", v)}
                  />
                </SettingRow>
              </CardContent>
            </Card>
          </div>

          {/* System */}
          <Card className="glass-card border-0 border-l-4 border-l-warning">
            <CardContent className="py-6">
              <SettingRow
                label="Global Trading Pause"
                description="Immediately stop all new signal processing and trade execution."
              >
                <Switch
                  checked={localSettings.paused}
                  onCheckedChange={(v) => updateLocal("paused", v)}
                  className="data-[state=checked]:bg-warning"
                />
              </SettingRow>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}

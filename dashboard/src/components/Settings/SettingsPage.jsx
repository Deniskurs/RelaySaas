import { useState, useEffect } from "react";
import { Save, RotateCcw, AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="text-xs text-foreground-muted">{description}</span>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, suffix, className }) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className={cn("w-24 text-right font-mono", className)}
      />
      {suffix && <span className="text-sm text-foreground-muted">{suffix}</span>}
    </div>
  );
}

function SymbolTags({ symbols, onChange }) {
  const [inputValue, setInputValue] = useState("");

  const addSymbol = () => {
    const symbol = inputValue.trim().toUpperCase();
    if (symbol && !symbols.includes(symbol)) {
      onChange([...symbols, symbol]);
      setInputValue("");
    }
  };

  const removeSymbol = (symbol) => {
    onChange(symbols.filter((s) => s !== symbol));
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-xs">
      <div className="flex flex-wrap gap-1">
        {symbols.map((symbol) => (
          <Badge
            key={symbol}
            variant="secondary"
            className="cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
            onClick={() => removeSymbol(symbol)}
          >
            {symbol} ×
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && addSymbol()}
          placeholder="Add symbol..."
          className="flex-1 font-mono text-sm"
        />
        <Button size="sm" variant="outline" onClick={addSymbol}>
          Add
        </Button>
      </div>
    </div>
  );
}

function ChannelTags({ channels, onChange }) {
  const [inputValue, setInputValue] = useState("");

  const addChannel = () => {
    const channel = inputValue.trim();
    if (channel && !channels.includes(channel)) {
      onChange([...channels, channel]);
      setInputValue("");
    }
  };

  const removeChannel = (channel) => {
    onChange(channels.filter((c) => c !== channel));
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      <div className="flex flex-wrap gap-1">
        {channels.map((channel) => (
          <Badge
            key={channel}
            variant="secondary"
            className="cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors font-mono text-xs"
            onClick={() => removeChannel(channel)}
          >
            {channel} ×
          </Badge>
        ))}
        {channels.length === 0 && (
          <span className="text-xs text-foreground-muted">No channels configured</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addChannel()}
          placeholder="Channel ID or @username"
          className="flex-1 font-mono text-sm"
        />
        <Button size="sm" variant="outline" onClick={addChannel}>
          Add
        </Button>
      </div>
    </div>
  );
}

function TPRatioInputs({ ratios, onChange }) {
  const updateRatio = (index, value) => {
    const newRatios = [...ratios];
    newRatios[index] = value;
    onChange(newRatios);
  };

  const total = ratios.reduce((a, b) => a + b, 0);
  const isValid = Math.abs(total - 1) < 0.01;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {ratios.map((ratio, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <span className="text-xs text-foreground-muted">TP{idx + 1}</span>
            <Input
              type="number"
              value={Math.round(ratio * 100)}
              onChange={(e) => updateRatio(idx, (parseFloat(e.target.value) || 0) / 100)}
              min={0}
              max={100}
              step={5}
              className="w-16 text-center font-mono text-sm"
            />
            <span className="text-xs text-foreground-muted">%</span>
          </div>
        ))}
      </div>
      {!isValid && (
        <span className="text-xs text-destructive">
          Total must equal 100% (currently {Math.round(total * 100)}%)
        </span>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, isLoading, isSaving, error, updateSettings, reloadSettings } = useSettings();
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
      <div className="space-y-6 pr-4">
        {/* Header */}
        <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm py-4 z-10">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
            <p className="text-sm text-foreground-muted">
              Configure your trading parameters
            </p>
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle size={14} />
                {error}
              </span>
            )}
            {saveSuccess && (
              <span className="text-sm text-success flex items-center gap-1">
                <Check size={14} />
                Saved
              </span>
            )}
            {hasChanges && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw size={14} className="mr-1" />
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={cn(hasChanges && "animate-pulse")}
            >
              {isSaving ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Save size={14} className="mr-1" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Risk Management */}
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
              Risk Management
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              description="Upper limit for any single position"
            >
              <NumberInput
                value={localSettings.max_lot_size}
                onChange={(v) => updateLocal("max_lot_size", v)}
                min={0.01}
                max={10}
                step={0.01}
              />
            </SettingRow>
            <SettingRow
              label="Maximum Open Trades"
              description="Maximum simultaneous positions allowed"
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
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
              Lot Sizing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Reference Balance"
              description="Account balance used as baseline for lot calculations"
            >
              <NumberInput
                value={localSettings.lot_reference_balance}
                onChange={(v) => updateLocal("lot_reference_balance", v)}
                min={100}
                max={100000}
                step={100}
              />
            </SettingRow>
            <SettingRow
              label="GOLD Lot Size"
              description="Lot size for GOLD/XAUUSD at reference balance"
            >
              <NumberInput
                value={localSettings.lot_reference_size_gold}
                onChange={(v) => updateLocal("lot_reference_size_gold", v)}
                min={0.01}
                max={1}
                step={0.01}
              />
            </SettingRow>
            <SettingRow
              label="Default Lot Size"
              description="Lot size for other symbols at reference balance"
            >
              <NumberInput
                value={localSettings.lot_reference_size_default}
                onChange={(v) => updateLocal("lot_reference_size_default", v)}
                min={0.01}
                max={1}
                step={0.01}
              />
            </SettingRow>
          </CardContent>
        </Card>

        {/* Trade Execution */}
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
              Trade Execution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Auto-Accept Symbols"
              description="Trades for these symbols execute automatically without confirmation"
            >
              <SymbolTags
                symbols={localSettings.auto_accept_symbols || []}
                onChange={(v) => updateLocal("auto_accept_symbols", v)}
              />
            </SettingRow>
            <SettingRow
              label="GOLD Market Threshold"
              description="Use market order if GOLD price differs by this amount from entry"
            >
              <NumberInput
                value={localSettings.gold_market_threshold}
                onChange={(v) => updateLocal("gold_market_threshold", v)}
                min={0}
                max={20}
                step={0.5}
                suffix="$"
              />
            </SettingRow>
            <Separator className="my-2" />
            <SettingRow
              label="Split Take Profits"
              description="Split position across multiple take profit levels"
            >
              <Switch
                checked={localSettings.split_tps}
                onCheckedChange={(v) => updateLocal("split_tps", v)}
              />
            </SettingRow>
            {localSettings.split_tps && (
              <SettingRow
                label="TP Split Ratios"
                description="Percentage of position to close at each TP level"
              >
                <TPRatioInputs
                  ratios={localSettings.tp_split_ratios || [0.5, 0.3, 0.2]}
                  onChange={(v) => updateLocal("tp_split_ratios", v)}
                />
              </SettingRow>
            )}
            <SettingRow
              label="Auto-Breakeven"
              description="Move stop loss to entry after TP1 is hit"
            >
              <Switch
                checked={localSettings.enable_breakeven}
                onCheckedChange={(v) => updateLocal("enable_breakeven", v)}
              />
            </SettingRow>
          </CardContent>
        </Card>

        {/* Broker Settings */}
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
              Broker Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Symbol Suffix"
              description="Suffix added to symbol names (e.g., .raw, m, .ecn)"
            >
              <Input
                value={localSettings.symbol_suffix || ""}
                onChange={(e) => updateLocal("symbol_suffix", e.target.value)}
                placeholder="e.g., .raw"
                className="w-32 font-mono text-sm"
              />
            </SettingRow>
          </CardContent>
        </Card>

        {/* Telegram */}
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
              Telegram
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Signal Channels"
              description="Telegram channel IDs or usernames to monitor for signals"
            >
              <ChannelTags
                channels={localSettings.telegram_channel_ids || []}
                onChange={(v) => updateLocal("telegram_channel_ids", v)}
              />
            </SettingRow>
          </CardContent>
        </Card>

        {/* System */}
        <Card className="glass-card border-0 mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
              System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Trading Paused"
              description="When enabled, no new trades will be executed"
            >
              <Switch
                checked={localSettings.paused}
                onCheckedChange={(v) => updateLocal("paused", v)}
              />
            </SettingRow>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

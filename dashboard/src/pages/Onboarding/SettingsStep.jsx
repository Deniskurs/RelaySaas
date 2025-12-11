import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserSettings } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, AlertCircle, Check, Settings } from "lucide-react";

const DEFAULT_SETTINGS = {
  max_risk_percent: 2.0,
  max_lot_size: 0.1,
  max_open_trades: 5,
  lot_reference_balance: 500,
  enable_breakeven: true,
  split_tps: true,
};

export default function SettingsStep({ onComplete }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate settings
    if (settings.max_risk_percent < 0.1 || settings.max_risk_percent > 10) {
      setError("Risk per trade must be between 0.1% and 10%");
      return;
    }
    if (settings.max_lot_size < 0.01 || settings.max_lot_size > 10) {
      setError("Max lot size must be between 0.01 and 10");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await updateUserSettings(user.id, settings);

      if (updateError) {
        setError(updateError.message || "Failed to save settings");
        return;
      }

      onComplete();
    } catch (e) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-foreground-muted">
        Configure your trading parameters. You can adjust these anytime in Settings.
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Risk Management */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Risk Management
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Max Risk Per Trade
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={settings.max_risk_percent}
                  onChange={(e) => updateSetting("max_risk_percent", parseFloat(e.target.value) || 0)}
                  min={0.1}
                  max={10}
                  step={0.1}
                  className="bg-background/50 font-mono"
                  disabled={isLoading}
                />
                <span className="text-sm text-foreground-muted">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Max Lot Size
              </label>
              <Input
                type="number"
                value={settings.max_lot_size}
                onChange={(e) => updateSetting("max_lot_size", parseFloat(e.target.value) || 0)}
                min={0.01}
                max={10}
                step={0.01}
                className="bg-background/50 font-mono"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Max Open Trades
              </label>
              <Input
                type="number"
                value={settings.max_open_trades}
                onChange={(e) => updateSetting("max_open_trades", parseInt(e.target.value) || 1)}
                min={1}
                max={50}
                step={1}
                className="bg-background/50 font-mono"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Reference Balance
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={settings.lot_reference_balance}
                  onChange={(e) => updateSetting("lot_reference_balance", parseFloat(e.target.value) || 100)}
                  min={100}
                  max={100000}
                  step={100}
                  className="bg-background/50 font-mono"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-foreground-muted">
                Balance used as baseline for lot calculations
              </p>
            </div>
          </div>
        </div>

        {/* Trade Execution */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Trade Execution
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-background-raised rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">Split Take Profits</p>
                <p className="text-xs text-foreground-muted">
                  Split position across multiple TP levels
                </p>
              </div>
              <Switch
                checked={settings.split_tps}
                onCheckedChange={(v) => updateSetting("split_tps", v)}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-background-raised rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">Auto-Breakeven</p>
                <p className="text-xs text-foreground-muted">
                  Move stop loss to entry after TP1 hit
                </p>
              </div>
              <Switch
                checked={settings.enable_breakeven}
                onCheckedChange={(v) => updateSetting("enable_breakeven", v)}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-4">
          <Button type="submit" disabled={isLoading} size="lg">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Complete Setup
          </Button>
        </div>
      </form>
    </div>
  );
}

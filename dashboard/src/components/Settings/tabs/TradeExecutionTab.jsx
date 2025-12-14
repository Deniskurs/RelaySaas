import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { SettingRow, NumberInput, TPRatioInputs } from "../SettingsComponents";

export default function TradeExecutionTab({
  settings,
  onSettingChange,
  currencySymbol = "$",
}) {
  return (
    <div className="space-y-6">
      <Card className={cn(
        "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
        "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
        "hover:border-white/[0.08] hover:bg-white/[0.025]",
        "transition-all duration-300"
      )}>
        <CardHeader className="pb-0 pt-6 px-8">
          <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
            Trade Execution Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8 space-y-2">
          <SettingRow
            label="GOLD Market Threshold"
            description="Max price deviation for pending-to-market conversion"
          >
            <NumberInput
              value={settings.gold_market_threshold}
              onChange={(v) => onSettingChange("gold_market_threshold", v)}
              min={0}
              max={100}
              step={0.5}
              suffix={currencySymbol}
            />
          </SettingRow>

          <SettingRow
            label="Split Take Profits"
            description="Split position size across multiple TP targets"
          >
            <Switch
              checked={settings.split_tps}
              onCheckedChange={(v) => onSettingChange("split_tps", v)}
              className="data-[state=checked]:bg-foreground"
            />
          </SettingRow>

          {settings.split_tps && (
            <div className="bg-white/[0.02] rounded-none p-4 mt-3 border border-white/[0.04] animate-in slide-in-from-top-1 duration-200 space-y-4">
              <SettingRow
                label="Lot Size Mode"
                description="How lot size is handled for multiple TPs"
                className="py-0"
              >
                <div className="flex gap-2">
                  <button
                    onClick={() => onSettingChange("tp_lot_mode", "split")}
                    className={cn(
                      "px-4 py-2 rounded-none text-xs font-medium transition-all duration-200",
                      settings.tp_lot_mode === "split" || !settings.tp_lot_mode
                        ? "bg-foreground text-background shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
                        : "bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08] hover:text-foreground"
                    )}
                  >
                    Split
                  </button>
                  <button
                    onClick={() => onSettingChange("tp_lot_mode", "equal")}
                    className={cn(
                      "px-4 py-2 rounded-none text-xs font-medium transition-all duration-200",
                      settings.tp_lot_mode === "equal"
                        ? "bg-foreground text-background shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
                        : "bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08] hover:text-foreground"
                    )}
                  >
                    Equal
                  </button>
                </div>
              </SettingRow>
              <p className="text-[10px] text-foreground-muted/60 -mt-2 ml-1">
                {settings.tp_lot_mode === "equal"
                  ? "Each TP gets the FULL calculated lot size (e.g., 0.04 × 3 = 0.12 total)"
                  : "Total lot is SPLIT across TPs using ratios below (e.g., 0.04 total)"}
              </p>

              {(settings.tp_lot_mode === "split" || !settings.tp_lot_mode) && (
                <SettingRow
                  label="TP Split Ratios"
                  description="Distribution of volume across TPs (must sum to 100%)"
                  className="py-0"
                >
                  <TPRatioInputs
                    ratios={settings.tp_split_ratios || [0.5, 0.3, 0.2]}
                    onChange={(v) => onSettingChange("tp_split_ratios", v)}
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
              checked={settings.enable_breakeven}
              onCheckedChange={(v) => onSettingChange("enable_breakeven", v)}
              className="data-[state=checked]:bg-foreground"
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Broker Settings */}
      <Card className={cn(
        "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
        "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
        "hover:border-white/[0.08] hover:bg-white/[0.025]",
        "transition-all duration-300"
      )}>
        <CardHeader className="pb-0 pt-6 px-8">
          <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
            Broker Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8">
          <SettingRow
            label="Symbol Suffix"
            description="Broker-specific suffix (e.g., .raw, .pro)"
          >
            <Input
              value={settings.symbol_suffix || ""}
              onChange={(e) => onSettingChange("symbol_suffix", e.target.value)}
              placeholder=".pro"
              className={cn(
                "w-20 h-10 px-3 text-center font-mono text-[13px]",
                "bg-white/[0.03] border-white/[0.08] rounded-none",
                "hover:border-white/[0.12] hover:bg-white/[0.04]",
                "focus:border-white/[0.20] focus:bg-white/[0.05]",
                "focus:ring-2 focus:ring-white/[0.06] focus:ring-offset-0",
                "transition-all duration-200 placeholder:text-foreground-muted/40"
              )}
            />
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SettingRow, NumberInput, SymbolTags } from "../SettingsComponents";

export default function QuickSettingsTab({
  settings,
  onSettingChange,
}) {
  return (
    <div className="space-y-6">
      {/* Risk Management */}
      <Card className={cn(
        "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
        "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
        "hover:border-white/[0.08] hover:bg-white/[0.025]",
        "transition-all duration-300"
      )}>
        <CardHeader className="pb-0 pt-6 px-8">
          <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
            Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8 space-y-2">
          <SettingRow
            label="Maximum Risk Per Trade"
            description="Percentage of account balance to risk per trade"
          >
            <NumberInput
              value={settings.max_risk_percent}
              onChange={(v) => onSettingChange("max_risk_percent", v)}
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
              value={settings.max_lot_size}
              onChange={(v) => onSettingChange("max_lot_size", v)}
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
              value={settings.max_open_trades}
              onChange={(v) => onSettingChange("max_open_trades", Math.round(v))}
              min={1}
              max={50}
              step={1}
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Auto-Accept Symbols */}
      <Card className={cn(
        "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
        "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
        "hover:border-white/[0.08] hover:bg-white/[0.025]",
        "transition-all duration-300"
      )}>
        <CardHeader className="pb-0 pt-6 px-8">
          <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
            Auto-Accept Symbols
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8">
          <SettingRow
            label="Symbols"
            description="These symbols bypass confirmation and execute instantly"
          >
            <SymbolTags
              symbols={settings.auto_accept_symbols || []}
              onChange={(v) => onSettingChange("auto_accept_symbols", v)}
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* System Controls - Prominent warning card */}
      <Card className={cn(
        "bg-amber-500/[0.03] border border-amber-500/[0.12] rounded-lg overflow-hidden",
        "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
        "hover:border-amber-500/[0.16]",
        "transition-all duration-300"
      )}>
        <CardHeader className="pb-0 pt-6 px-8">
          <CardTitle className="text-[11px] font-semibold text-amber-500/70 uppercase tracking-widest">
            System Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8">
          <SettingRow
            label="Global Trading Pause"
            description="Stop all new signal processing and trade execution"
            className="py-0"
          >
            <Switch
              checked={settings.paused}
              onCheckedChange={(v) => onSettingChange("paused", v)}
              className="data-[state=checked]:bg-amber-500"
            />
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  );
}

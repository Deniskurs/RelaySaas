import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingRow, NumberInput } from "../SettingsComponents";

export default function LotSizingTab({
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
            Lot Sizing Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8 space-y-2">
          <SettingRow
            label="Reference Balance"
            description="Account balance baseline for scaling lot sizes"
          >
            <NumberInput
              value={settings.lot_reference_balance}
              onChange={(v) => onSettingChange("lot_reference_balance", v)}
              min={100}
              max={1000000}
              step={100}
              suffix={currencySymbol}
            />
          </SettingRow>
          <SettingRow
            label="GOLD Reference Lot"
            description="Base lot size for XAUUSD at reference balance"
          >
            <NumberInput
              value={settings.lot_reference_size_gold}
              onChange={(v) => onSettingChange("lot_reference_size_gold", v)}
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
              value={settings.lot_reference_size_default}
              onChange={(v) => onSettingChange("lot_reference_size_default", v)}
              min={0.01}
              max={50}
              step={0.01}
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Info card explaining lot sizing */}
      <Card className={cn(
        "bg-white/[0.015] border border-white/[0.04] rounded-lg overflow-hidden"
      )}>
        <CardContent className="px-8 py-6">
          <p className="text-xs text-foreground-muted/60 leading-relaxed">
            <strong className="text-foreground-muted/80">How lot sizing works:</strong> Your actual lot size is calculated based on your current account balance relative to the reference balance. If your account is larger than the reference, lots scale up proportionally. If smaller, they scale down.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

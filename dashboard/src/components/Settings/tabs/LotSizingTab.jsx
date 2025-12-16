import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingRow, NumberInput } from "../SettingsComponents";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, ChevronDown, ChevronUp, TrendingUp, Shield, AlertCircle } from "lucide-react";

export default function LotSizingTab({
  settings,
  onSettingChange,
  currencySymbol = "$",
}) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="space-y-6">
      {/* How It Works - Expandable Explanation */}
      <Card className={cn(
        "bg-gradient-to-br from-blue-500/[0.06] to-blue-600/[0.04] border border-blue-500/[0.15] rounded-lg overflow-hidden",
        "shadow-[0_1px_3px_rgba(59,130,246,0.1)]"
      )}>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Info size={16} className="text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground">How Lot Sizing Works</h3>
              <p className="text-xs text-foreground-muted/70">Understanding the calculation logic</p>
            </div>
          </div>
          {showExplanation ? (
            <ChevronUp size={18} className="text-foreground-muted/60" />
          ) : (
            <ChevronDown size={18} className="text-foreground-muted/60" />
          )}
        </button>

        {showExplanation && (
          <div className="px-8 pb-6 space-y-5 border-t border-blue-500/[0.1] pt-5">
            {/* Visual Flow Diagram */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-blue-500/60 rounded-full"></div>
                <span className="text-xs font-semibold text-foreground-muted/80 uppercase tracking-wide">Calculation Flow</span>
              </div>

              {/* Step 1: Two Calculations Run in Parallel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reference Lot Calculation */}
                <div className="bg-white/[0.03] border border-emerald-500/[0.15] rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Reference Lot (Floor)</span>
                  </div>
                  <div className="text-xs text-foreground-muted/80 space-y-1 font-mono">
                    <div className="bg-black/20 rounded px-2 py-1.5">
                      (Current Balance / Reference Balance) × Reference Lot
                    </div>
                  </div>
                  <p className="text-[11px] text-foreground-muted/60 leading-relaxed pt-1">
                    Scales with your account size. This is your <strong className="text-emerald-400">MINIMUM</strong> lot size.
                  </p>
                </div>

                {/* Risk-Based Calculation */}
                <div className="bg-white/[0.03] border border-amber-500/[0.15] rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400">Risk-Based Lot</span>
                  </div>
                  <div className="text-xs text-foreground-muted/80 space-y-1 font-mono">
                    <div className="bg-black/20 rounded px-2 py-1.5">
                      (Balance × Risk%) / (SL Distance × Pip Value)
                    </div>
                  </div>
                  <p className="text-[11px] text-foreground-muted/60 leading-relaxed pt-1">
                    Based on stop loss and risk percentage. Can be <strong className="text-amber-400">LARGER</strong> than reference.
                  </p>
                </div>
              </div>

              {/* Step 2: Take the Larger */}
              <div className="flex items-center justify-center">
                <div className="w-px h-6 bg-gradient-to-b from-white/[0.1] to-white/[0.3]"></div>
              </div>

              <div className="bg-white/[0.03] border border-purple-500/[0.15] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={14} className="text-purple-400" />
                  <span className="text-xs font-semibold text-purple-400">Step 2: Maximum Selection</span>
                </div>
                <p className="text-xs text-foreground-muted/80">
                  The system selects <strong className="text-purple-400">the LARGER value</strong> between Reference Lot and Risk-Based Lot
                </p>
              </div>

              {/* Step 3: Cap by Max Lot */}
              <div className="flex items-center justify-center">
                <div className="w-px h-6 bg-gradient-to-b from-white/[0.3] to-white/[0.1]"></div>
              </div>

              <div className="bg-white/[0.03] border border-rose-500/[0.15] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={14} className="text-rose-400" />
                  <span className="text-xs font-semibold text-rose-400">Step 3: Final Cap</span>
                </div>
                <p className="text-xs text-foreground-muted/80">
                  Final lot size is <strong className="text-rose-400">capped by Max Lot Size</strong> to prevent over-exposure
                </p>
              </div>
            </div>

            {/* Key Concepts */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></div>
                <p className="text-xs text-foreground-muted/80 leading-relaxed">
                  <strong className="text-foreground">Reference Lot is a FLOOR, not a cap:</strong> Your trades will never be smaller than the scaled reference lot, but can be larger if risk calculation allows it.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
                <p className="text-xs text-foreground-muted/80 leading-relaxed">
                  <strong className="text-foreground">Risk-based sizing is dynamic:</strong> Trades with tighter stop losses will allow larger lot sizes to maintain consistent risk exposure.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></div>
                <p className="text-xs text-foreground-muted/80 leading-relaxed">
                  <strong className="text-foreground">Max Lot Size is your safety net:</strong> This prevents any single trade from using excessive position size, regardless of other calculations.
                </p>
              </div>
            </div>

            {/* Example Scenario */}
            <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.08] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-accent-gold/80 rounded-full"></div>
                <span className="text-xs font-semibold text-accent-gold uppercase tracking-wide">Example</span>
              </div>
              <div className="space-y-2 text-xs text-foreground-muted/80 leading-relaxed">
                <p>
                  <span className="text-foreground-muted/60">Scenario:</span> Your balance is <strong className="text-foreground">${currencySymbol}1,000</strong>, reference balance is <strong className="text-foreground">${currencySymbol}500</strong>, reference lot is <strong className="text-foreground">0.01</strong>
                </p>
                <div className="pl-4 space-y-1 border-l-2 border-white/[0.06] ml-1">
                  <p><span className="text-emerald-400">Reference calculation:</span> (1000/500) × 0.01 = <strong>0.02 lots</strong></p>
                  <p><span className="text-amber-400">Risk calculation:</span> Might yield <strong>0.05 lots</strong> (for a tight SL)</p>
                  <p><span className="text-purple-400">Result:</span> System uses <strong>0.05 lots</strong> (the larger value)</p>
                  <p><span className="text-rose-400">If max lot is 0.03:</span> Final size is <strong>0.03 lots</strong> (capped)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Settings Card */}
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
          <TooltipProvider delayDuration={200}>
            {/* Reference Balance */}
            <SettingRow
              label={
                <div className="flex items-center gap-2">
                  <span>Reference Balance</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <Info size={13} className="text-foreground-muted/40 hover:text-foreground-muted/70 transition-colors" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-slate-900 border border-white/[0.1] text-xs leading-relaxed">
                      <p>The baseline balance used to scale your reference lot sizes. If your actual balance is higher, lots scale up proportionally.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              }
              description="Baseline for scaling lot sizes relative to your actual balance"
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

            {/* GOLD Reference Lot */}
            <SettingRow
              label={
                <div className="flex items-center gap-2">
                  <span>GOLD Reference Lot</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <Info size={13} className="text-foreground-muted/40 hover:text-foreground-muted/70 transition-colors" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-slate-900 border border-white/[0.1] text-xs leading-relaxed">
                      <p className="mb-1.5"><strong className="text-emerald-400">Minimum floor</strong> for XAUUSD trades at reference balance.</p>
                      <p>Actual lot size can be LARGER if risk-based calculation yields a higher value.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              }
              description={
                <span>
                  XAUUSD minimum lot at reference balance{" "}
                  <strong className="text-emerald-400/80">• Floor, not cap</strong>
                </span>
              }
            >
              <NumberInput
                value={settings.lot_reference_size_gold}
                onChange={(v) => onSettingChange("lot_reference_size_gold", v)}
                min={0.01}
                max={50}
                step={0.01}
              />
            </SettingRow>

            {/* Default Reference Lot */}
            <SettingRow
              label={
                <div className="flex items-center gap-2">
                  <span>Default Reference Lot</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <Info size={13} className="text-foreground-muted/40 hover:text-foreground-muted/70 transition-colors" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-slate-900 border border-white/[0.1] text-xs leading-relaxed">
                      <p className="mb-1.5"><strong className="text-emerald-400">Minimum floor</strong> for all other pairs at reference balance.</p>
                      <p>Actual lot size can be LARGER if risk-based calculation yields a higher value.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              }
              description={
                <span>
                  Other pairs minimum lot at reference balance{" "}
                  <strong className="text-emerald-400/80">• Floor, not cap</strong>
                </span>
              }
            >
              <NumberInput
                value={settings.lot_reference_size_default}
                onChange={(v) => onSettingChange("lot_reference_size_default", v)}
                min={0.01}
                max={50}
                step={0.01}
              />
            </SettingRow>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Important Notes Card */}
      <Card className={cn(
        "bg-gradient-to-br from-amber-500/[0.04] to-orange-500/[0.03] border border-amber-500/[0.12] rounded-lg overflow-hidden"
      )}>
        <CardContent className="px-8 py-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-400" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Important to Know</span>
          </div>
          <div className="space-y-2.5 text-xs text-foreground-muted/80 leading-relaxed">
            <div className="flex items-start gap-2.5">
              <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
              <p>
                <strong className="text-foreground">Reference lots set minimum sizes:</strong> Your trades will always be at least this size (scaled by balance), but can grow larger based on risk calculations.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
              <p>
                <strong className="text-foreground">Max Risk % and Max Lot Size:</strong> These settings (configured in Risk Management) work together with reference lots to determine final position sizes.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
              <p>
                <strong className="text-foreground">Balance scaling is automatic:</strong> As your balance grows or shrinks, your lot sizes adjust proportionally to the reference balance ratio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

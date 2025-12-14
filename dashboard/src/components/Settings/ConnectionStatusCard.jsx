import { RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ConnectionStatusCard({
  telegramConnected,
  telegramMessage,
  mtConnected,
  mtMessage,
  isRefreshing,
  onRefresh,
}) {
  const allConnected = telegramConnected && mtConnected;
  const someConnected = telegramConnected || mtConnected;

  return (
    <Card className={cn(
      "border rounded-lg overflow-hidden mb-6",
      "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
      "transition-all duration-300",
      allConnected
        ? "bg-emerald-500/[0.04] border-emerald-500/20"
        : someConnected
        ? "bg-amber-500/[0.04] border-amber-500/20"
        : "bg-white/[0.02] border-white/[0.06]"
    )}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {allConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : someConnected ? (
              <AlertCircle className="w-5 h-5 text-amber-500" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Connection Status
              </h3>
              <p className="text-xs text-foreground-muted/70 mt-0.5">
                {allConnected
                  ? "All services connected and running"
                  : someConnected
                  ? "Some services need attention"
                  : "Services disconnected"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-9 px-3 text-foreground-muted hover:text-foreground hover:bg-white/[0.05]"
          >
            <RefreshCw size={14} className={cn("mr-1.5", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Status rows */}
        <div className="mt-4 space-y-2">
          {/* Telegram status */}
          <div className={cn(
            "flex items-center justify-between p-3 rounded-md",
            "bg-white/[0.02] border border-white/[0.04]"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                telegramConnected ? "bg-emerald-500" : "bg-rose-500"
              )} />
              <span className="text-sm font-medium text-foreground">Telegram</span>
            </div>
            <span className={cn(
              "text-xs",
              telegramConnected ? "text-emerald-400" : "text-foreground-muted/70"
            )}>
              {telegramMessage || (telegramConnected ? "Connected" : "Not connected")}
            </span>
          </div>

          {/* MetaTrader status */}
          <div className={cn(
            "flex items-center justify-between p-3 rounded-md",
            "bg-white/[0.02] border border-white/[0.04]"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                mtConnected ? "bg-emerald-500" : "bg-rose-500"
              )} />
              <span className="text-sm font-medium text-foreground">MetaTrader</span>
            </div>
            <span className={cn(
              "text-xs",
              mtConnected ? "text-emerald-400" : "text-foreground-muted/70"
            )}>
              {mtMessage || (mtConnected ? "Connected" : "Not connected")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

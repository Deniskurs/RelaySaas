import { useState, useEffect } from "react";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Terminal,
  Download,
  Activity,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function DiagnosticsPanel() {
  const { fetchData } = useApi();
  const [diagnostics, setDiagnostics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDiagnostics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try to fetch connection diagnostics
      const [telegramStatus, systemStatus] = await Promise.all([
        fetchData("/telegram/connection-status").catch(() => null),
        fetchData("/system/status").catch(() => null),
      ]);

      setDiagnostics({
        telegram: telegramStatus,
        system: systemStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      setError("Failed to fetch diagnostics");
      console.error("Diagnostics error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Connection Diagnostics</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchDiagnostics}
          disabled={isLoading}
          className="h-8 px-3 text-foreground-muted hover:text-foreground"
        >
          <RefreshCw size={14} className={cn("mr-1.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-rose-500/10 border border-rose-500/20">
          <AlertCircle size={14} className="text-rose-400" />
          <span className="text-sm text-rose-400">{error}</span>
        </div>
      )}

      {isLoading && !diagnostics && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
        </div>
      )}

      {diagnostics && (
        <div className="space-y-3">
          {/* Telegram Status */}
          <div className={cn(
            "p-4 rounded-md border",
            diagnostics.telegram?.connected
              ? "bg-emerald-500/[0.04] border-emerald-500/20"
              : "bg-rose-500/[0.04] border-rose-500/20"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {diagnostics.telegram?.connected ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <XCircle size={16} className="text-rose-500" />
                )}
                <span className="text-sm font-medium">Telegram Listener</span>
              </div>
              <Badge variant="outline" className={cn(
                "text-[10px]",
                diagnostics.telegram?.connected ? "text-emerald-400" : "text-rose-400"
              )}>
                {diagnostics.telegram?.connected ? "CONNECTED" : "DISCONNECTED"}
              </Badge>
            </div>
            {diagnostics.telegram && (
              <div className="mt-3 pl-7 space-y-1">
                {diagnostics.telegram.channels_count !== undefined && (
                  <p className="text-xs text-foreground-muted/70">
                    Channels: <span className="text-foreground/80 font-mono">{diagnostics.telegram.channels_count}</span>
                  </p>
                )}
                {diagnostics.telegram.user_id && (
                  <p className="text-xs text-foreground-muted/70">
                    User ID: <span className="text-foreground/80 font-mono">{diagnostics.telegram.user_id}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* System Status */}
          {diagnostics.system && (
            <div className={cn(
              "p-4 rounded-md border",
              "bg-white/[0.02] border-white/[0.06]"
            )}>
              <div className="flex items-center gap-3">
                <Activity size={16} className="text-foreground-muted" />
                <span className="text-sm font-medium">System Status</span>
              </div>
              <div className="mt-3 pl-7 space-y-1">
                {diagnostics.system.uptime && (
                  <p className="text-xs text-foreground-muted/70">
                    Uptime: <span className="text-foreground/80 font-mono">{diagnostics.system.uptime}</span>
                  </p>
                )}
                {diagnostics.system.version && (
                  <p className="text-xs text-foreground-muted/70">
                    Version: <span className="text-foreground/80 font-mono">{diagnostics.system.version}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Last Check */}
          <div className="flex items-center gap-2 text-xs text-foreground-muted/50">
            <Clock size={12} />
            <span>Last checked: {new Date(diagnostics.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DebugLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // In a real implementation, this would fetch from an API endpoint
  // For now, we'll show a placeholder
  useEffect(() => {
    setLogs([
      { time: new Date().toISOString(), level: "info", message: "Settings page loaded" },
      { time: new Date(Date.now() - 60000).toISOString(), level: "info", message: "Connection status checked" },
    ]);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Recent Activity</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLogs([])}
          className="h-8 px-3 text-foreground-muted hover:text-foreground"
        >
          Clear
        </Button>
      </div>

      <div className={cn(
        "rounded-md border overflow-hidden",
        "bg-black/20 border-white/[0.06]"
      )}>
        <div className="p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <p className="text-foreground-muted/50 text-center py-4">No recent activity</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-foreground-muted/40 shrink-0">
                  {new Date(log.time).toLocaleTimeString()}
                </span>
                <span className={cn(
                  "shrink-0",
                  log.level === "error" ? "text-rose-400" :
                  log.level === "warn" ? "text-amber-400" :
                  "text-emerald-400"
                )}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-foreground/70">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdvancedTab({ settings }) {
  const handleExportSettings = () => {
    const exportData = {
      ...settings,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signalcopier-settings-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Connection Diagnostics */}
      <Card className={cn(
        "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
        "shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
      )}>
        <CardHeader className="pb-0 pt-6 px-8">
          <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest flex items-center gap-2">
            <Terminal size={12} />
            Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8">
          <DiagnosticsPanel />
        </CardContent>
      </Card>

      {/* Debug Logs */}
      <Card className={cn(
        "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
        "shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
      )}>
        <CardHeader className="pb-0 pt-6 px-8">
          <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest flex items-center gap-2">
            <Activity size={12} />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8">
          <DebugLogs />
        </CardContent>
      </Card>

      {/* Developer Tools */}
      <Card className={cn(
        "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
        "shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
      )}>
        <CardHeader className="pb-0 pt-6 px-8">
          <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
            Developer Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSettings}
              className="h-9 px-4 rounded-none border-white/[0.08] hover:bg-white/[0.05]"
            >
              <Download size={14} className="mr-2" />
              Export Settings (JSON)
            </Button>
          </div>
          <p className="text-xs text-foreground-muted/50 mt-4">
            Export your settings for backup or to share with support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

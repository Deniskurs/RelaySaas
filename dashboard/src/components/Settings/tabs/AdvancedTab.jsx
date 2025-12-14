import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Terminal,
  Download,
  Upload,
  Activity,
  Clock,
  Wifi,
  WifiOff,
  MessageSquare,
  BarChart3,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function DiagnosticsPanel() {
  const { fetchData } = useApi();
  const { user } = useAuth();
  const [diagnostics, setDiagnostics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDiagnostics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all diagnostic data in parallel
      const [telegramStatus, userSetup, systemStatus] = await Promise.all([
        fetchData("/telegram/connection-status").catch(() => ({ connected: false, error: "Failed to fetch" })),
        fetchData("/user/setup-status").catch(() => null),
        fetchData("/system/status").catch(() => null),
      ]);

      setDiagnostics({
        telegram: telegramStatus,
        userSetup,
        system: systemStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      setError("Failed to fetch diagnostics");
      console.error("Diagnostics error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  if (isLoading && !diagnostics) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Live Connection Status</h4>
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

      {diagnostics && (
        <div className="space-y-3">
          {/* Telegram Live Status */}
          <div className={cn(
            "p-4 rounded-md border",
            diagnostics.telegram?.connected
              ? "bg-emerald-500/[0.04] border-emerald-500/20"
              : "bg-rose-500/[0.04] border-rose-500/20"
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {diagnostics.telegram?.connected ? (
                  <Wifi size={16} className="text-emerald-500" />
                ) : (
                  <WifiOff size={16} className="text-rose-500" />
                )}
                <span className="text-sm font-medium">Telegram Listener</span>
              </div>
              <Badge variant="outline" className={cn(
                "text-[10px]",
                diagnostics.telegram?.connected ? "text-emerald-400 border-emerald-500/30" : "text-rose-400 border-rose-500/30"
              )}>
                {diagnostics.telegram?.connected ? "LIVE" : "OFFLINE"}
              </Badge>
            </div>
            <div className="pl-7 space-y-1.5 text-xs">
              {diagnostics.telegram?.connected && (
                <>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted/70">Channels Monitored</span>
                    <span className="text-foreground/80 font-mono">{diagnostics.telegram.channels_count || 0}</span>
                  </div>
                  {diagnostics.telegram.user_id && (
                    <div className="flex justify-between">
                      <span className="text-foreground-muted/70">Telegram User ID</span>
                      <span className="text-foreground/80 font-mono">{diagnostics.telegram.user_id}</span>
                    </div>
                  )}
                </>
              )}
              {!diagnostics.telegram?.connected && diagnostics.telegram?.message && (
                <p className="text-rose-400/80 italic">{diagnostics.telegram.message}</p>
              )}
            </div>
          </div>

          {/* User Setup Status */}
          {diagnostics.userSetup && (
            <div className={cn(
              "p-4 rounded-md border",
              diagnostics.userSetup.is_setup_complete
                ? "bg-emerald-500/[0.04] border-emerald-500/20"
                : "bg-amber-500/[0.04] border-amber-500/20"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {diagnostics.userSetup.is_setup_complete ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <AlertTriangle size={16} className="text-amber-500" />
                  )}
                  <span className="text-sm font-medium">Setup Status</span>
                </div>
                <Badge variant="outline" className={cn(
                  "text-[10px]",
                  diagnostics.userSetup.is_setup_complete ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"
                )}>
                  {diagnostics.userSetup.is_setup_complete ? "COMPLETE" : "INCOMPLETE"}
                </Badge>
              </div>
              <div className="pl-7 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted/70">Telegram</span>
                  <span className={diagnostics.userSetup.telegram_connected ? "text-emerald-400" : "text-rose-400"}>
                    {diagnostics.userSetup.telegram_connected ? "Connected" : "Not Connected"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted/70">MetaTrader</span>
                  <span className={diagnostics.userSetup.mt_connected ? "text-emerald-400" : "text-rose-400"}>
                    {diagnostics.userSetup.mt_connected ? "Connected" : "Not Connected"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted/70">Signal Channels</span>
                  <span className={diagnostics.userSetup.channels_configured ? "text-emerald-400" : "text-rose-400"}>
                    {diagnostics.userSetup.channels_configured ? "Configured" : "Not Configured"}
                  </span>
                </div>
                {diagnostics.userSetup.missing_steps?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/[0.04]">
                    <p className="text-amber-400/80">
                      Missing: {diagnostics.userSetup.missing_steps.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* System Status */}
          {diagnostics.system && (
            <div className={cn(
              "p-4 rounded-md border",
              diagnostics.system.is_configured
                ? "bg-white/[0.02] border-white/[0.06]"
                : "bg-amber-500/[0.04] border-amber-500/20"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Terminal size={16} className="text-foreground-muted" />
                  <span className="text-sm font-medium">System Configuration</span>
                </div>
                <Badge variant="outline" className={cn(
                  "text-[10px]",
                  diagnostics.system.is_configured ? "text-foreground-muted" : "text-amber-400 border-amber-500/30"
                )}>
                  {diagnostics.system.is_configured ? "OK" : "ISSUES"}
                </Badge>
              </div>
              {diagnostics.system.missing_config?.length > 0 && (
                <div className="pl-7 text-xs">
                  <p className="text-amber-400/80">
                    Missing: {diagnostics.system.missing_config.join(", ")}
                  </p>
                </div>
              )}
              {diagnostics.system.warnings?.length > 0 && (
                <div className="pl-7 text-xs mt-1">
                  <p className="text-amber-400/80">
                    Warnings: {diagnostics.system.warnings.join(", ")}
                  </p>
                </div>
              )}
              {diagnostics.system.is_configured && !diagnostics.system.missing_config?.length && (
                <div className="pl-7 text-xs text-foreground-muted/60">
                  All system services configured correctly
                </div>
              )}
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

function RecentSignals() {
  const { fetchData } = useApi();
  const [signals, setSignals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const result = await fetchData("/signals?limit=5");
        if (result?.signals) {
          setSignals(result.signals);
        }
      } catch (e) {
        console.error("Error fetching signals:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSignals();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-foreground-muted/50">
        No recent signals
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {signals.slice(0, 5).map((signal, i) => (
        <div
          key={signal.id || i}
          className={cn(
            "flex items-center justify-between p-3 rounded-md",
            "bg-white/[0.02] border border-white/[0.04]"
          )}
        >
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] font-mono",
                signal.action === "BUY" ? "text-emerald-400 border-emerald-500/30" : "text-rose-400 border-rose-500/30"
              )}
            >
              {signal.action}
            </Badge>
            <span className="text-xs font-medium text-foreground/80">{signal.symbol}</span>
          </div>
          <span className="text-[10px] text-foreground-muted/50">
            {new Date(signal.created_at).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdvancedTab({ settings, onImportSettings }) {
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleFileImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        // Validate it's a settings object (check for known keys)
        const requiredKeys = ['max_risk_percent', 'max_lot_size'];
        const hasRequiredKeys = requiredKeys.some(key => key in imported);

        if (!hasRequiredKeys) {
          setImportError("Invalid settings file - missing required fields");
          return;
        }

        // Remove metadata fields before importing
        delete imported.exported_at;

        // Call the import handler
        if (onImportSettings) {
          onImportSettings(imported);
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 3000);
        }
      } catch (err) {
        setImportError("Failed to parse settings file - invalid JSON");
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    event.target.value = '';
  };

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

  const handleCopySettings = () => {
    const exportData = {
      ...settings,
      exported_at: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            Connection Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8">
          <DiagnosticsPanel />
        </CardContent>
      </Card>

      {/* Recent Signals */}
      <Card className={cn(
        "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
        "shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
      )}>
        <CardHeader className="pb-0 pt-6 px-8">
          <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare size={12} />
            Recent Signals
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pt-5 pb-8">
          <RecentSignals />
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
          {/* Import/Export Status Messages */}
          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-rose-500/10 border border-rose-500/20 mb-4">
              <AlertCircle size={14} className="text-rose-400" />
              <span className="text-sm text-rose-400">{importError}</span>
            </div>
          )}
          {importSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-sm text-emerald-400">Settings imported successfully! Click "Save Changes" to apply.</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSettings}
              className="h-9 px-4 rounded-none border-white/[0.08] hover:bg-white/[0.05]"
            >
              <Download size={14} className="mr-2" />
              Export Settings
            </Button>

            {/* Import Button with hidden file input */}
            <label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-9 px-4 rounded-none border-white/[0.08] hover:bg-white/[0.05] cursor-pointer"
              >
                <span>
                  <Upload size={14} className="mr-2" />
                  Import Settings
                </span>
              </Button>
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySettings}
              className="h-9 px-4 rounded-none border-white/[0.08] hover:bg-white/[0.05]"
            >
              {copied ? (
                <>
                  <Check size={14} className="mr-2 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} className="mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>

          {/* Current Settings Preview */}
          <div className="mt-6">
            <h4 className="text-xs font-medium text-foreground-muted/70 mb-3">Current Settings (JSON)</h4>
            <div className={cn(
              "p-4 rounded-md overflow-x-auto",
              "bg-black/30 border border-white/[0.04]",
              "font-mono text-[10px] text-foreground-muted/70",
              "max-h-48 overflow-y-auto"
            )}>
              <pre>{JSON.stringify(settings, null, 2)}</pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

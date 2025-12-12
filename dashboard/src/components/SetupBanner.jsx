import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  Shield,
  MessageSquare,
  Bot,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SetupStep = ({ icon: Icon, label, isComplete, isActive }) => (
  <div className="flex items-center gap-3">
    <div
      className={cn(
        "relative w-10 h-10 rounded-none flex items-center justify-center transition-all duration-300",
        isComplete
          ? "bg-success/20 text-success"
          : isActive
          ? "bg-white/10 text-foreground"
          : "bg-surface text-foreground-muted"
      )}
    >
      {isComplete ? (
        <CheckCircle2 size={20} />
      ) : (
        <Icon size={18} />
      )}
      {isActive && !isComplete && (
        <span className="absolute inset-0 rounded-none animate-ping bg-white/10" />
      )}
    </div>
    <span
      className={cn(
        "text-sm font-medium transition-colors",
        isComplete
          ? "text-success"
          : isActive
          ? "text-foreground"
          : "text-foreground-muted"
      )}
    >
      {label}
    </span>
  </div>
);

export default function SetupBanner({ onNavigateToAdmin }) {
  const { fetchData } = useApi();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [status, setStatus] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const data = await fetchData("/system/status");
      if (data) {
        setStatus(data);
      }
    };
    checkStatus();
  }, [fetchData]);

  // Don't show if configured, dismissed, or still loading
  if (!status || status.is_configured || isDismissed) {
    return null;
  }

  // Determine which steps are complete
  const missing = status.missing_config || [];
  const hasAnthropicKey = !missing.includes("Anthropic API Key");
  const hasMetaApi = !missing.includes("MetaApi Token") && !missing.includes("MetaApi Account ID");
  const hasTelegram = !missing.includes("Telegram API ID") &&
                      !missing.includes("Telegram API Hash") &&
                      !missing.includes("Telegram Phone");

  const completedSteps = [hasAnthropicKey, hasMetaApi, hasTelegram].filter(Boolean).length;
  const totalSteps = 3;
  const progressPercent = (completedSteps / totalSteps) * 100;

  // Find first incomplete step
  const activeStep = !hasAnthropicKey ? 0 : !hasMetaApi ? 1 : !hasTelegram ? 2 : 3;

  return (
    <div className="relative overflow-hidden rounded-none mb-6">
      {/* Gradient background with glass effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-white/[0.02]" />
      <div className="absolute inset-0 backdrop-blur-xl bg-surface/40" />

      {/* Animated gradient orbs */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      {/* Content */}
      <div className="relative p-6 md:p-8">
        {/* Close button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-4 right-4 p-2 rounded-none hover:bg-white/5 text-foreground-muted hover:text-foreground transition-all"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-none bg-white/[0.06] border border-white/10">
            <Sparkles className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              Complete Your Setup
            </h2>
            <p className="text-sm text-foreground-muted max-w-md">
              Configure your integrations to start receiving and executing trading signals automatically.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground-muted">
              Setup Progress
            </span>
            <span className="text-xs font-mono text-foreground">
              {completedSteps}/{totalSteps} complete
            </span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-white/60 to-white/40 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Setup steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SetupStep
            icon={Bot}
            label="AI Parser"
            isComplete={hasAnthropicKey}
            isActive={activeStep === 0}
          />
          <SetupStep
            icon={Shield}
            label="MetaTrader"
            isComplete={hasMetaApi}
            isActive={activeStep === 1}
          />
          <SetupStep
            icon={MessageSquare}
            label="Telegram"
            isComplete={hasTelegram}
            isActive={activeStep === 2}
          />
        </div>

        {/* Missing items detail */}
        {missing.length > 0 && (
          <div className="bg-surface/50 rounded-none p-4 mb-6 border border-border/50">
            <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-3">
              Required Configuration
            </p>
            <div className="flex flex-wrap gap-2">
              {missing.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-destructive/10 text-destructive text-xs font-medium"
                >
                  <Circle size={6} className="fill-current" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center gap-4">
          {isAdmin && onNavigateToAdmin ? (
            <>
              <Button
                onClick={onNavigateToAdmin}
                className="font-medium px-6 group"
              >
                <Zap size={16} className="mr-2" />
                Configure Now
                <ArrowRight
                  size={16}
                  className="ml-2 transition-transform group-hover:translate-x-1"
                />
              </Button>
              <span className="text-xs text-foreground-muted">
                Takes about 2 minutes
              </span>
            </>
          ) : (
            <div className="flex items-center gap-3 text-sm text-foreground-muted">
              <div className="p-2 rounded-none bg-surface">
                <Shield size={16} />
              </div>
              <span>
                Contact your administrator to complete the system configuration.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

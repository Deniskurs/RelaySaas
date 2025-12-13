import { useState, useEffect } from "react";
import {
  Save,
  RotateCcw,
  AlertCircle,
  Check,
  Loader2,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  Send,
  Shield,
  RefreshCw,
  Unplug,
  Lock,
  MessageSquare,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useApi } from "@/hooks/useApi";
import { useRefresh } from "@/hooks/useRefresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";

function SettingRow({ label, description, children, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-5 first:pt-0 last:pb-0",
        className
      )}
    >
      <div className="flex flex-col gap-0.5 pr-8 min-w-0">
        <span className="text-[15px] font-medium text-foreground">
          {label}
        </span>
        {description && (
          <span className="text-[12px] text-foreground-muted/70 leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step, suffix, className }) {
  const handleChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) onChange(val);
  };

  return (
    <div className="flex items-center gap-2.5">
      <Input
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        className={cn(
          "w-24 h-10 px-3 text-center font-mono text-[13px]",
          "bg-white/[0.03] border-white/[0.08] rounded-none",
          "hover:border-white/[0.12] hover:bg-white/[0.04]",
          "focus:border-white/[0.20] focus:bg-white/[0.05]",
          "focus:ring-2 focus:ring-white/[0.06] focus:ring-offset-0",
          "focus:shadow-[0_0_0_4px_rgba(255,255,255,0.03)]",
          "transition-all duration-200",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
      />
      {suffix && (
        <span className="text-[13px] text-foreground-muted/60 font-medium min-w-[20px]">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SymbolTags({ symbols, onChange }) {
  const [input, setInput] = useState("");

  const addSymbol = (e) => {
    if (e.key === "Enter" && input) {
      e.preventDefault();
      if (!symbols.includes(input.toUpperCase())) {
        onChange([...symbols, input.toUpperCase()]);
      }
      setInput("");
    }
  };

  const removeSymbol = (symbolToRemove) => {
    onChange(symbols.filter((s) => s !== symbolToRemove));
  };

  return (
    <div className="flex flex-wrap gap-2 items-center justify-end">
      {symbols.map((symbol) => (
        <span
          key={symbol}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium",
            "bg-white/[0.05] text-foreground/80 border border-white/[0.06] rounded-sm",
            "hover:bg-white/[0.08] hover:border-white/[0.10] hover:-translate-y-[1px]",
            "transition-all duration-150"
          )}
        >
          {symbol}
          <button
            onClick={() => removeSymbol(symbol)}
            className="hover:text-foreground transition-colors opacity-60 hover:opacity-100"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addSymbol}
        placeholder="+ Add"
        className={cn(
          "w-16 h-8 px-2 text-xs rounded-sm",
          "bg-transparent border-white/[0.06] border-dashed",
          "hover:border-white/[0.12] hover:bg-white/[0.02]",
          "focus:border-white/20 focus:bg-white/[0.03]",
          "transition-all duration-200 placeholder:text-foreground-muted/40"
        )}
      />
    </div>
  );
}

function ChannelTags({ channels, onChange }) {
  const [input, setInput] = useState("");

  const addChannel = (e) => {
    if (e.key === "Enter" && input) {
      e.preventDefault();
      if (!channels.includes(input)) {
        onChange([...channels, input]);
      }
      setInput("");
    }
  };

  const removeChannel = (channelToRemove) => {
    onChange(channels.filter((c) => c !== channelToRemove));
  };

  return (
    <div className="flex flex-wrap gap-2 items-center justify-end">
      {channels.map((channel) => (
        <span
          key={channel}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono",
            "bg-white/[0.04] text-foreground/70 border border-white/[0.06] rounded-sm",
            "hover:bg-white/[0.07] hover:border-white/[0.10] hover:-translate-y-[1px]",
            "transition-all duration-150"
          )}
        >
          {channel}
          <button
            onClick={() => removeChannel(channel)}
            className="hover:text-foreground transition-colors opacity-60 hover:opacity-100"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addChannel}
        placeholder="+ Add ID"
        className={cn(
          "w-20 h-8 px-2 text-xs font-mono rounded-sm",
          "bg-transparent border-white/[0.06] border-dashed",
          "hover:border-white/[0.12] hover:bg-white/[0.02]",
          "focus:border-white/20 focus:bg-white/[0.03]",
          "transition-all duration-200 placeholder:text-foreground-muted/40"
        )}
      />
    </div>
  );
}

function TPRatioInputs({ ratios, onChange }) {
  const handleChange = (index, value) => {
    const newRatios = [...ratios];
    newRatios[index] = parseFloat(value);
    onChange(newRatios);
  };

  const total = ratios.reduce((a, b) => a + b, 0);
  const isValid = Math.abs(total - 1) < 0.001;

  return (
    <div className="flex items-center gap-2.5">
      {ratios.map((ratio, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[10px] text-foreground-muted/60 font-medium">
            TP{i + 1}
          </span>
          <Input
            type="number"
            value={ratio}
            onChange={(e) => handleChange(i, e.target.value)}
            step={0.1}
            min={0}
            max={1}
            className={cn(
              "w-14 h-9 px-2 text-center font-mono text-xs",
              "bg-white/[0.03] border-white/[0.08] rounded-none",
              "hover:border-white/[0.12] hover:bg-white/[0.04]",
              "focus:border-white/[0.20] focus:bg-white/[0.05] focus:ring-0",
              "transition-all duration-200",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            )}
          />
        </div>
      ))}
      <span
        className={cn(
          "text-xs font-mono px-2.5 py-1.5 rounded-sm",
          isValid
            ? "text-accent-gold bg-accent-gold/10 border border-accent-gold/20"
            : "text-rose-400/80 bg-rose-500/10 border border-rose-500/20"
        )}
      >
        {(total * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, className, disabled }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-10 pr-10 font-mono text-[13px]",
          "bg-white/[0.03] border-white/[0.08] rounded-none",
          "hover:border-white/[0.12] hover:bg-white/[0.04]",
          "focus:border-white/[0.20] focus:bg-white/[0.05]",
          "focus:ring-2 focus:ring-white/[0.06] focus:ring-offset-0",
          "transition-all duration-200",
          className
        )}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted/50 hover:text-foreground-muted transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function MetaTraderSection({
  mtCreds,
  onCredsChange,
  isLoading: credsLoading,
}) {
  const { fetchData, postData } = useApi();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [provisioningStatus, setProvisioningStatus] = useState(null);
  const [provisioningMessage, setProvisioningMessage] = useState("");
  const [accountId, setAccountId] = useState(null);
  const [suggestedServers, setSuggestedServers] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    login: mtCreds.mt_login || "",
    password: "",
    server: mtCreds.mt_server || "",
    platform: mtCreds.mt_platform || "mt5",
    broker_keywords: "",
  });

  // Poll for account deployment status (during active provisioning)
  useEffect(() => {
    if (provisioningStatus === "provisioning" && accountId) {
      const pollInterval = setInterval(async () => {
        try {
          const result = await fetchData(`/onboarding/metatrader/status/${accountId}`);
          if (result) {
            if (result.state === "DEPLOYED" && result.connection_status === "CONNECTED") {
              setProvisioningStatus("deployed");
              setProvisioningMessage("Account connected successfully!");
              clearInterval(pollInterval);
              // Reload credentials after successful connection
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            } else if (result.state === "DEPLOYED") {
              setProvisioningMessage(`Account deployed. Connecting to broker... (${result.connection_status || "waiting"})`);
            } else {
              setProvisioningMessage(`Setting up your account... (${result.state || "initializing"})`);
            }
          }
        } catch (e) {
          console.error("Error polling status:", e);
        }
      }, 3000);

      return () => clearInterval(pollInterval);
    }
  }, [provisioningStatus, accountId, fetchData]);

  // Auto-poll for connection status when page loads with unconnected account
  useEffect(() => {
    // Only poll if: has account_id, not connected, not actively provisioning
    if (mtCreds.metaapi_account_id && !mtCreds.mt_connected && provisioningStatus === "idle") {
      console.log("Auto-polling for MT connection status...", mtCreds.metaapi_account_id);

      const pollInterval = setInterval(async () => {
        try {
          const result = await fetchData(`/onboarding/metatrader/status/${mtCreds.metaapi_account_id}`);
          if (result) {
            if (result.state === "DEPLOYED" && result.connection_status === "CONNECTED") {
              console.log("Account now connected, reloading...");
              clearInterval(pollInterval);
              // Reload to get updated credentials
              window.location.reload();
            } else {
              console.log("Account status:", result.state, result.connection_status);
            }
          }
        } catch (e) {
          console.error("Error polling connection status:", e);
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(pollInterval);
    }
  }, [mtCreds.metaapi_account_id, mtCreds.mt_connected, provisioningStatus, fetchData]);

  const handleConnectAccount = async () => {
    setConnectionError("");
    setSuggestedServers([]);

    // Validation
    if (!formData.login || !formData.password || !formData.server) {
      setConnectionError("Please fill in all required fields (Login, Password, Server)");
      return;
    }

    if (!/^\d+$/.test(formData.login)) {
      setConnectionError("Account number must contain only digits");
      return;
    }

    setIsConnecting(true);
    setProvisioningStatus("provisioning");
    setProvisioningMessage("Creating your trading account connection...");

    try {
      const result = await postData("/onboarding/metatrader", {
        login: formData.login,
        password: formData.password,
        server: formData.server,
        platform: formData.platform,
        broker_keywords: formData.broker_keywords ? formData.broker_keywords.split(",").map(k => k.trim()) : [],
      });

      if (result) {
        if (result.success) {
          setAccountId(result.account_id);

          if (result.provisioning_status === "DEPLOYED") {
            setProvisioningStatus("deployed");
            setProvisioningMessage("Account connected successfully!");
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            setProvisioningMessage(`Account created. Deploying... (${result.provisioning_status || "initializing"})`);
          }
        } else {
          setProvisioningStatus("error");
          setConnectionError(result.message || "Failed to create account");

          if (result.suggested_servers && result.suggested_servers.length > 0) {
            setSuggestedServers(result.suggested_servers);
          }
        }
      } else {
        setProvisioningStatus("error");
        setConnectionError("Failed to connect to the server. Please try again.");
      }
    } catch (e) {
      setProvisioningStatus("error");
      setConnectionError(e.message || "An unexpected error occurred");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRetry = () => {
    setProvisioningStatus(null);
    setProvisioningMessage("");
    setConnectionError("");
    setAccountId(null);
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const inputClass = cn(
    "h-10 font-mono text-[13px]",
    "bg-white/[0.03] border-white/[0.08] rounded-none",
    "hover:border-white/[0.12] hover:bg-white/[0.04]",
    "focus:border-white/[0.20] focus:bg-white/[0.05]",
    "focus:ring-2 focus:ring-white/[0.06] focus:ring-offset-0",
    "transition-all duration-200 placeholder:text-foreground-muted/40"
  );

  if (credsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Connection Status */}
      {mtCreds.mt_connected ? (
        <div className={cn(
          "flex items-center justify-between p-5 rounded-md mb-4",
          "bg-emerald-500/[0.06] border border-emerald-500/20",
          "shadow-[inset_0_1px_0_rgba(16,185,129,0.1)]"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Connected</p>
              <p className="text-xs text-foreground-muted/70 italic mt-0.5">
                Account {mtCreds.mt_login} on {mtCreds.mt_server}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-3 text-foreground-muted hover:text-foreground hover:bg-white/[0.05]"
            >
              {isExpanded ? "Hide" : "Update Account"}
            </Button>
          </div>
        </div>
      ) : mtCreds.metaapi_account_id ? (
        <div className={cn(
          "flex items-center justify-between p-5 rounded-md mb-4",
          "bg-amber-500/[0.06] border border-amber-500/20",
          "shadow-[inset_0_1px_0_rgba(245,158,11,0.1)]"
        )}>
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
            <div>
              <p className="text-sm font-medium text-amber-400">Connecting...</p>
              <p className="text-xs text-foreground-muted/70 italic mt-0.5">
                Account {mtCreds.mt_login} is being set up
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 px-3 text-foreground-muted hover:text-foreground hover:bg-white/[0.05]"
          >
            {isExpanded ? "Hide" : "Update"}
          </Button>
        </div>
      ) : (
        <div className={cn(
          "flex items-center justify-between p-5 rounded-md mb-4",
          "bg-white/[0.02] border border-white/[0.06]"
        )}>
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-foreground-muted/50" />
            <div>
              <p className="text-sm font-medium text-foreground-muted">Not Connected</p>
              <p className="text-xs text-foreground-muted/70 italic mt-0.5">
                Connect your MetaTrader account to start copying trades
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 px-3 text-foreground hover:text-foreground hover:bg-white/[0.05]"
          >
            {isExpanded ? "Hide" : "Connect Account"}
          </Button>
        </div>
      )}

      {/* Editable Form (collapsed by default when connected) */}
      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Security Notice */}
          <div className={cn(
            "p-4 rounded-md",
            "bg-emerald-500/[0.06] border border-emerald-500/20",
            "shadow-[inset_0_1px_0_rgba(16,185,129,0.05)]"
          )}>
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[12px] font-medium text-foreground">
                  Your credentials are secure
                </p>
                <p className="text-[11px] text-foreground-muted/70 leading-relaxed mt-1">
                  Your password is transmitted securely to MetaAPI and is never stored on our servers.
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {connectionError && (
            <div className="flex items-start gap-2 p-4 rounded-md bg-rose-500/10 border border-rose-500/20">
              <AlertCircle size={14} className="mt-0.5 text-rose-400 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <p className="text-sm text-rose-400">{connectionError}</p>
                {suggestedServers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground-muted">Did you mean one of these servers?</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedServers.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            updateFormField("server", s);
                            setConnectionError("");
                            setSuggestedServers([]);
                          }}
                          className="text-xs px-3 py-1.5 bg-white/[0.05] rounded-sm hover:bg-white/[0.08] transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {provisioningStatus === "error" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRetry}
                    className="h-8 px-3"
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Provisioning Status */}
          {(provisioningStatus === "provisioning" || provisioningStatus === "deployed") && (
            <div className={cn(
              "p-5 rounded-md border text-center space-y-3",
              provisioningStatus === "deployed"
                ? "bg-emerald-500/[0.06] border-emerald-500/20"
                : "bg-blue-500/[0.06] border-blue-500/20"
            )}>
              {provisioningStatus === "deployed" ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              ) : (
                <Loader2 className="w-10 h-10 text-blue-400 mx-auto animate-spin" />
              )}
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {provisioningStatus === "deployed" ? "Connected!" : "Setting Up Your Account"}
                </h3>
                <p className="text-sm text-foreground-muted mt-1">
                  {provisioningMessage}
                </p>
              </div>
              {provisioningStatus === "provisioning" && (
                <p className="text-xs text-foreground-muted/70">
                  This usually takes 30-60 seconds. Please wait...
                </p>
              )}
            </div>
          )}

          {/* Form Fields */}
          {!provisioningStatus && (
            <>
              <SettingRow
                label="Platform"
                description="MetaTrader version"
              >
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateFormField("platform", "mt4")}
                    disabled={isConnecting}
                    className={cn(
                      "px-4 py-2 rounded-none text-xs font-medium transition-all duration-200",
                      formData.platform === "mt4"
                        ? "bg-foreground text-background shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
                        : "bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08] hover:text-foreground"
                    )}
                  >
                    MT4
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFormField("platform", "mt5")}
                    disabled={isConnecting}
                    className={cn(
                      "px-4 py-2 rounded-none text-xs font-medium transition-all duration-200",
                      formData.platform === "mt5"
                        ? "bg-foreground text-background shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
                        : "bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08] hover:text-foreground"
                    )}
                  >
                    MT5
                  </button>
                </div>
              </SettingRow>

              <SettingRow
                label="Account Number"
                description="Your trading account login (digits only)"
              >
                <Input
                  type="text"
                  value={formData.login}
                  onChange={(e) => updateFormField("login", e.target.value.replace(/\D/g, ""))}
                  placeholder="12345678"
                  disabled={isConnecting}
                  className={cn(inputClass, "w-32")}
                />
              </SettingRow>

              <SettingRow
                label="Password"
                description="Your MetaTrader account password (never stored)"
              >
                <PasswordInput
                  value={formData.password}
                  onChange={(e) => updateFormField("password", e.target.value)}
                  placeholder="Enter password"
                  disabled={isConnecting}
                  className={cn(inputClass, "w-44")}
                />
              </SettingRow>

              <SettingRow
                label="Server"
                description="Broker server name"
              >
                <Input
                  type="text"
                  value={formData.server}
                  onChange={(e) => updateFormField("server", e.target.value)}
                  placeholder="BrokerName-Live"
                  disabled={isConnecting}
                  className={cn(inputClass, "w-52")}
                />
              </SettingRow>

              <SettingRow
                label="Broker Name (Optional)"
                description="Helps find correct server settings"
              >
                <Input
                  type="text"
                  value={formData.broker_keywords}
                  onChange={(e) => updateFormField("broker_keywords", e.target.value)}
                  placeholder="e.g., IC Markets"
                  disabled={isConnecting}
                  className={cn(inputClass, "w-52")}
                />
              </SettingRow>

              {/* Connect Button */}
              <div className="pt-2 border-t border-white/[0.04]">
                <Button
                  onClick={handleConnectAccount}
                  disabled={isConnecting || !formData.login || !formData.password || !formData.server}
                  className={cn(
                    "w-full h-11 rounded-none font-medium",
                    "bg-foreground text-background",
                    "hover:shadow-[0_4px_20px_rgba(255,255,255,0.2)]",
                    "active:scale-[0.99]",
                    "disabled:opacity-40 disabled:bg-white/[0.08] disabled:text-foreground-muted disabled:shadow-none",
                    "transition-all duration-200"
                  )}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 size={14} className="mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <BarChart3 size={14} className="mr-2" />
                      {mtCreds.mt_connected ? "Reconnect Account" : "Connect Account"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Read-only info when collapsed and connected */}
      {!isExpanded && mtCreds.mt_connected && (
        <div className="space-y-2 pt-2">
          <SettingRow
            label="Platform"
            description="MetaTrader version"
          >
            <Badge variant="outline" className="px-3 py-1 text-xs font-medium uppercase">
              {mtCreds.mt_platform === "mt4" ? "MT4" : "MT5"}
            </Badge>
          </SettingRow>

          <SettingRow
            label="Account Number"
            description="Your trading account login"
          >
            <span className="text-sm font-mono text-foreground/80">
              {mtCreds.mt_login || "—"}
            </span>
          </SettingRow>

          <SettingRow
            label="Server"
            description="Broker server name"
          >
            <span className="text-sm font-mono text-foreground/80">
              {mtCreds.mt_server || "—"}
            </span>
          </SettingRow>
        </div>
      )}
    </div>
  );
}

function TelegramSection({
  telegramCreds,
  onCredsChange,
  channels,
  onChannelsChange,
  isLoading: credsLoading,
  configStatus = {} // { telegram_api_hash_set, telegram_api_hash_preview }
}) {
  const { fetchData, postData } = useApi();
  const [connectionStatus, setConnectionStatus] = useState("loading");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  // Verification state
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Check if user has connected Telegram (from credentials)
    if (telegramCreds.telegram_connected) {
      // Already connected from onboarding
      setConnectionStatus("connected");
    } else if (telegramCreds.telegram_api_id && telegramCreds.telegram_api_hash && telegramCreds.telegram_phone) {
      // Has credentials but not connected - check via connection status endpoint
      checkConnectionStatus();
    } else {
      setConnectionStatus("not_configured");
    }
  }, [telegramCreds]);

  const checkConnectionStatus = async () => {
    // For multi-tenant, check the general connection status
    const result = await fetchData("/telegram/connection-status");
    if (result && result.connected) {
      setConnectionStatus("connected");
      setConnectionMessage("Telegram is connected and receiving signals.");
    } else {
      setConnectionStatus("not_configured");
      setConnectionMessage("Telegram is not connected. Click below to connect.");
    }
  };

  const handleSendCode = async () => {
    if (!telegramCreds.telegram_api_id || !telegramCreds.telegram_api_hash || !telegramCreds.telegram_phone) {
      setConnectionError("Please fill in all credentials first (API ID, API Hash, Phone)");
      return;
    }
    setIsConnecting(true);
    setConnectionError("");

    const result = await postData("/onboarding/telegram/send-code", {
      api_id: telegramCreds.telegram_api_id,
      api_hash: telegramCreds.telegram_api_hash,
      phone: telegramCreds.telegram_phone,
    });

    if (result) {
      if (result.status === "code_sent") {
        setConnectionStatus("pending_code");
        setConnectionMessage(result.message);
      } else if (result.status === "error") {
        setConnectionError(result.message || "Failed to send verification code.");
      }
    } else {
      setConnectionError("Failed to send verification code. Please check your credentials.");
    }
    setIsConnecting(false);
  };

  const handleVerifyCode = async () => {
    if (!code) {
      setConnectionError("Please enter the verification code");
      return;
    }
    setIsConnecting(true);
    setConnectionError("");

    const result = await postData("/onboarding/telegram/verify-code", { code });

    if (result) {
      if (result.status === "connected") {
        setConnectionStatus("connected");
        setConnectionMessage(result.message);
      } else if (result.status === "pending_password") {
        setConnectionStatus("pending_password");
        setConnectionMessage(result.message);
      } else if (result.status === "error") {
        setConnectionError(result.message || "Invalid code. Please try again.");
      }
    } else {
      setConnectionError("Invalid code. Please try again.");
    }
    setIsConnecting(false);
  };

  const handleVerifyPassword = async () => {
    if (!password) {
      setConnectionError("Please enter your 2FA password");
      return;
    }
    setIsConnecting(true);
    setConnectionError("");

    const result = await postData("/onboarding/telegram/verify-password", { password });

    if (result) {
      if (result.status === "connected") {
        setConnectionStatus("connected");
        setConnectionMessage(result.message);
      } else if (result.status === "error") {
        setConnectionError(result.message || "Invalid password. Please try again.");
      }
    } else {
      setConnectionError("Invalid password. Please try again.");
    }
    setIsConnecting(false);
  };

  const handleDisconnect = async () => {
    // For now, just reset the UI state - actual disconnect would clear session
    setConnectionStatus("not_configured");
    setConnectionMessage("Telegram disconnected.");
    setCode("");
    setPassword("");
  };

  const handleReconnect = async () => {
    // Reconnect using existing session (don't send new code!)
    setIsConnecting(true);
    setConnectionError("");
    try {
      const result = await postData("/admin/telegram/reconnect");
      if (result && result.status === "connected") {
        setConnectionStatus("connected");
        setConnectionMessage("Telegram reconnected successfully.");
      } else {
        // If reconnect fails, check status
        await checkConnectionStatus();
      }
    } catch (e) {
      console.error("Reconnect error:", e);
      // On error, just refresh the status
      await checkConnectionStatus();
    } finally {
      setIsConnecting(false);
    }
  };

  const inputClass = cn(
    "h-10 font-mono text-[13px]",
    "bg-white/[0.03] border-white/[0.08] rounded-none",
    "hover:border-white/[0.12] hover:bg-white/[0.04]",
    "focus:border-white/[0.20] focus:bg-white/[0.05]",
    "focus:ring-2 focus:ring-white/[0.06] focus:ring-offset-0",
    "transition-all duration-200 placeholder:text-foreground-muted/40"
  );

  if (credsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Instructions */}
      <div className={cn(
        "mb-5 p-4 rounded-md",
        "bg-white/[0.025] border border-white/[0.06]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
      )}>
        <p className="text-[12px] text-foreground-muted/70 leading-relaxed">
          Get your API credentials from{" "}
          <a
            href="https://my.telegram.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
          >
            my.telegram.org
            <ExternalLink size={10} />
          </a>
        </p>
      </div>

      {/* Credentials Section */}
      <SettingRow
        label="API ID"
        description="Your Telegram application ID"
      >
        <Input
          type="text"
          value={telegramCreds.telegram_api_id}
          onChange={(e) => onCredsChange("telegram_api_id", e.target.value)}
          placeholder="12345678"
          className={cn(inputClass, "w-32")}
        />
      </SettingRow>

      <SettingRow
        label="API Hash"
        description="Your Telegram application hash"
      >
        <div className="flex items-center gap-2">
          <PasswordInput
            value={telegramCreds.telegram_api_hash}
            onChange={(e) => onCredsChange("telegram_api_hash", e.target.value)}
            placeholder={configStatus.telegram_api_hash_set ? "••••••••" : "Enter hash"}
            className={cn(inputClass, "w-44")}
          />
          {configStatus.telegram_api_hash_set && !telegramCreds.telegram_api_hash && (
            <span className="text-[10px] text-accent-gold bg-accent-gold/10 px-2 py-1 rounded-sm font-medium border border-accent-gold/20">
              Set
            </span>
          )}
        </div>
      </SettingRow>

      <SettingRow
        label="Phone Number"
        description="With country code"
      >
        <Input
          type="tel"
          value={telegramCreds.telegram_phone}
          onChange={(e) => onCredsChange("telegram_phone", e.target.value)}
          placeholder="+1234567890"
          className={cn(inputClass, "w-36")}
        />
      </SettingRow>

      {/* Connection Status & Actions */}
      <div className="pt-2 border-t border-white/[0.04]">
        {connectionError && (
          <div className="flex items-center gap-2 text-rose-400 text-sm mb-4">
            <AlertCircle size={14} />
            <span className="italic">{connectionError}</span>
          </div>
        )}

        {connectionStatus === "loading" && (
          <div className="flex items-center gap-2 text-foreground-muted text-sm">
            <Loader2 size={14} className="animate-spin" />
            <span className="italic">Checking connection status...</span>
          </div>
        )}

        {connectionStatus === "connected" && (
          <div className={cn(
            "flex items-center justify-between p-5 rounded-md",
            "bg-emerald-500/[0.06] border border-emerald-500/20",
            "shadow-[inset_0_1px_0_rgba(16,185,129,0.1)]"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Connected</p>
                <p className="text-xs text-foreground-muted/70 italic mt-0.5">{connectionMessage}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReconnect}
                disabled={isConnecting}
                className="h-8 px-3 text-foreground-muted hover:text-foreground hover:bg-white/[0.05]"
              >
                {isConnecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={isConnecting}
                className="h-8 px-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                <Unplug size={14} />
              </Button>
            </div>
          </div>
        )}

        {connectionStatus === "pending_password" && (
          <div className="space-y-4">
            <div className={cn(
              "flex items-center gap-3 p-5 rounded-md",
              "bg-amber-500/[0.06] border border-amber-500/20",
              "shadow-[inset_0_1px_0_rgba(245,158,11,0.1)]"
            )}>
              <Lock size={18} className="text-amber-400" />
              <div>
                <p className="text-sm font-medium text-foreground">2FA Required</p>
                <p className="text-xs text-foreground-muted/70 italic mt-0.5">{connectionMessage}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[15px] font-medium text-foreground">Telegram Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your 2FA password"
                className={inputClass}
              />
            </div>
            <Button
              onClick={handleVerifyPassword}
              disabled={isConnecting}
              className={cn(
                "w-full h-11 rounded-none font-medium",
                "bg-foreground text-background",
                "hover:shadow-[0_4px_20px_rgba(255,255,255,0.2)]",
                "active:scale-[0.99]",
                "disabled:opacity-40 disabled:bg-white/[0.08] disabled:shadow-none",
                "transition-all duration-200"
              )}
            >
              {isConnecting ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Shield size={14} className="mr-2" />
              )}
              Verify Password
            </Button>
          </div>
        )}

        {connectionStatus === "pending_code" && (
          <div className="space-y-4">
            <div className={cn(
              "flex items-center gap-3 p-5 rounded-md",
              "bg-blue-500/[0.06] border border-blue-500/20",
              "shadow-[inset_0_1px_0_rgba(59,130,246,0.1)]"
            )}>
              <MessageSquare size={18} className="text-blue-400" />
              <div>
                <p className="text-sm font-medium text-foreground">Enter Verification Code</p>
                <p className="text-xs text-foreground-muted/70 italic mt-0.5">{connectionMessage}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[15px] font-medium text-foreground">Verification Code</label>
              <Input
                placeholder="Enter code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={cn(
                  "h-12 text-center text-xl tracking-[0.4em] font-mono rounded-md",
                  "bg-white/[0.03] border-white/[0.08]",
                  "focus:border-blue-400/40 focus:ring-2 focus:ring-blue-400/10",
                  "transition-all duration-200"
                )}
                maxLength={6}
              />
            </div>
            <Button
              onClick={handleVerifyCode}
              disabled={isConnecting}
              className={cn(
                "w-full h-11 rounded-none font-medium",
                "bg-foreground text-background",
                "hover:shadow-[0_4px_20px_rgba(255,255,255,0.2)]",
                "active:scale-[0.99]",
                "disabled:opacity-40 disabled:bg-white/[0.08] disabled:shadow-none",
                "transition-all duration-200"
              )}
            >
              {isConnecting ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Check size={14} className="mr-2" />
              )}
              Verify Code
            </Button>
          </div>
        )}

        {(connectionStatus === "not_configured" || connectionStatus === "disconnected") && (
          <Button
            onClick={handleSendCode}
            disabled={isConnecting || !telegramCreds.telegram_api_id || !telegramCreds.telegram_api_hash || !telegramCreds.telegram_phone}
            className={cn(
              "w-full h-11 rounded-none font-medium",
              "bg-foreground text-background",
              "hover:shadow-[0_4px_20px_rgba(255,255,255,0.2)]",
              "active:scale-[0.99]",
              "disabled:opacity-40 disabled:bg-white/[0.08] disabled:text-foreground-muted disabled:shadow-none",
              "transition-all duration-200"
            )}
          >
            {isConnecting ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <Send size={14} className="mr-2" />
            )}
            Connect Telegram
          </Button>
        )}
      </div>

      {/* Signal Channels */}
      <div className="pt-4 border-t border-white/[0.04]">
        <SettingRow
          label="Signal Channels"
          description="Channel IDs to monitor for trading signals"
          className="pt-0"
        >
          <ChannelTags
            channels={channels || []}
            onChange={onChannelsChange}
          />
        </SettingRow>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const {
    settings,
    isLoading,
    isSaving,
    error,
    updateSettings,
  } = useSettings();
  const { currencyData } = useCurrency();
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Refresh hook for account data
  const { isRefreshing: isRefreshingAccount, refresh: refreshAccount } = useRefresh({
    loadingMessage: "Refreshing account data...",
    successMessage: "Account data refreshed",
    errorMessage: "Failed to refresh account data",
  });

  // Telegram credentials state
  const [telegramCreds, setTelegramCreds] = useState({
    telegram_api_id: "",
    telegram_api_hash: "",
    telegram_phone: "",
    telegram_connected: false,
  });
  const [telegramCredsOriginal, setTelegramCredsOriginal] = useState(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramError, setTelegramError] = useState("");
  const [hasTelegramChanges, setHasTelegramChanges] = useState(false);
  const [configStatus, setConfigStatus] = useState({});

  // MetaTrader credentials state
  const [mtCreds, setMtCreds] = useState({
    mt_login: "",
    mt_server: "",
    mt_platform: "mt5",
    metaapi_account_id: "",
    mt_connected: false,
  });

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  // Load user credentials from the user credentials endpoint
  const { fetchData, postData } = useApi();

  const loadUserCredentials = async () => {
    setTelegramLoading(true);
    try {
      // Fetch from user credentials endpoint - this is where onboarding saved credentials
      const userCreds = await fetchData("/user/credentials");

      if (userCreds) {
        // Track which sensitive fields are already set (for showing "Set" badges)
        setConfigStatus({
          telegram_api_hash_set: userCreds.telegram_api_hash_set || false,
          telegram_api_hash_preview: "",
          metaapi_token_set: false,
        });

        // Load Telegram credentials from user's onboarding data
        const telegramCredsData = {
          telegram_api_id: userCreds.telegram_api_id || "",
          telegram_api_hash: userCreds.telegram_api_hash || "",
          telegram_phone: userCreds.telegram_phone || "",
          telegram_connected: userCreds.telegram_connected || false,
        };
        setTelegramCreds(telegramCredsData);
        setTelegramCredsOriginal(telegramCredsData);

        // Load MetaTrader credentials from user's onboarding data
        setMtCreds({
          mt_login: userCreds.mt_login || "",
          mt_server: userCreds.mt_server || "",
          mt_platform: userCreds.mt_platform || "mt5",
          metaapi_account_id: userCreds.metaapi_account_id || "",
          mt_connected: userCreds.mt_connected || false,
        });
      }
      return userCreds;
    } catch (e) {
      console.error("Error loading user credentials:", e);
      throw e;
    } finally {
      setTelegramLoading(false);
    }
  };

  useEffect(() => {
    loadUserCredentials();
  }, [fetchData]);

  // Handle account data refresh
  const handleRefreshAccountData = async () => {
    await refreshAccount(loadUserCredentials);
  };

  const updateLocal = (key, value) => {
    console.log("[SettingsPage] updateLocal:", key, "=", value);
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const updateTelegramCred = (key, value) => {
    setTelegramCreds((prev) => ({ ...prev, [key]: value }));
    setHasTelegramChanges(true);
    setSaveSuccess(false);
    setTelegramError("");
  };

  const handleSave = async () => {
    console.log("[SettingsPage] handleSave called");
    console.log("[SettingsPage] localSettings:", localSettings);
    console.log("[SettingsPage] telegram_channel_ids:", localSettings.telegram_channel_ids);
    const success = await updateSettings(localSettings);
    if (success) {
      setHasChanges(false);
    }
    return success;
  };

  const handleSaveTelegram = async () => {
    // Validation
    if (telegramCreds.telegram_api_id && !/^\d+$/.test(telegramCreds.telegram_api_id)) {
      setTelegramError("API ID must be a number");
      return false;
    }

    if (telegramCreds.telegram_phone && !/^\+?\d{10,15}$/.test(telegramCreds.telegram_phone.replace(/\s/g, ""))) {
      setTelegramError("Please enter a valid phone number with country code");
      return false;
    }

    setTelegramSaving(true);
    setTelegramError("");

    try {
      // Save to user credentials via onboarding endpoint
      const result = await postData("/onboarding/telegram", {
        api_id: telegramCreds.telegram_api_id,
        api_hash: telegramCreds.telegram_api_hash,
        phone: telegramCreds.telegram_phone,
      });

      if (!result || !result.success) {
        setTelegramError(result?.message || "Failed to save Telegram credentials");
        return false;
      }

      setTelegramCredsOriginal({ ...telegramCreds });
      setHasTelegramChanges(false);
      return true;
    } catch (e) {
      setTelegramError("An unexpected error occurred");
      return false;
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
  };

  const handleResetTelegram = () => {
    if (telegramCredsOriginal) {
      setTelegramCreds({ ...telegramCredsOriginal });
    }
    setHasTelegramChanges(false);
    setTelegramError("");
  };

  const anyChanges = hasChanges || hasTelegramChanges;
  const anySaving = isSaving || telegramSaving;

  const handleSaveAll = async () => {
    let allSuccess = true;

    if (hasChanges) {
      const success = await handleSave();
      if (!success) allSuccess = false;
    }
    if (hasTelegramChanges) {
      const success = await handleSaveTelegram();
      if (!success) allSuccess = false;
    }

    if (allSuccess) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleResetAll = () => {
    handleReset();
    handleResetTelegram();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="pb-16">
        {/* Header */}
        <div className="flex items-center justify-between py-10 mb-4">
          <div>
            <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.02em]">
              Settings
            </h1>
            <p className="text-sm text-foreground-muted/80 italic mt-1">
              Configure your trading parameters and integrations
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {(error || telegramError) && (
              <span className="text-sm text-rose-400 flex items-center gap-1.5 bg-rose-500/10 px-3 py-1.5 rounded-none">
                <AlertCircle size={14} />
                <span className="italic">{error || telegramError}</span>
              </span>
            )}
            {saveSuccess && (
              <span className={cn(
                "text-sm text-emerald-400 flex items-center gap-1.5",
                "bg-emerald-500/10 px-3 py-2 rounded-sm",
                "border-l-2 border-accent-gold",
                "animate-in fade-in slide-in-from-right-2"
              )}>
                <Check size={14} />
                <span className="italic">Saved</span>
              </span>
            )}
            {/* Refresh Account Data Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshAccountData}
              disabled={isRefreshingAccount}
              className="text-foreground-muted hover:text-foreground hover:bg-white/[0.05] h-9 px-3"
              title="Refresh account data from server"
            >
              <RefreshCw size={14} className={cn("mr-1.5", isRefreshingAccount && "animate-spin")} />
              {isRefreshingAccount ? "Refreshing..." : "Refresh"}
            </Button>
            {anyChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAll}
                className="text-foreground-muted hover:text-foreground hover:bg-white/[0.05] h-9 px-3"
              >
                <RotateCcw size={14} className="mr-1.5" />
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={!anyChanges || anySaving}
              className={cn(
                "h-10 px-5 rounded-none font-medium",
                "bg-foreground text-background",
                "hover:shadow-[0_4px_12px_rgba(255,255,255,0.15)]",
                "active:scale-[0.98]",
                "disabled:opacity-40 disabled:bg-white/[0.08] disabled:text-foreground-muted disabled:shadow-none",
                "transition-all duration-200"
              )}
            >
              {anySaving ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Save size={14} className="mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Telegram Section */}
          <Card className={cn(
            "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
            "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
            "hover:border-white/[0.08] hover:bg-white/[0.025]",
            "transition-all duration-300"
          )}>
            <CardHeader className="pb-0 pt-6 px-8">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
                Telegram
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pt-5 pb-8">
              <TelegramSection
                telegramCreds={telegramCreds}
                onCredsChange={updateTelegramCred}
                channels={localSettings.telegram_channel_ids || []}
                onChannelsChange={(v) => updateLocal("telegram_channel_ids", v)}
                isLoading={telegramLoading}
                configStatus={configStatus}
              />
            </CardContent>
          </Card>

          {/* MetaTrader Section */}
          <Card className={cn(
            "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
            "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
            "hover:border-white/[0.08] hover:bg-white/[0.025]",
            "transition-all duration-300"
          )}>
            <CardHeader className="pb-0 pt-6 px-8">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
                MetaTrader
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pt-5 pb-8">
              <MetaTraderSection
                mtCreds={mtCreds}
                onCredsChange={() => {}}
                isLoading={telegramLoading}
              />
            </CardContent>
          </Card>

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
                description="Upper limit for any single position size"
              >
                <NumberInput
                  value={localSettings.max_lot_size}
                  onChange={(v) => updateLocal("max_lot_size", v)}
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
          <Card className={cn(
            "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
            "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
            "hover:border-white/[0.08] hover:bg-white/[0.025]",
            "transition-all duration-300"
          )}>
            <CardHeader className="pb-0 pt-6 px-8">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
                Lot Sizing
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pt-5 pb-8 space-y-2">
              <SettingRow
                label="Reference Balance"
                description="Account balance baseline for scaling lot sizes"
              >
                <NumberInput
                  value={localSettings.lot_reference_balance}
                  onChange={(v) => updateLocal("lot_reference_balance", v)}
                  min={100}
                  max={1000000}
                  step={100}
                  suffix={currencyData.symbol}
                />
              </SettingRow>
              <SettingRow
                label="GOLD Reference Lot"
                description="Base lot size for XAUUSD at reference balance"
              >
                <NumberInput
                  value={localSettings.lot_reference_size_gold}
                  onChange={(v) => updateLocal("lot_reference_size_gold", v)}
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
                  value={localSettings.lot_reference_size_default}
                  onChange={(v) => updateLocal("lot_reference_size_default", v)}
                  min={0.01}
                  max={50}
                  step={0.01}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Trade Execution */}
          <Card className={cn(
            "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
            "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
            "hover:border-white/[0.08] hover:bg-white/[0.025]",
            "transition-all duration-300"
          )}>
            <CardHeader className="pb-0 pt-6 px-8">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
                Trade Execution
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pt-5 pb-8 space-y-2">
              <SettingRow
                label="Auto-Accept Symbols"
                description="These symbols bypass confirmation and execute instantly"
              >
                <SymbolTags
                  symbols={localSettings.auto_accept_symbols || []}
                  onChange={(v) => updateLocal("auto_accept_symbols", v)}
                />
              </SettingRow>
              <SettingRow
                label="GOLD Market Threshold"
                description="Max price deviation for pending-to-market conversion"
              >
                <NumberInput
                  value={localSettings.gold_market_threshold}
                  onChange={(v) => updateLocal("gold_market_threshold", v)}
                  min={0}
                  max={100}
                  step={0.5}
                  suffix={currencyData.symbol}
                />
              </SettingRow>
              <SettingRow
                label="Split Take Profits"
                description="Split position size across multiple TP targets"
              >
                <Switch
                  checked={localSettings.split_tps}
                  onCheckedChange={(v) => updateLocal("split_tps", v)}
                  className="data-[state=checked]:bg-foreground"
                />
              </SettingRow>

              {localSettings.split_tps && (
                <div className="bg-white/[0.02] rounded-none p-4 mt-3 border border-white/[0.04] animate-in slide-in-from-top-1 duration-200 space-y-4">
                  <SettingRow
                    label="Lot Size Mode"
                    description="How lot size is handled for multiple TPs"
                    className="py-0"
                  >
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateLocal("tp_lot_mode", "split")}
                        className={cn(
                          "px-4 py-2 rounded-none text-xs font-medium transition-all duration-200",
                          localSettings.tp_lot_mode === "split" || !localSettings.tp_lot_mode
                            ? "bg-foreground text-background shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
                            : "bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08] hover:text-foreground"
                        )}
                      >
                        Split
                      </button>
                      <button
                        onClick={() => updateLocal("tp_lot_mode", "equal")}
                        className={cn(
                          "px-4 py-2 rounded-none text-xs font-medium transition-all duration-200",
                          localSettings.tp_lot_mode === "equal"
                            ? "bg-foreground text-background shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
                            : "bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08] hover:text-foreground"
                        )}
                      >
                        Equal
                      </button>
                    </div>
                  </SettingRow>
                  <p className="text-[10px] text-foreground-muted/60 -mt-2 ml-1">
                    {localSettings.tp_lot_mode === "equal"
                      ? "Each TP gets the FULL calculated lot size (e.g., 0.04 × 3 = 0.12 total)"
                      : "Total lot is SPLIT across TPs using ratios below (e.g., 0.04 total)"}
                  </p>

                  {(localSettings.tp_lot_mode === "split" || !localSettings.tp_lot_mode) && (
                    <SettingRow
                      label="TP Split Ratios"
                      description="Distribution of volume across TPs (must sum to 100%)"
                      className="py-0"
                    >
                      <TPRatioInputs
                        ratios={localSettings.tp_split_ratios || [0.5, 0.3, 0.2]}
                        onChange={(v) => updateLocal("tp_split_ratios", v)}
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
                  checked={localSettings.enable_breakeven}
                  onCheckedChange={(v) => updateLocal("enable_breakeven", v)}
                  className="data-[state=checked]:bg-foreground"
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Broker */}
          <Card className={cn(
            "bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden",
            "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
            "hover:border-white/[0.08] hover:bg-white/[0.025]",
            "transition-all duration-300"
          )}>
            <CardHeader className="pb-0 pt-6 px-8">
              <CardTitle className="text-[11px] font-semibold text-foreground-muted/70 uppercase tracking-widest">
                Broker
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pt-5 pb-8">
              <SettingRow
                label="Symbol Suffix"
                description="Broker-specific suffix (e.g., .raw, .pro)"
              >
                <Input
                  value={localSettings.symbol_suffix || ""}
                  onChange={(e) => updateLocal("symbol_suffix", e.target.value)}
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

          {/* System */}
          <Card className={cn(
            "bg-amber-500/[0.03] border border-amber-500/[0.12] rounded-lg overflow-hidden",
            "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
            "hover:border-amber-500/[0.16]",
            "transition-all duration-300"
          )}>
            <CardContent className="px-8 py-6">
              <SettingRow
                label="Global Trading Pause"
                description="Stop all new signal processing and trade execution"
                className="py-0"
              >
                <Switch
                  checked={localSettings.paused}
                  onCheckedChange={(v) => updateLocal("paused", v)}
                  className="data-[state=checked]:bg-amber-500"
                />
              </SettingRow>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}

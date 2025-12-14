import { useState, useEffect } from "react";
import {
  Loader2,
  AlertCircle,
  Check,
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ConnectionStatusCard from "../ConnectionStatusCard";
import { SettingRow, PasswordInput, ChannelTags, inputClass } from "../SettingsComponents";

function MetaTraderSection({
  mtCreds,
  onCredsChange,
  isLoading: credsLoading,
  defaultExpanded = false,
}) {
  const { fetchData, postData } = useApi();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [provisioningStatus, setProvisioningStatus] = useState("idle");
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
    if (mtCreds.metaapi_account_id && !mtCreds.mt_connected && provisioningStatus === "idle") {
      console.log("Auto-polling for MT connection status...", mtCreds.metaapi_account_id);

      const pollInterval = setInterval(async () => {
        try {
          const result = await fetchData(`/onboarding/metatrader/status/${mtCreds.metaapi_account_id}`);
          if (result) {
            if (result.state === "DEPLOYED" && result.connection_status === "CONNECTED") {
              console.log("Account now connected, reloading...");
              clearInterval(pollInterval);
              window.location.reload();
            } else {
              console.log("Account status:", result.state, result.connection_status);
            }
          }
        } catch (e) {
          console.error("Error polling connection status:", e);
        }
      }, 5000);

      return () => clearInterval(pollInterval);
    }
  }, [mtCreds.metaapi_account_id, mtCreds.mt_connected, provisioningStatus, fetchData]);

  const handleConnectAccount = async () => {
    setConnectionError("");
    setSuggestedServers([]);

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

  if (credsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  // Collapsed view for connected state
  const CollapsedView = () => (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-md cursor-pointer",
      "hover:bg-white/[0.02] transition-colors",
      mtCreds.mt_connected
        ? "bg-emerald-500/[0.04] border border-emerald-500/15"
        : mtCreds.metaapi_account_id
        ? "bg-amber-500/[0.04] border border-amber-500/15"
        : "bg-white/[0.02] border border-white/[0.06]"
    )}
    onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-2 h-2 rounded-full",
          mtCreds.mt_connected ? "bg-emerald-500" : mtCreds.metaapi_account_id ? "bg-amber-500 animate-pulse" : "bg-white/30"
        )} />
        <div>
          <p className={cn(
            "text-sm font-medium",
            mtCreds.mt_connected ? "text-emerald-400" : "text-foreground"
          )}>
            {mtCreds.mt_connected ? "Connected" : mtCreds.metaapi_account_id ? "Connecting..." : "Not Connected"}
          </p>
          {mtCreds.mt_connected ? (
            <p className="text-xs text-foreground-muted/70 mt-0.5">
              <span className="font-mono">{mtCreds.mt_login}</span> on {mtCreds.mt_server}
            </p>
          ) : (
            <p className="text-xs text-foreground-muted/70 mt-0.5">
              Connect your MetaTrader account to start copying trades
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {mtCreds.mt_connected && (
          <Badge variant="outline" className="text-[10px] uppercase">
            {mtCreds.mt_platform}
          </Badge>
        )}
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <CollapsedView />

      {/* Expanded Form */}
      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200 pt-2">
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
              <SettingRow label="Platform" description="MetaTrader version">
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

              <SettingRow label="Account Number" description="Your trading account login (digits only)">
                <Input
                  type="text"
                  value={formData.login}
                  onChange={(e) => updateFormField("login", e.target.value.replace(/\D/g, ""))}
                  placeholder="12345678"
                  disabled={isConnecting}
                  className={cn(inputClass, "w-32")}
                />
              </SettingRow>

              <SettingRow label="Password" description="Your MetaTrader account password (never stored)">
                <PasswordInput
                  value={formData.password}
                  onChange={(e) => updateFormField("password", e.target.value)}
                  placeholder="Enter password"
                  disabled={isConnecting}
                  className={cn(inputClass, "w-44")}
                />
              </SettingRow>

              <SettingRow label="Server" description="Broker server name">
                <Input
                  type="text"
                  value={formData.server}
                  onChange={(e) => updateFormField("server", e.target.value)}
                  placeholder="BrokerName-Live"
                  disabled={isConnecting}
                  className={cn(inputClass, "w-52")}
                />
              </SettingRow>

              <SettingRow label="Broker Name (Optional)" description="Helps find correct server settings">
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
    </div>
  );
}

function TelegramSection({
  telegramCreds,
  onCredsChange,
  channels,
  onChannelsChange,
  isLoading: credsLoading,
  configStatus = {},
  defaultExpanded = false,
}) {
  const { fetchData, postData } = useApi();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [connectionStatus, setConnectionStatus] = useState("loading");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [channelCount, setChannelCount] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  // Verification state
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (telegramCreds.telegram_api_id && telegramCreds.telegram_api_hash && telegramCreds.telegram_phone) {
      checkConnectionStatus();
    } else {
      setConnectionStatus("not_configured");
    }
  }, [telegramCreds]);

  const checkConnectionStatus = async () => {
    setConnectionStatus("loading");
    try {
      const result = await fetchData("/telegram/connection-status");
      if (result && result.connected) {
        setConnectionStatus("connected");
        setChannelCount(result.channels_count || 0);
        setConnectionMessage(result.channels_count
          ? `Listening to ${result.channels_count} channel(s)`
          : "Telegram is connected and receiving signals.");
      } else {
        setConnectionStatus("disconnected");
        setConnectionMessage(result?.message || "Telegram listener is not running. Click Reconnect to start.");
      }
    } catch (e) {
      console.error("Error checking connection status:", e);
      setConnectionStatus("disconnected");
      setConnectionMessage("Could not check connection status.");
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
    setConnectionStatus("not_configured");
    setConnectionMessage("Telegram disconnected.");
    setCode("");
    setPassword("");
  };

  const handleReconnect = async () => {
    setIsConnecting(true);
    setConnectionError("");
    try {
      try {
        await postData("/system/connect-me");
      } catch (e) {
        await postData("/admin/telegram/reconnect");
      }

      const status = await fetchData("/telegram/connection-status");
      if (status && status.connected) {
        setConnectionStatus("connected");
        setChannelCount(status.channels_count || 0);
        setConnectionMessage(status.channels_count
          ? `Listening to ${status.channels_count} channel(s)`
          : "Telegram reconnected successfully.");
      } else {
        setConnectionStatus("disconnected");
        setConnectionError("Reconnect failed - your Telegram session may have expired. Try 'New Session'.");
      }
    } catch (e) {
      console.error("Reconnect error:", e);
      setConnectionStatus("disconnected");
      setConnectionError("Reconnect failed - check server logs for details.");
    } finally {
      setIsConnecting(false);
    }
  };

  if (credsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  // Collapsed view
  const CollapsedView = () => (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-md cursor-pointer",
      "hover:bg-white/[0.02] transition-colors",
      connectionStatus === "connected"
        ? "bg-emerald-500/[0.04] border border-emerald-500/15"
        : connectionStatus === "pending_code" || connectionStatus === "pending_password"
        ? "bg-blue-500/[0.04] border border-blue-500/15"
        : connectionStatus === "disconnected"
        ? "bg-rose-500/[0.04] border border-rose-500/15"
        : "bg-white/[0.02] border border-white/[0.06]"
    )}
    onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-2 h-2 rounded-full",
          connectionStatus === "connected" ? "bg-emerald-500" :
          connectionStatus === "pending_code" || connectionStatus === "pending_password" ? "bg-blue-500 animate-pulse" :
          connectionStatus === "disconnected" ? "bg-rose-500" :
          connectionStatus === "loading" ? "bg-amber-500 animate-pulse" :
          "bg-white/30"
        )} />
        <div>
          <p className={cn(
            "text-sm font-medium",
            connectionStatus === "connected" ? "text-emerald-400" :
            connectionStatus === "pending_code" || connectionStatus === "pending_password" ? "text-blue-400" :
            connectionStatus === "disconnected" ? "text-rose-400" :
            "text-foreground"
          )}>
            {connectionStatus === "connected" ? "Connected" :
             connectionStatus === "pending_code" ? "Awaiting Code" :
             connectionStatus === "pending_password" ? "Awaiting Password" :
             connectionStatus === "disconnected" ? "Disconnected" :
             connectionStatus === "loading" ? "Checking..." :
             "Not Configured"}
          </p>
          <p className="text-xs text-foreground-muted/70 mt-0.5">
            {connectionStatus === "connected" && channelCount > 0
              ? `Listening to ${channelCount} channel(s)`
              : connectionStatus === "connected"
              ? "Ready to receive signals"
              : telegramCreds.telegram_phone
              ? `Phone: ${telegramCreds.telegram_phone}`
              : "Configure your Telegram credentials"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {connectionStatus === "connected" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleReconnect();
            }}
            disabled={isConnecting}
            className="h-7 px-2 text-foreground-muted hover:text-foreground"
          >
            {isConnecting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </Button>
        )}
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <CollapsedView />

      {/* Expanded Form */}
      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200 pt-2">
          {/* Instructions */}
          <div className={cn(
            "p-4 rounded-md",
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
          <SettingRow label="API ID" description="Your Telegram application ID">
            <Input
              type="text"
              value={telegramCreds.telegram_api_id}
              onChange={(e) => onCredsChange("telegram_api_id", e.target.value)}
              placeholder="12345678"
              className={cn(inputClass, "w-32")}
            />
          </SettingRow>

          <SettingRow label="API Hash" description="Your Telegram application hash">
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

          <SettingRow label="Phone Number" description="With country code">
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

            {connectionStatus === "connected" && (
              <div className={cn(
                "flex items-center justify-between p-5 rounded-md",
                "bg-emerald-500/[0.06] border border-emerald-500/20"
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
                    {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
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
                  "bg-amber-500/[0.06] border border-amber-500/20"
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
                    "disabled:opacity-40 disabled:shadow-none",
                    "transition-all duration-200"
                  )}
                >
                  {isConnecting ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Shield size={14} className="mr-2" />}
                  Verify Password
                </Button>
              </div>
            )}

            {connectionStatus === "pending_code" && (
              <div className="space-y-4">
                <div className={cn(
                  "flex items-center gap-3 p-5 rounded-md",
                  "bg-blue-500/[0.06] border border-blue-500/20"
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
                      "focus:border-blue-400/40 focus:ring-2 focus:ring-blue-400/10"
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
                    "disabled:opacity-40 disabled:shadow-none",
                    "transition-all duration-200"
                  )}
                >
                  {isConnecting ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Check size={14} className="mr-2" />}
                  Verify Code
                </Button>
              </div>
            )}

            {connectionStatus === "disconnected" && (
              <div className="space-y-4">
                <div className={cn(
                  "flex items-center justify-between p-5 rounded-md",
                  "bg-rose-500/[0.06] border border-rose-500/20"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <div>
                      <p className="text-sm font-medium text-rose-400">Disconnected</p>
                      <p className="text-xs text-foreground-muted/70 italic mt-0.5">{connectionMessage}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleReconnect}
                    disabled={isConnecting}
                    className={cn(
                      "flex-1 h-11 rounded-none font-medium",
                      "bg-foreground text-background",
                      "hover:shadow-[0_4px_20px_rgba(255,255,255,0.2)]",
                      "active:scale-[0.99]",
                      "disabled:opacity-40 disabled:shadow-none",
                      "transition-all duration-200"
                    )}
                  >
                    {isConnecting ? <Loader2 size={14} className="mr-2 animate-spin" /> : <RefreshCw size={14} className="mr-2" />}
                    Reconnect
                  </Button>
                  <Button
                    onClick={handleSendCode}
                    disabled={isConnecting}
                    variant="ghost"
                    className="h-11 px-4 text-foreground-muted hover:text-foreground"
                  >
                    <Send size={14} className="mr-2" />
                    New Session
                  </Button>
                </div>
              </div>
            )}

            {connectionStatus === "not_configured" && (
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
                {isConnecting ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Send size={14} className="mr-2" />}
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
      )}
    </div>
  );
}

export default function ConnectionsTab({
  telegramCreds,
  onTelegramCredsChange,
  channels,
  onChannelsChange,
  mtCreds,
  isLoading,
  configStatus,
  isRefreshing,
  onRefresh,
}) {
  // Determine connection status for the status card
  const telegramConnected = telegramCreds.telegram_connected;
  const mtConnected = mtCreds.mt_connected;

  return (
    <div className="space-y-6">
      {/* Connection Status Dashboard */}
      <ConnectionStatusCard
        telegramConnected={telegramConnected}
        telegramMessage={telegramConnected ? `Phone: ${telegramCreds.telegram_phone}` : null}
        mtConnected={mtConnected}
        mtMessage={mtConnected ? `Account ${mtCreds.mt_login}` : null}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
      />

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
            onCredsChange={onTelegramCredsChange}
            channels={channels}
            onChannelsChange={onChannelsChange}
            isLoading={isLoading}
            configStatus={configStatus}
            defaultExpanded={!telegramConnected}
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
            isLoading={isLoading}
            defaultExpanded={!mtConnected}
          />
        </CardContent>
      </Card>
    </div>
  );
}

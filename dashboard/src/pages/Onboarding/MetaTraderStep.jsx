import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  AlertCircle,
  Info,
  BarChart3,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

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
          "pr-10 font-mono",
          className
        )}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted/50 hover:text-foreground-muted transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function FormField({ label, description, helpLink, children, required }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm md:text-base font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
        {helpLink && (
          <a
            href={helpLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground-muted hover:text-foreground transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
          >
            <HelpCircle size={16} />
          </a>
        )}
      </div>
      {children}
      {description && (
        <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

export default function MetaTraderStep({ onComplete, onSkip }) {
  const { user, session } = useAuth();
  const { postData, fetchData } = useApi();

  // WebSocket for real-time progress updates
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  const { lastMessage } = useWebSocket(wsUrl);

  // Form state
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [platform, setPlatform] = useState("mt5");
  const [brokerKeywords, setBrokerKeywords] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [provisioningStatus, setProvisioningStatus] = useState(null); // null, 'provisioning', 'deployed', 'error'
  const [provisioningMessage, setProvisioningMessage] = useState("");
  const [provisioningProgress, setProvisioningProgress] = useState(0);
  const [accountId, setAccountId] = useState(null);
  const [suggestedServers, setSuggestedServers] = useState([]);

  // Listen for WebSocket progress events
  useEffect(() => {
    if (lastMessage && lastMessage.type === "provisioning.progress") {
      const data = lastMessage.data;
      // Only process events for the current user
      if (data.user_id === user?.id) {
        setProvisioningMessage(data.message);
        setProvisioningProgress(data.progress || 0);

        if (data.status === "complete") {
          setProvisioningStatus("deployed");
          // Auto-proceed after brief delay
          setTimeout(() => onComplete(), 1500);
        } else if (data.status === "error") {
          setProvisioningStatus("error");
          setError(data.message);
          setIsLoading(false);
        }
      }
    }
  }, [lastMessage, user?.id, onComplete]);

  // Fallback polling for account deployment status (in case WebSocket misses events)
  useEffect(() => {
    if (provisioningStatus === "provisioning" && accountId) {
      const pollInterval = setInterval(async () => {
        try {
          const result = await fetchData(`/onboarding/metatrader/status/${accountId}`);
          if (result) {
            if (result.state === "DEPLOYED" && result.connection_status === "CONNECTED") {
              setProvisioningStatus("deployed");
              setProvisioningMessage("Account connected successfully!");
              setProvisioningProgress(100);
              clearInterval(pollInterval);
              // Auto-proceed after brief delay
              setTimeout(() => onComplete(), 1500);
            } else if (result.state === "DEPLOYED") {
              // Only update if not already getting WebSocket updates
              if (provisioningProgress < 80) {
                setProvisioningMessage(`Account deployed. Connecting to broker... (${result.connection_status || "waiting"})`);
                setProvisioningProgress(80);
              }
            }
          }
        } catch (e) {
          console.error("Error polling status:", e);
        }
      }, 5000); // Poll less frequently since we have WebSocket

      return () => clearInterval(pollInterval);
    }
  }, [provisioningStatus, accountId, fetchData, onComplete, provisioningProgress]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuggestedServers([]);

    // Validation
    if (!login || !password || !server) {
      setError("Please fill in all required fields");
      return;
    }

    if (!/^\d+$/.test(login)) {
      setError("Account number must contain only digits");
      return;
    }

    setIsLoading(true);
    setProvisioningStatus("provisioning");
    setProvisioningMessage("Validating credentials...");
    setProvisioningProgress(5);

    try {
      const result = await postData("/onboarding/metatrader", {
        login,
        password,
        server,
        platform,
        broker_keywords: brokerKeywords ? brokerKeywords.split(",").map(k => k.trim()) : [],
      });

      if (result) {
        if (result.success) {
          setAccountId(result.account_id);

          if (result.provisioning_status === "DEPLOYED") {
            setProvisioningStatus("deployed");
            setProvisioningMessage("Account connected successfully!");
            setTimeout(() => onComplete(), 1500);
          } else {
            setProvisioningMessage(`Account created. Deploying... (${result.provisioning_status || "initializing"})`);
          }
        } else {
          setProvisioningStatus("error");
          setError(result.message || "Failed to create account");

          // Handle suggested servers if provided
          if (result.suggested_servers && result.suggested_servers.length > 0) {
            setSuggestedServers(result.suggested_servers);
          }
        }
      } else {
        setProvisioningStatus("error");
        setError("Failed to connect to the server. Please try again.");
      }
    } catch (e) {
      setProvisioningStatus("error");
      setError(e.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setProvisioningStatus(null);
    setProvisioningMessage("");
    setProvisioningProgress(0);
    setError("");
    setAccountId(null);
  };

  // Show provisioning progress
  if (provisioningStatus === "provisioning" || provisioningStatus === "deployed") {
    return (
      <div className="space-y-6">
        <div className={cn(
          "p-6 md:p-8 rounded-lg border text-center space-y-4",
          provisioningStatus === "deployed"
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-primary/5 border-primary/20"
        )}>
          {provisioningStatus === "deployed" ? (
            <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-emerald-500 mx-auto" />
          ) : (
            <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-primary mx-auto animate-spin" />
          )}

          <div>
            <h3 className="text-lg md:text-xl font-semibold text-foreground">
              {provisioningStatus === "deployed" ? "Connected!" : "Setting Up Your Account"}
            </h3>
            <p className="text-sm md:text-base text-foreground-muted mt-2 leading-relaxed">
              {provisioningMessage}
            </p>
          </div>

          {/* Progress bar */}
          {provisioningStatus === "provisioning" && (
            <div className="w-full max-w-md mx-auto space-y-2">
              <Progress value={provisioningProgress} className="h-2" />
              <p className="text-xs text-foreground-muted">
                {provisioningProgress}% complete
              </p>
            </div>
          )}

          {provisioningStatus === "provisioning" && (
            <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
              This usually takes 30-60 seconds. Please don't close this page.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Notice */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 md:p-5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm md:text-base font-medium text-foreground">
              Your credentials are secure
            </p>
            <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
              Your password is transmitted securely to MetaAPI for account connection and is{" "}
              <strong>never stored, logged, or accessible</strong> by us. MetaAPI uses bank-grade encryption.
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 md:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm md:text-base font-medium text-foreground">
              Connect your MetaTrader account
            </p>
            <p className="text-sm md:text-base text-foreground-muted leading-relaxed">
              Enter your broker account details exactly as they appear in your MetaTrader terminal.
              You can find these in your broker welcome email or in MT under File → Login to Trade Account.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 md:p-5 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm md:text-base leading-relaxed">{error}</p>
            {suggestedServers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs md:text-sm font-medium">Did you mean one of these servers?</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedServers.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setServer(s);
                        setError("");
                        setSuggestedServers([]);
                      }}
                      className="text-xs md:text-sm px-3 py-2 bg-background/50 rounded hover:bg-background transition-colors touch-manipulation min-h-[44px]"
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
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-2 min-h-[44px]"
              >
                Try Again
              </Button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Platform Selection */}
        <FormField
          label="Platform"
          description="Select the MetaTrader version your broker uses"
          required
        >
          <div className="flex gap-3">
            <Button
              type="button"
              variant={platform === "mt4" ? "default" : "outline"}
              onClick={() => setPlatform("mt4")}
              disabled={isLoading}
              className="flex-1 h-12 md:h-11 flex-col sm:flex-row"
            >
              <span className="font-semibold">MT4</span>
              <span className="text-xs sm:ml-2 opacity-70">MetaTrader 4</span>
            </Button>
            <Button
              type="button"
              variant={platform === "mt5" ? "default" : "outline"}
              onClick={() => setPlatform("mt5")}
              disabled={isLoading}
              className="flex-1 h-12 md:h-11 flex-col sm:flex-row"
            >
              <span className="font-semibold">MT5</span>
              <span className="text-xs sm:ml-2 opacity-70">MetaTrader 5</span>
            </Button>
          </div>
        </FormField>

        {/* Login/Account Number */}
        <FormField
          label="Account Number (Login)"
          description="Your trading account number - digits only. Found in your broker welcome email or MT terminal under File → Login."
          required
        >
          <Input
            type="text"
            placeholder="e.g., 12345678"
            value={login}
            onChange={(e) => setLogin(e.target.value.replace(/\D/g, ""))}
            className="bg-background/50 font-mono h-12 md:h-11 text-base"
            disabled={isLoading}
          />
        </FormField>

        {/* Password */}
        <FormField
          label="Password"
          description={
            <>
              Your MetaTrader account password (investor or master password).{" "}
              <span className="text-emerald-500 font-medium">Never stored on our servers.</span>
            </>
          }
          required
        >
          <PasswordInput
            placeholder="Enter your MT password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-background/50 h-12 md:h-11 text-base"
            disabled={isLoading}
          />
        </FormField>

        {/* Server */}
        <FormField
          label="Server"
          description="The exact server name from your broker. Found in MT terminal under File → Login (e.g., ICMarketsSC-MT5, Exness-Real4)."
          required
        >
          <Input
            type="text"
            placeholder="e.g., BrokerName-Live or BrokerName-Demo"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            className="bg-background/50 h-12 md:h-11 text-base"
            disabled={isLoading}
          />
        </FormField>

        {/* Broker Keywords (Optional) */}
        <FormField
          label="Broker Name (Optional)"
          description="Your broker's company name helps find the correct server settings automatically. Separate multiple keywords with commas."
        >
          <Input
            type="text"
            placeholder="e.g., IC Markets, Exness, XM"
            value={brokerKeywords}
            onChange={(e) => setBrokerKeywords(e.target.value)}
            className="bg-background/50 h-12 md:h-11 text-base"
            disabled={isLoading}
          />
        </FormField>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={isLoading}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Skip for now
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !login || !password || !server}
            className="w-full sm:w-auto sm:min-w-[160px] min-h-[44px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Connecting...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4 mr-2" />
                Connect Account
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Help Section */}
      <div className="bg-background-raised rounded-lg p-4 md:p-5 space-y-3">
        <h4 className="text-sm md:text-base font-medium text-foreground">Need help?</h4>
        <ul className="text-xs md:text-sm text-foreground-muted space-y-3">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span className="leading-relaxed">
              <strong>Can't find your server?</strong> Check your broker's website or contact their support for the exact server name.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span className="leading-relaxed">
              <strong>Investor vs Master password:</strong> Use investor password for read-only access, or master password to enable trading.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span className="leading-relaxed">
              <strong>Connection issues?</strong> Ensure your account is active and not expired. Demo accounts may have limited validity.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

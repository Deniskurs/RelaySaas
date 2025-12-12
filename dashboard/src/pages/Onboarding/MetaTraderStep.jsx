import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserCredentials } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Info, BarChart3 } from "lucide-react";

export default function MetaTraderStep({ onComplete, onSkip }) {
  const { user } = useAuth();
  const [login, setLogin] = useState("");
  const [server, setServer] = useState("");
  const [platform, setPlatform] = useState("mt5");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!login || !server) {
      setError("Please fill in all required fields");
      return;
    }

    // Validate login is numeric
    if (!/^\d+$/.test(login)) {
      setError("Login must be your MT account number");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await updateUserCredentials(user.id, {
        mt_login: login,
        mt_server: server,
        mt_platform: platform,
        mt_connected: false, // Will be set after MetaApi provisioning
      });

      if (updateError) {
        setError(updateError.message || "Failed to save MetaTrader details");
        return;
      }

      onComplete();
    } catch (e) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-primary/5 border border-primary/20 rounded-none p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Connect your MetaTrader account
            </p>
            <p className="text-sm text-foreground-muted">
              Enter your MetaTrader account details. Your password is never stored -
              we'll send you a secure link to authorize the connection.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-none bg-destructive/10 text-destructive text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Account Number (Login)
          </label>
          <Input
            type="text"
            placeholder="12345678"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="bg-background/50 font-mono"
            disabled={isLoading}
          />
          <p className="text-xs text-foreground-muted">
            Your MT4/MT5 account number provided by your broker
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Server
          </label>
          <Input
            type="text"
            placeholder="BrokerName-Live"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            className="bg-background/50"
            disabled={isLoading}
          />
          <p className="text-xs text-foreground-muted">
            The server name exactly as shown in your MT terminal (e.g., ICMarketsSC-MT5)
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Platform
          </label>
          <div className="flex gap-3">
            <Button
              type="button"
              variant={platform === "mt4" ? "default" : "outline"}
              onClick={() => setPlatform("mt4")}
              disabled={isLoading}
              className="flex-1"
            >
              MetaTrader 4
            </Button>
            <Button
              type="button"
              variant={platform === "mt5" ? "default" : "outline"}
              onClick={() => setPlatform("mt5")}
              disabled={isLoading}
              className="flex-1"
            >
              MetaTrader 5
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button type="button" variant="ghost" onClick={onSkip} disabled={isLoading}>
            Skip for now
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <BarChart3 className="w-4 h-4 mr-2" />
            )}
            Save & Continue
          </Button>
        </div>
      </form>

      <div className="bg-background-raised rounded-none p-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Important Notes:</h4>
        <ul className="text-xs text-foreground-muted space-y-1 list-disc list-inside">
          <li>Your password is never stored on our servers</li>
          <li>After setup, you'll receive a secure link to authorize the connection</li>
          <li>You can revoke access anytime from your broker settings</li>
          <li>We only execute trades based on your configured signals</li>
        </ul>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserCredentials } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, AlertCircle, Info, MessageSquare } from "lucide-react";

export default function TelegramStep({ onComplete, onSkip }) {
  const { user } = useAuth();
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!apiId || !apiHash || !phone) {
      setError("Please fill in all fields");
      return;
    }

    // Validate API ID is numeric
    if (!/^\d+$/.test(apiId)) {
      setError("API ID must be a number");
      return;
    }

    // Basic phone validation
    if (!/^\+?\d{10,15}$/.test(phone.replace(/\s/g, ""))) {
      setError("Please enter a valid phone number with country code");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await updateUserCredentials(user.id, {
        telegram_api_id: apiId,
        telegram_api_hash: apiHash,
        telegram_phone: phone,
        telegram_connected: false, // Will be set to true after verification
      });

      if (updateError) {
        setError(updateError.message || "Failed to save Telegram credentials");
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
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              How to get your Telegram API credentials:
            </p>
            <ol className="text-sm text-foreground-muted space-y-1 list-decimal list-inside">
              <li>
                Visit{" "}
                <a
                  href="https://my.telegram.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  my.telegram.org
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Log in with your phone number</li>
              <li>Go to "API development tools"</li>
              <li>Create a new application (any name/description)</li>
              <li>Copy your API ID and API Hash</li>
            </ol>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              API ID
            </label>
            <Input
              type="text"
              placeholder="12345678"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
              className="bg-background/50 font-mono"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              API Hash
            </label>
            <Input
              type="password"
              placeholder="Your API hash"
              value={apiHash}
              onChange={(e) => setApiHash(e.target.value)}
              className="bg-background/50 font-mono"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Phone Number
          </label>
          <Input
            type="tel"
            placeholder="+1234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="bg-background/50"
            disabled={isLoading}
          />
          <p className="text-xs text-foreground-muted">
            Include country code (e.g., +1 for US, +44 for UK)
          </p>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button type="button" variant="ghost" onClick={onSkip} disabled={isLoading}>
            Skip for now
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <MessageSquare className="w-4 h-4 mr-2" />
            )}
            Save & Continue
          </Button>
        </div>
      </form>

      <p className="text-xs text-foreground-muted text-center">
        Your credentials are encrypted and stored securely. You can update them anytime in Settings.
      </p>
    </div>
  );
}

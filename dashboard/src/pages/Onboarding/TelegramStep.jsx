import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ExternalLink,
  AlertCircle,
  Info,
  MessageSquare,
  Send,
  Shield,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
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
        className={cn("pr-10 font-mono", className)}
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

export default function TelegramStep({ onComplete, onSkip }) {
  const { user } = useAuth();
  const { postData } = useApi();

  // Form state
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  // UI state
  const [step, setStep] = useState("credentials"); // 'credentials', 'code', 'password', 'success'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSendCode = async (e) => {
    e?.preventDefault();
    setError("");

    // Validation
    if (!apiId || !apiHash || !phone) {
      setError("Please fill in all fields");
      return;
    }

    if (!/^\d+$/.test(apiId)) {
      setError("API ID must be a number");
      return;
    }

    const cleanPhone = phone.replace(/\s/g, "");
    if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
      setError("Please enter a valid phone number with country code");
      return;
    }

    setIsLoading(true);

    try {
      const result = await postData("/onboarding/telegram/send-code", {
        api_id: apiId,
        api_hash: apiHash,
        phone: cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`,
      });

      if (result && result.status === "code_sent") {
        setStep("code");
        setMessage(result.message || "Check your Telegram app for the verification code.");
      } else if (result && result.status === "error") {
        setError(result.message || "Failed to send code. Please check your credentials.");
      } else {
        setError("Failed to send verification code. Please try again.");
      }
    } catch (e) {
      setError(e.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e?.preventDefault();
    setError("");

    if (!code || code.length < 5) {
      setError("Please enter the verification code from Telegram");
      return;
    }

    setIsLoading(true);

    try {
      const result = await postData("/onboarding/telegram/verify-code", {
        code: code.trim(),
      });

      if (result) {
        if (result.status === "connected") {
          setStep("success");
          setMessage(result.message || "Telegram connected successfully!");
          setTimeout(() => onComplete(), 1500);
        } else if (result.status === "pending_password") {
          setStep("password");
          setMessage(result.message || "Two-factor authentication required.");
        } else if (result.status === "error") {
          setError(result.message || "Invalid code. Please try again.");
        }
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (e) {
      setError(e.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPassword = async (e) => {
    e?.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter your Telegram 2FA password");
      return;
    }

    setIsLoading(true);

    try {
      const result = await postData("/onboarding/telegram/verify-password", {
        password,
      });

      if (result && result.status === "connected") {
        setStep("success");
        setMessage(result.message || "Telegram connected successfully!");
        setTimeout(() => onComplete(), 1500);
      } else {
        setError(result?.message || "Invalid password. Please try again.");
      }
    } catch (e) {
      setError(e.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setError("");
    if (step === "password") {
      setStep("code");
      setPassword("");
    } else if (step === "code") {
      setStep("credentials");
      setCode("");
    }
  };

  // Success state
  if (step === "success") {
    return (
      <div className="space-y-6">
        <div className="p-6 md:p-8 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-emerald-500 mx-auto" />
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-foreground">Connected!</h3>
            <p className="text-sm md:text-base text-foreground-muted mt-2">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  // 2FA Password step
  if (step === "password") {
    return (
      <div className="space-y-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 md:p-5">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm md:text-base font-medium text-foreground">
                Two-Factor Authentication Required
              </p>
              <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
                {message || "Your account has 2FA enabled. Please enter your Telegram password."}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 md:p-4 rounded-lg bg-destructive/10 text-destructive text-sm md:text-base">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerifyPassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm md:text-base font-medium text-foreground">
              Telegram Password
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your 2FA password"
              className="bg-background/50 h-12 md:h-11"
              disabled={isLoading}
            />
            <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
              This is the password you set in Telegram Settings → Privacy and Security → Two-Step Verification
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={handleBack} disabled={isLoading} className="w-full sm:w-auto min-h-[44px]">
              Back
            </Button>
            <Button type="submit" disabled={isLoading || !password} className="w-full sm:w-auto min-h-[44px]">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Verify Password
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Verification code step
  if (step === "code") {
    return (
      <div className="space-y-6">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 md:p-5">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm md:text-base font-medium text-foreground">
                Verification Code Sent
              </p>
              <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
                {message || "Check your Telegram app for the verification code."}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 md:p-4 rounded-lg bg-destructive/10 text-destructive text-sm md:text-base">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm md:text-base font-medium text-foreground">
              Verification Code
            </label>
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter the code"
              className={cn(
                "h-16 md:h-14 text-center text-2xl md:text-3xl tracking-[0.5em] font-mono",
                "bg-background/50"
              )}
              maxLength={6}
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs md:text-sm text-foreground-muted text-center leading-relaxed">
              The code was sent to your Telegram app. It may also arrive via SMS.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={handleBack} disabled={isLoading} className="w-full sm:w-auto min-h-[44px]">
              Back
            </Button>
            <Button type="submit" disabled={isLoading || code.length < 5} className="w-full sm:w-auto min-h-[44px]">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Verify Code
                </>
              )}
            </Button>
          </div>
        </form>

        <button
          type="button"
          onClick={handleSendCode}
          disabled={isLoading}
          className="w-full text-sm md:text-base text-foreground-muted hover:text-foreground transition-colors min-h-[44px] touch-manipulation"
        >
          Didn't receive the code? Click to resend
        </button>
      </div>
    );
  }

  // Credentials step (default)
  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 md:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm md:text-base font-medium text-foreground">
              How to get your Telegram API credentials:
            </p>
            <ol className="text-sm md:text-base text-foreground-muted space-y-1.5 list-decimal list-inside leading-relaxed">
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
        <div className="flex items-center gap-2 p-3 md:p-4 rounded-lg bg-destructive/10 text-destructive text-sm md:text-base">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSendCode} className="space-y-5">
        <div className="grid gap-4 md:gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm md:text-base font-medium text-foreground">
              API ID <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="12345678"
              value={apiId}
              onChange={(e) => setApiId(e.target.value.replace(/\D/g, ""))}
              className="bg-background/50 font-mono h-12 md:h-11 text-base"
              disabled={isLoading}
            />
            <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
              Numeric ID from my.telegram.org
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm md:text-base font-medium text-foreground">
              API Hash <span className="text-destructive">*</span>
            </label>
            <PasswordInput
              placeholder="Your API hash"
              value={apiHash}
              onChange={(e) => setApiHash(e.target.value)}
              className="bg-background/50 h-12 md:h-11 text-base"
              disabled={isLoading}
            />
            <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
              32-character hash from my.telegram.org
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm md:text-base font-medium text-foreground">
            Phone Number <span className="text-destructive">*</span>
          </label>
          <Input
            type="tel"
            placeholder="+1234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="bg-background/50 h-12 md:h-11 text-base"
            disabled={isLoading}
          />
          <p className="text-xs md:text-sm text-foreground-muted leading-relaxed">
            Include country code (e.g., +1 for US, +44 for UK). This must match your Telegram account.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onSkip} disabled={isLoading} className="w-full sm:w-auto min-h-[44px]">
            Skip for now
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !apiId || !apiHash || !phone}
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sending Code...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Verification Code
              </>
            )}
          </Button>
        </div>
      </form>

      <p className="text-xs md:text-sm text-foreground-muted text-center leading-relaxed">
        Your credentials are encrypted and stored securely. You can update them anytime in Settings.
      </p>
    </div>
  );
}

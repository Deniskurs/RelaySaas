import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, TrendingUp, ArrowLeft, Check } from "lucide-react";

export default function ForgotPassword() {
  const { requestPasswordReset, error, clearError, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    clearError();

    if (!email) {
      setLocalError("Please enter your email address");
      return;
    }

    const { success, error } = await requestPasswordReset(email);

    if (success) {
      setSuccess(true);
    } else {
      setLocalError(error || "Failed to send reset email");
    }
  };

  const displayError = localError || error;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <Card className="glass-card border-0">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
              <p className="text-sm text-foreground-muted">
                We've sent password reset instructions to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </p>
              <p className="text-xs text-foreground-muted">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" onClick={() => setSuccess(false)}>
                  Try again
                </Button>
                <Link to="/login">
                  <Button>Back to Sign In</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Brand */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Signal Copier</h1>
          <p className="text-sm text-foreground-muted">
            Reset your password
          </p>
        </div>

        <Card className="glass-card border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-center">Forgot password?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground-muted text-center">
              Enter your email address and we'll send you instructions to reset your password.
            </p>

            {displayError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle size={16} />
                {displayError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/50"
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Send Reset Instructions
              </Button>
            </form>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Sign In
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

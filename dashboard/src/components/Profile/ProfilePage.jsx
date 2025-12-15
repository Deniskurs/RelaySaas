import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Save,
  RotateCcw,
  Check,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Crown,
  User,
  Key,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PricingCardsCompact } from "@/components/Plans";

function ProfileRow({ label, description, children, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-4 first:pt-0 last:pb-0",
        className
      )}
    >
      <div className="flex flex-col gap-0.5 pr-6 min-w-0">
        <span className="text-[14px] font-medium text-foreground">
          {label}
        </span>
        {description && (
          <span className="text-[12px] text-foreground-muted/60 leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
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
          "h-9 pr-9 text-sm",
          "bg-white/[0.04] border-white/[0.08] rounded-none",
          "focus:border-white/20 focus:bg-white/[0.06] focus:ring-0",
          className
        )}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted/50 hover:text-foreground-muted transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// Provider icons
function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function SubscriptionBadge({ tier }) {
  const tierConfig = {
    free: {
      label: "Free",
      icon: User,
      className: "border-white/10 bg-white/[0.04] text-foreground-muted",
    },
    pro: {
      label: "Pro",
      icon: Shield,
      className: "border-white/20 bg-white/[0.08] text-foreground",
    },
    premium: {
      label: "Premium",
      icon: Crown,
      className: "border-white/20 bg-white/[0.12] text-foreground",
    },
  };

  const config = tierConfig[tier?.toLowerCase()] || tierConfig.free;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 px-3 py-1 text-xs font-medium", config.className)}
    >
      <Icon size={12} />
      {config.label}
    </Badge>
  );
}

function StatusBadge({ status }) {
  const statusConfig = {
    active: {
      label: "Active",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    },
    pending: {
      label: "Pending",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    },
    suspended: {
      label: "Suspended",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    },
  };

  const config = statusConfig[status?.toLowerCase()] || statusConfig.active;

  return (
    <Badge
      variant="outline"
      className={cn("px-3 py-1 text-xs font-medium capitalize", config.className)}
    >
      {config.label}
    </Badge>
  );
}

// PlansSheet - Uses new PricingCardsCompact component
function PlansSheet({ open, onOpenChange, onSelectPlan }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-background border-white/[0.06] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-semibold text-foreground">
            Subscription Plans
          </SheetTitle>
          <SheetDescription className="text-foreground-muted/70">
            Choose the plan that best fits your trading needs
          </SheetDescription>
        </SheetHeader>

        <PricingCardsCompact
          onSelectPlan={(planId) => {
            onSelectPlan?.(planId);
            onOpenChange(false);
          }}
        />

        <div className="mt-6 p-4 rounded-none bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs text-foreground-muted/60 text-center">
            All plans include a 14-day money-back guarantee. Cancel anytime.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ProfilePage() {
  const {
    user,
    profile,
    updateProfile,
    updatePassword,
    isLoading: authLoading,
  } = useAuth();

  // Form states
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [originalName, setOriginalName] = useState(profile?.full_name || "");

  // Password change states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI states
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [plansOpen, setPlansOpen] = useState(false);

  const hasNameChanges = fullName !== originalName;
  const hasPasswordInput = newPassword || confirmPassword;

  // Detect OAuth provider
  const getAuthProvider = () => {
    // Check identities array first (most reliable)
    if (user?.identities?.length > 0) {
      const identity = user.identities[0];
      return identity.provider;
    }
    // Fallback to app_metadata
    if (user?.app_metadata?.provider) {
      return user.app_metadata.provider;
    }
    return "email";
  };

  const authProvider = getAuthProvider();
  const isOAuthUser = authProvider !== "email";

  const getProviderDisplay = () => {
    switch (authProvider) {
      case "google":
        return { name: "Google", Icon: GoogleIcon };
      case "apple":
        return { name: "Apple", Icon: AppleIcon };
      default:
        return null;
    }
  };

  const providerDisplay = getProviderDisplay();

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSaveProfile = async () => {
    if (!hasNameChanges) return;

    setIsSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      const result = await updateProfile({ full_name: fullName });
      if (result.success) {
        setOriginalName(fullName);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to update profile");
      }
    } catch (e) {
      setError("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetProfile = () => {
    setFullName(originalName);
    setError("");
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (!newPassword) {
      setPasswordError("Please enter a new password");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await updatePassword(newPassword);
      if (result.success) {
        setNewPassword("");
        setConfirmPassword("");
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError(result.error || "Failed to change password");
      }
    } catch (e) {
      setPasswordError("An unexpected error occurred");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleResetPassword = () => {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[calc(100vh-8rem)]">
        <div className="pb-16">
          {/* Header */}
          <div className="flex items-center justify-between py-8 mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Profile
              </h1>
              <p className="text-sm text-foreground-muted/70 italic mt-1">
                Manage your account details and security settings
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {error && (
                <span className="text-sm text-rose-400 flex items-center gap-1.5 bg-rose-500/10 px-3 py-1.5 rounded-none">
                  <AlertCircle size={14} />
                  <span className="italic">{error}</span>
                </span>
              )}
              {saveSuccess && (
                <span className="text-sm text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-none animate-in fade-in slide-in-from-right-2">
                  <Check size={14} />
                  <span className="italic">Saved</span>
                </span>
              )}
              {hasNameChanges && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetProfile}
                    className="text-foreground-muted hover:text-foreground hover:bg-white/[0.05] h-9 px-3"
                  >
                    <RotateCcw size={14} className="mr-1.5" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className={cn(
                      "h-9 px-4 rounded-none bg-white/[0.9] text-background hover:bg-white font-medium",
                      "disabled:opacity-40 disabled:bg-white/[0.1] disabled:text-foreground-muted",
                      "transition-all"
                    )}
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                    ) : (
                      <Save size={14} className="mr-1.5" />
                    )}
                    Save Changes
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Account Information */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              <CardHeader className="pb-0 pt-5 px-6">
                <CardTitle className="text-[11px] font-semibold text-foreground-muted/60 uppercase tracking-widest">
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pt-4 pb-6 space-y-1">
                <ProfileRow
                  label="Full Name"
                  description="Your display name across the platform"
                >
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-56 h-9 px-3 text-sm bg-white/[0.04] border-white/[0.08] rounded-none focus:border-white/20 focus:bg-white/[0.06] focus:ring-0 transition-colors placeholder:text-foreground-muted/40"
                  />
                </ProfileRow>

                <ProfileRow
                  label="Email Address"
                  description="Your account email cannot be changed"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground-muted font-mono">
                      {user?.email}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 border-white/10 bg-white/[0.04] text-foreground-muted/60"
                    >
                      Verified
                    </Badge>
                  </div>
                </ProfileRow>

                <ProfileRow
                  label="Member Since"
                  description="When you joined the platform"
                >
                  <span className="text-sm text-foreground-muted">
                    {formatDate(user?.created_at || profile?.created_at)}
                  </span>
                </ProfileRow>
              </CardContent>
            </Card>

            {/* Subscription & Status */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              <CardHeader className="pb-0 pt-5 px-6">
                <CardTitle className="text-[11px] font-semibold text-foreground-muted/60 uppercase tracking-widest">
                  Subscription & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pt-4 pb-6 space-y-1">
                <ProfileRow
                  label="Current Plan"
                  description="Your active subscription tier"
                >
                  <div className="flex items-center gap-2">
                    <SubscriptionBadge tier={profile?.subscription_tier} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlansOpen(true)}
                      className="h-7 px-2 text-xs text-foreground-muted hover:text-foreground hover:bg-white/[0.05]"
                    >
                      <Zap size={12} className="mr-1" />
                      View Plans
                    </Button>
                  </div>
                </ProfileRow>

                <ProfileRow
                  label="Account Status"
                  description="Your account access level"
                >
                  <StatusBadge status={profile?.status} />
                </ProfileRow>

                <ProfileRow
                  label="Account Role"
                  description="Your permission level"
                >
                  <Badge
                    variant="outline"
                    className="px-3 py-1 text-xs font-medium capitalize border-white/10 bg-white/[0.04] text-foreground-muted"
                  >
                    {profile?.role || "User"}
                  </Badge>
                </ProfileRow>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              <CardHeader className="pb-0 pt-5 px-6">
                <CardTitle className="text-[11px] font-semibold text-foreground-muted/60 uppercase tracking-widest">
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pt-4 pb-6">
                {isOAuthUser && providerDisplay ? (
                  // OAuth user - show provider info instead of password form
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-none bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-none bg-white/[0.06]">
                          <providerDisplay.Icon className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Signed in with {providerDisplay.name}
                          </p>
                          <p className="text-xs text-foreground-muted/60 italic mt-0.5">
                            Your account is secured through {providerDisplay.name}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs"
                      >
                        Connected
                      </Badge>
                    </div>

                    <p className="text-xs text-foreground-muted/50 italic px-1">
                      Password management is handled by your {providerDisplay.name} account.
                      To change your password, please visit your {providerDisplay.name} account settings.
                    </p>
                  </div>
                ) : (
                  // Email user - show password change form
                  <div className="space-y-4">
                    <ProfileRow
                      label="New Password"
                      description="Minimum 8 characters"
                      className="py-3"
                    >
                      <PasswordInput
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-56"
                      />
                    </ProfileRow>

                    <ProfileRow
                      label="Confirm Password"
                      description="Re-enter your new password"
                      className="py-3"
                    >
                      <PasswordInput
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-56"
                      />
                    </ProfileRow>

                    {passwordError && (
                      <div className="flex items-center gap-2 text-rose-400 text-sm py-2">
                        <AlertCircle size={14} />
                        <span className="italic">{passwordError}</span>
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="flex items-center gap-2 text-emerald-400 text-sm py-2 animate-in fade-in">
                        <Check size={14} />
                        <span className="italic">Password updated successfully</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      {hasPasswordInput && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResetPassword}
                          className="text-foreground-muted hover:text-foreground hover:bg-white/[0.05] h-9 px-3"
                        >
                          <RotateCcw size={14} className="mr-1.5" />
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleChangePassword}
                        disabled={isChangingPassword || !newPassword || !confirmPassword}
                        className={cn(
                          "h-9 px-4 rounded-none bg-white/[0.9] text-background hover:bg-white font-medium",
                          "disabled:opacity-40 disabled:bg-white/[0.1] disabled:text-foreground-muted",
                          "transition-all"
                        )}
                      >
                        {isChangingPassword ? (
                          <Loader2 size={14} className="mr-1.5 animate-spin" />
                        ) : (
                          <Key size={14} className="mr-1.5" />
                        )}
                        Update Password
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>

      {/* Plans Sheet */}
      <PlansSheet
        open={plansOpen}
        onOpenChange={setPlansOpen}
        onSelectPlan={(planId) => {
          console.log("Selected plan:", planId);
          // TODO: Integrate with Stripe checkout
        }}
      />
    </>
  );
}

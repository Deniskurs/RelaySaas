import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  Check,
  Plus,
  Trash2,
  Star,
  StarOff,
  ChevronDown,
  Eye,
  EyeOff,
  RefreshCw,
  BarChart3,
  Shield,
  CheckCircle2,
  MoreVertical,
  Power,
  PowerOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useConditionalPolling } from "@/hooks/useVisibilityPolling";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SettingRow, PasswordInput, inputClass } from "./SettingsComponents";

function AccountCard({
  account,
  onSetPrimary,
  onToggleActive,
  onDelete,
  onRefreshStatus,
  isRefreshing,
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const statusColor = account.is_connected
    ? "bg-emerald-500"
    : account.metaapi_account_id
    ? "bg-amber-500"
    : "bg-white/30";

  const statusText = account.is_connected
    ? "Connected"
    : account.metaapi_account_id
    ? "Connecting..."
    : "Not Provisioned";

  return (
    <>
      <div
        className={cn(
          "group relative p-4 rounded-md border transition-all duration-200",
          account.is_connected
            ? "bg-emerald-500/[0.04] border-emerald-500/15 hover:border-emerald-500/25"
            : account.metaapi_account_id
            ? "bg-amber-500/[0.04] border-amber-500/15 hover:border-amber-500/25"
            : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.10]",
          !account.is_active && "opacity-50"
        )}
      >
        {/* Primary badge */}
        {account.is_primary && (
          <div className="absolute -top-2 -right-2">
            <Badge
              variant="outline"
              className="bg-background text-[10px] font-medium border-amber-500/30 text-amber-400"
            >
              Primary
            </Badge>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          {/* Left side - account info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Status indicator */}
            <div className="relative mt-1">
              <div className={cn("w-2.5 h-2.5 rounded-full", statusColor)} />
              {account.metaapi_account_id && !account.is_connected && (
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-amber-500/50 animate-ping" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-foreground truncate">
                  {account.account_alias}
                </h4>
                {!account.is_active && (
                  <Badge variant="outline" className="text-[9px] opacity-70">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-xs text-foreground-muted/70 mt-0.5">
                <span className="font-mono">{account.mt_login}</span>
                <span className="mx-1 opacity-50">@</span>
                <span className="truncate">{account.mt_server}</span>
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge
                  variant="outline"
                  className="text-[9px] uppercase font-medium"
                >
                  {account.mt_platform}
                </Badge>
                <span
                  className={cn(
                    "text-[10px]",
                    account.is_connected
                      ? "text-emerald-400"
                      : "text-foreground-muted/50"
                  )}
                >
                  {statusText}
                </span>
              </div>
            </div>
          </div>

          {/* Right side - actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground-muted hover:text-foreground"
              onClick={() => onRefreshStatus(account.id)}
              disabled={isRefreshing}
            >
              <RefreshCw
                size={14}
                className={cn(isRefreshing && "animate-spin")}
              />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-foreground-muted hover:text-foreground"
                >
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {!account.is_primary && (
                  <DropdownMenuItem onClick={() => onSetPrimary(account.id)}>
                    <Star size={14} className="mr-2" />
                    Set as Primary
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onToggleActive(account)}>
                  {account.is_active ? (
                    <>
                      <PowerOff size={14} className="mr-2" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Power size={14} className="mr-2" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-rose-400 focus:text-rose-400"
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{account.account_alias}" (
              {account.mt_login}) from your accounts. The MetaAPI
              connection will remain but won't be used.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(account.id)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AddAccountDialog({ open, onOpenChange, onAccountAdded }) {
  const { user } = useAuth();
  const { postData, fetchData } = useApi();

  // WebSocket for real-time progress updates
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  const { lastMessage } = useWebSocket(wsUrl);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [suggestedServers, setSuggestedServers] = useState([]);
  const [provisioningStatus, setProvisioningStatus] = useState("idle");
  const [provisioningMessage, setProvisioningMessage] = useState("");
  const [provisioningProgress, setProvisioningProgress] = useState(0);
  const [newAccountId, setNewAccountId] = useState(null);
  const [metaapiAccountId, setMetaapiAccountId] = useState(null);
  const hasReloadedRef = useRef(false);

  const [formData, setFormData] = useState({
    account_alias: "",
    mt_login: "",
    mt_password: "",
    mt_server: "",
    mt_platform: "mt5",
    broker_keywords: "",
  });

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
          hasReloadedRef.current = true;
          setTimeout(() => {
            onOpenChange(false);
            onAccountAdded();
          }, 1500);
        } else if (data.status === "error") {
          setProvisioningStatus("error");
          setError(data.message);
          setIsSubmitting(false);
        }
      }
    }
  }, [lastMessage, user?.id, onOpenChange, onAccountAdded]);

  // Fallback polling for deployment status (in case WebSocket misses events)
  const checkDeploymentStatus = useCallback(async () => {
    if (!metaapiAccountId || hasReloadedRef.current) return;

    try {
      const result = await fetchData(`/mt-accounts/${newAccountId}/status`);
      if (result) {
        if (
          result.state === "DEPLOYED" &&
          result.connection_status === "CONNECTED"
        ) {
          setProvisioningStatus("deployed");
          setProvisioningMessage("Account connected successfully!");
          setProvisioningProgress(100);
          hasReloadedRef.current = true;
          setTimeout(() => {
            onOpenChange(false);
            onAccountAdded();
          }, 1500);
        } else if (result.state === "DEPLOYED") {
          // Only update if not already getting WebSocket updates
          if (provisioningProgress < 80) {
            setProvisioningMessage(
              `Account deployed. Connecting to broker... (${
                result.connection_status || "waiting"
              })`
            );
            setProvisioningProgress(80);
          }
        }
      }
    } catch (e) {
      console.error("Error polling status:", e);
    }
  }, [metaapiAccountId, newAccountId, fetchData, onOpenChange, onAccountAdded, provisioningProgress]);

  useConditionalPolling(
    checkDeploymentStatus,
    5000, // Poll less frequently since we have WebSocket
    provisioningStatus === "provisioning" && metaapiAccountId != null,
    { runOnMount: true }
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuggestedServers([]);

    if (
      !formData.account_alias ||
      !formData.mt_login ||
      !formData.mt_password ||
      !formData.mt_server
    ) {
      setError("Please fill in all required fields");
      return;
    }

    if (!/^\d+$/.test(formData.mt_login)) {
      setError("Account number must contain only digits");
      return;
    }

    setIsSubmitting(true);
    setProvisioningStatus("provisioning");
    setProvisioningMessage("Validating credentials...");
    setProvisioningProgress(5);

    try {
      const result = await postData("/mt-accounts", {
        account_alias: formData.account_alias,
        mt_login: formData.mt_login,
        mt_password: formData.mt_password,
        mt_server: formData.mt_server,
        mt_platform: formData.mt_platform,
        broker_keywords: formData.broker_keywords
          ? formData.broker_keywords.split(",").map((k) => k.trim())
          : [],
      });

      if (result) {
        if (result.success) {
          setNewAccountId(result.account?.id);
          setMetaapiAccountId(result.metaapi_account_id);

          if (result.provisioning_status === "DEPLOYED") {
            setProvisioningStatus("deployed");
            setProvisioningMessage("Account connected successfully!");
            setTimeout(() => {
              onOpenChange(false);
              onAccountAdded();
            }, 1500);
          } else {
            setProvisioningMessage(
              `Account created. Deploying... (${
                result.provisioning_status || "initializing"
              })`
            );
          }
        } else {
          setProvisioningStatus("error");
          setError(result.message || "Failed to create account");
          if (result.suggested_servers?.length > 0) {
            setSuggestedServers(result.suggested_servers);
          }
        }
      } else {
        setProvisioningStatus("error");
        setError("Failed to connect to the server");
      }
    } catch (e) {
      setProvisioningStatus("error");
      setError(e.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setProvisioningStatus("idle");
    setProvisioningMessage("");
    setProvisioningProgress(0);
    setError("");
    setNewAccountId(null);
    setMetaapiAccountId(null);
    hasReloadedRef.current = false;
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        account_alias: "",
        mt_login: "",
        mt_password: "",
        mt_server: "",
        mt_platform: "mt5",
        broker_keywords: "",
      });
      setError("");
      setSuggestedServers([]);
      setProvisioningStatus("idle");
      setProvisioningMessage("");
      setProvisioningProgress(0);
      setNewAccountId(null);
      setMetaapiAccountId(null);
      hasReloadedRef.current = false;
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add MetaTrader Account</DialogTitle>
          <DialogDescription>
            Connect an additional MT4 or MT5 trading account.
          </DialogDescription>
        </DialogHeader>

        {/* Provisioning status */}
        {(provisioningStatus === "provisioning" ||
          provisioningStatus === "deployed") && (
          <div
            className={cn(
              "p-5 rounded-md border text-center space-y-3",
              provisioningStatus === "deployed"
                ? "bg-emerald-500/[0.06] border-emerald-500/20"
                : "bg-blue-500/[0.06] border-blue-500/20"
            )}
          >
            {provisioningStatus === "deployed" ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            ) : (
              <Loader2 className="w-10 h-10 text-blue-400 mx-auto animate-spin" />
            )}
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {provisioningStatus === "deployed"
                  ? "Connected!"
                  : "Setting Up Your Account"}
              </h3>
              <p className="text-sm text-foreground-muted mt-1">
                {provisioningMessage}
              </p>
            </div>
            {/* Progress bar */}
            {provisioningStatus === "provisioning" && (
              <div className="w-full space-y-1.5">
                <Progress value={provisioningProgress} className="h-1.5" />
                <p className="text-[10px] text-foreground-muted/60">
                  {provisioningProgress}% complete
                </p>
              </div>
            )}
            {provisioningStatus === "provisioning" && (
              <p className="text-xs text-foreground-muted/70">
                This usually takes 30-60 seconds...
              </p>
            )}
          </div>
        )}

        {/* Error display */}
        {error && provisioningStatus !== "provisioning" && (
          <div className="flex items-start gap-2 p-4 rounded-md bg-rose-500/10 border border-rose-500/20">
            <AlertCircle
              size={14}
              className="mt-0.5 text-rose-400 flex-shrink-0"
            />
            <div className="space-y-2 flex-1">
              <p className="text-sm text-rose-400">{error}</p>
              {suggestedServers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground-muted">
                    Did you mean one of these servers?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedServers.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          updateField("mt_server", s);
                          setError("");
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

        {/* Form */}
        {provisioningStatus === "idle" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Security notice */}
            <div
              className={cn(
                "p-3 rounded-md",
                "bg-emerald-500/[0.06] border border-emerald-500/20"
              )}
            >
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-foreground-muted/70 leading-relaxed">
                  Your password is transmitted securely to MetaAPI and is never
                  stored on our servers.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground-muted block mb-1.5">
                  Account Name
                </label>
                <Input
                  value={formData.account_alias}
                  onChange={(e) => updateField("account_alias", e.target.value)}
                  placeholder="e.g., Scalping Account"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground-muted block mb-1.5">
                    Platform
                  </label>
                  <div className="flex gap-1">
                    {["mt4", "mt5"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => updateField("mt_platform", p)}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-none text-xs font-medium transition-all",
                          formData.mt_platform === p
                            ? "bg-foreground text-background"
                            : "bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08]"
                        )}
                      >
                        {p.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground-muted block mb-1.5">
                    Account Number
                  </label>
                  <Input
                    value={formData.mt_login}
                    onChange={(e) =>
                      updateField(
                        "mt_login",
                        e.target.value.replace(/\D/g, "")
                      )
                    }
                    placeholder="12345678"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground-muted block mb-1.5">
                  Password
                </label>
                <PasswordInput
                  value={formData.mt_password}
                  onChange={(e) => updateField("mt_password", e.target.value)}
                  placeholder="Your MT password"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground-muted block mb-1.5">
                  Server
                </label>
                <Input
                  value={formData.mt_server}
                  onChange={(e) => updateField("mt_server", e.target.value)}
                  placeholder="BrokerName-Live"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground-muted block mb-1.5">
                  Broker Name{" "}
                  <span className="text-foreground-muted/50">(optional)</span>
                </label>
                <Input
                  value={formData.broker_keywords}
                  onChange={(e) =>
                    updateField("broker_keywords", e.target.value)
                  }
                  placeholder="e.g., IC Markets"
                  className={inputClass}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !formData.account_alias ||
                  !formData.mt_login ||
                  !formData.mt_password ||
                  !formData.mt_server
                }
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <BarChart3 size={14} className="mr-2" />
                    Connect Account
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MTAccountsManager({ defaultExpanded = false }) {
  const { fetchData, postData, patchData, deleteData } = useApi();
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState({});
  const [showAddDialog, setShowAddDialog] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const result = await fetchData("/mt-accounts");
      if (result?.accounts) {
        setAccounts(result.accounts);
      }
    } catch (e) {
      console.error("Failed to load MT accounts:", e);
    } finally {
      setIsLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSetPrimary = async (accountId) => {
    try {
      await postData(`/mt-accounts/${accountId}/set-primary`);
      await loadAccounts();
    } catch (e) {
      console.error("Failed to set primary:", e);
    }
  };

  const handleToggleActive = async (account) => {
    try {
      await patchData(`/mt-accounts/${account.id}`, {
        is_active: !account.is_active,
      });
      await loadAccounts();
    } catch (e) {
      console.error("Failed to toggle active:", e);
    }
  };

  const handleDelete = async (accountId) => {
    try {
      await deleteData(`/mt-accounts/${accountId}`);
      await loadAccounts();
    } catch (e) {
      console.error("Failed to delete account:", e);
    }
  };

  const handleRefreshStatus = async (accountId) => {
    setIsRefreshing((prev) => ({ ...prev, [accountId]: true }));
    try {
      await fetchData(`/mt-accounts/${accountId}/status`);
      await loadAccounts();
    } catch (e) {
      console.error("Failed to refresh status:", e);
    } finally {
      setIsRefreshing((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-foreground-muted/70">
            {accounts.length === 0
              ? "No accounts connected yet"
              : `${accounts.length} account${accounts.length === 1 ? "" : "s"} connected`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="h-8 text-xs"
        >
          <Plus size={14} className="mr-1.5" />
          Add Account
        </Button>
      </div>

      {/* Account list */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onSetPrimary={handleSetPrimary}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              onRefreshStatus={handleRefreshStatus}
              isRefreshing={isRefreshing[account.id]}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {accounts.length === 0 && (
        <div className="text-center py-8 px-4 rounded-md bg-white/[0.02] border border-white/[0.06]">
          <BarChart3 className="w-10 h-10 text-foreground-muted/30 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-foreground mb-1">
            Connect Your Trading Account
          </h3>
          <p className="text-xs text-foreground-muted/70 mb-4">
            Add a MetaTrader account to start copying signals
          </p>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus size={14} className="mr-2" />
            Add Account
          </Button>
        </div>
      )}

      {/* Add account dialog */}
      <AddAccountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAccountAdded={loadAccounts}
      />
    </div>
  );
}

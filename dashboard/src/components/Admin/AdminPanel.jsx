import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  Activity,
  Radio,
  Search,
  Loader2,
  UserX,
  UserCheck,
  RefreshCw,
  Settings,
  Key,
  Save,
  Check,
  Eye,
  EyeOff,
  MessageSquare,
  Phone,
  Send,
  Shield,
  Unplug,
  CheckCircle2,
  AlertCircle,
  Lock,
} from "lucide-react";

function StatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground-muted uppercase tracking-wider">
              {title}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {trend && (
              <p
                className={`text-xs mt-1 ${
                  trend > 0 ? "text-success" : "text-destructive"
                }`}
              >
                {trend > 0 ? "+" : ""}
                {trend}% from yesterday
              </p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${className || "bg-primary/10"}`}>
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TelegramVerification({ onStatusChange }) {
  const { fetchData, postData } = useApi();
  const [status, setStatus] = useState("loading"); // loading, not_configured, pending_code, pending_password, connected
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Credentials for initial setup
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [showApiHash, setShowApiHash] = useState(false);

  // Verification
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const result = await fetchData("/admin/telegram/status");
    if (result) {
      setStatus(result.status);
      setMessage(result.message);
      if (onStatusChange) onStatusChange(result.status);
    }
  };

  const handleSendCode = async () => {
    if (!apiId || !apiHash || !phone) {
      setError("Please fill in all fields");
      return;
    }
    setIsLoading(true);
    setError("");

    const result = await postData("/admin/telegram/send-code", {
      api_id: apiId,
      api_hash: apiHash,
      phone: phone,
    });

    if (result) {
      setStatus(result.status);
      setMessage(result.message);
      if (onStatusChange) onStatusChange(result.status);
    } else {
      setError(
        "Failed to send verification code. Please check your credentials."
      );
    }
    setIsLoading(false);
  };

  const handleVerifyCode = async () => {
    if (!code) {
      setError("Please enter the verification code");
      return;
    }
    setIsLoading(true);
    setError("");

    const result = await postData("/admin/telegram/verify-code", { code });

    if (result) {
      setStatus(result.status);
      setMessage(result.message);
      if (onStatusChange) onStatusChange(result.status);
    } else {
      setError("Invalid code. Please try again.");
    }
    setIsLoading(false);
  };

  const handleVerifyPassword = async () => {
    if (!password) {
      setError("Please enter your 2FA password");
      return;
    }
    setIsLoading(true);
    setError("");

    const result = await postData("/admin/telegram/verify-password", {
      password,
    });

    if (result) {
      setStatus(result.status);
      setMessage(result.message);
      if (onStatusChange) onStatusChange(result.status);
    } else {
      setError("Invalid password. Please try again.");
    }
    setIsLoading(false);
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    const result = await postData("/admin/telegram/disconnect", {});
    if (result) {
      setStatus(result.status);
      setMessage(result.message);
      setApiId("");
      setApiHash("");
      setPhone("");
      setCode("");
      setPassword("");
      if (onStatusChange) onStatusChange(result.status);
    }
    setIsLoading(false);
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleReconnect = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await postData("/admin/telegram/reconnect");
      setMessage(result.message || "Reconnected successfully!");
    } catch (err) {
      setError(err.message || "Failed to reconnect");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "connected") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
          <CheckCircle2 className="w-5 h-5 text-success" />
          <div className="flex-1">
            <p className="text-sm font-medium text-success">
              Telegram Connected
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">{message}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReconnect}
              disabled={isLoading}
              className="text-primary hover:bg-primary/10"
              title="Reconnect Telegram listener"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isLoading}
              className="text-destructive hover:bg-destructive/10"
              title="Disconnect Telegram"
            >
              <Unplug className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "pending_password") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <Lock className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">2FA Required</p>
            <p className="text-xs text-foreground-muted mt-0.5">{message}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Telegram Password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your 2FA password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <Button
          onClick={handleVerifyPassword}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Shield className="w-4 h-4 mr-2" />
          )}
          Verify Password
        </Button>
      </div>
    );
  }

  if (status === "pending_code") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <MessageSquare className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Enter Verification Code
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">{message}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Verification Code
          </label>
          <Input
            placeholder="Enter the code from Telegram"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="bg-background/50 text-center text-lg tracking-widest"
            maxLength={6}
          />
        </div>

        <Button
          onClick={handleVerifyCode}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Verify Code
        </Button>
      </div>
    );
  }

  // not_configured - show setup form
  return (
    <div className="space-y-4">
      <p className="text-xs text-foreground-muted">
        Get your API ID and Hash from{" "}
        <a
          href="https://my.telegram.org/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          my.telegram.org/apps
        </a>
      </p>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">API ID</label>
          <Input
            value={apiId}
            onChange={(e) => setApiId(e.target.value)}
            placeholder="e.g., 12345678"
            className="bg-background/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            API Hash
          </label>
          <div className="relative">
            <Input
              type={showApiHash ? "text" : "password"}
              placeholder="Enter API hash"
              value={apiHash}
              onChange={(e) => setApiHash(e.target.value)}
              className="bg-background/50 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiHash(!showApiHash)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
            >
              {showApiHash ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Phone Number
        </label>
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-foreground-muted" />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1234567890"
            className="bg-background/50"
          />
        </div>
        <p className="text-xs text-foreground-muted">
          International format with country code
        </p>
      </div>

      <Button onClick={handleSendCode} disabled={isLoading} className="w-full">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Send className="w-4 h-4 mr-2" />
        )}
        Send Verification Code
      </Button>
    </div>
  );
}

function SystemConfig() {
  const { fetchData, putData } = useApi();
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showMetaApiToken, setShowMetaApiToken] = useState(false);
  const [showTelegramHash, setShowTelegramHash] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    const data = await fetchData("/admin/config");
    if (data) {
      setConfig(data);
      setFormData({
        // API Keys
        anthropic_api_key: "",
        llm_model: data.llm_model || "claude-haiku-4-5-20251001",
        metaapi_token: "",
        metaapi_account_id: data.metaapi_account_id || "",
        // Telegram
        telegram_api_id: data.telegram_api_id || "",
        telegram_api_hash: "",
        telegram_phone: data.telegram_phone || "",
        telegram_channel_ids: data.telegram_channel_ids || "",
        // Note: Trading settings (max_lot_size, symbol_suffix, etc.) are now in user Settings
      });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const updates = {};

    // API Keys (only include if user entered new values)
    if (formData.anthropic_api_key) {
      updates.anthropic_api_key = formData.anthropic_api_key;
    }
    if (formData.metaapi_token) {
      updates.metaapi_token = formData.metaapi_token;
    }
    if (formData.metaapi_account_id) {
      updates.metaapi_account_id = formData.metaapi_account_id;
    }

    // Telegram - always include these
    if (formData.telegram_api_id) {
      updates.telegram_api_id = formData.telegram_api_id;
    }
    if (formData.telegram_api_hash) {
      updates.telegram_api_hash = formData.telegram_api_hash;
    }
    if (formData.telegram_phone) {
      updates.telegram_phone = formData.telegram_phone;
    }
    // Always send channel_ids (even if empty string)
    updates.telegram_channel_ids = formData.telegram_channel_ids || "";

    // LLM model (admin-only setting)
    updates.llm_model = formData.llm_model;
    // Note: Trading settings (max_lot_size, symbol_suffix, etc.) are now saved via user Settings page

    console.log("Saving config updates:", updates);
    const result = await putData("/admin/config", updates);
    console.log("Save result:", result);
    if (result) {
      setConfig(result);
      setFormData((prev) => ({
        ...prev,
        anthropic_api_key: "",
        metaapi_token: "",
        telegram_api_hash: "",
      }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider flex items-center gap-2">
            <Key size={16} className="text-primary" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Anthropic API Key
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder={
                    config?.anthropic_api_key_set
                      ? "************"
                      : "Enter API key"
                  }
                  value={formData.anthropic_api_key}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      anthropic_api_key: e.target.value,
                    }))
                  }
                  className="bg-background/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {config?.anthropic_api_key_set && (
                <Badge
                  variant="outline"
                  className="text-success border-success/30 bg-success/10"
                >
                  <Check size={12} className="mr-1" /> Set
                </Badge>
              )}
            </div>
            {config?.anthropic_api_key_preview && (
              <p className="text-xs text-foreground-muted">
                Current: {config.anthropic_api_key_preview}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              MetaApi Token
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showMetaApiToken ? "text" : "password"}
                  placeholder={
                    config?.metaapi_token_set
                      ? "************"
                      : "Enter MetaApi token"
                  }
                  value={formData.metaapi_token}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      metaapi_token: e.target.value,
                    }))
                  }
                  className="bg-background/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowMetaApiToken(!showMetaApiToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                >
                  {showMetaApiToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {config?.metaapi_token_set && (
                <Badge
                  variant="outline"
                  className="text-success border-success/30 bg-success/10"
                >
                  <Check size={12} className="mr-1" /> Set
                </Badge>
              )}
            </div>
            {config?.metaapi_token_preview && (
              <p className="text-xs text-foreground-muted">
                Current: {config.metaapi_token_preview}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              MetaApi Account ID
            </label>
            <Input
              value={formData.metaapi_account_id}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  metaapi_account_id: e.target.value,
                }))
              }
              placeholder="Enter MetaApi account ID"
              className="bg-background/50"
            />
            {config?.metaapi_account_id && (
              <p className="text-xs text-foreground-muted">
                Current: {config.metaapi_account_id}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              LLM Model
            </label>
            <Input
              value={formData.llm_model}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, llm_model: e.target.value }))
              }
              placeholder="claude-haiku-4-5-20251001"
              className="bg-background/50"
            />
            <p className="text-xs text-foreground-muted">
              Claude model ID for signal parsing
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider flex items-center gap-2">
            <MessageSquare size={16} className="text-primary" />
            Telegram Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TelegramVerification />
        </CardContent>
      </Card>

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider flex items-center gap-2">
            <Radio size={16} className="text-primary" />
            Telegram Channels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Channel IDs
            </label>
            <Input
              value={formData.telegram_channel_ids}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  telegram_channel_ids: e.target.value,
                }))
              }
              placeholder="e.g., -1001234567890,-1009876543210"
              className="bg-background/50"
            />
            <p className="text-xs text-foreground-muted">
              Comma-separated Telegram channel IDs to monitor for signals
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Trading settings have been moved to Settings page */}
      <Card className="glass-card border-0">
        <CardContent className="p-4">
          <p className="text-sm text-foreground-muted">
            <span className="font-medium text-foreground">Note:</span> Trading
            settings (lot sizes, max trades, symbol suffix, etc.) are now
            configured in the <span className="text-primary">Settings</span>{" "}
            page for each user.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saveSuccess && (
          <span className="text-sm text-success flex items-center gap-1">
            <Check size={14} />
            Settings saved
          </span>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : (
            <Save size={14} className="mr-2" />
          )}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

function UserRow({ user, onSuspend, onActivate }) {
  const statusColors = {
    active: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    onboarding: "bg-primary/10 text-primary",
    suspended: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <span className="text-sm font-medium text-primary">
              {(user.full_name || user.email)?.[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {user.full_name || user.email.split("@")[0]}
          </p>
          <p className="text-xs text-foreground-muted">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          className={
            statusColors[user.status] || "bg-muted text-muted-foreground"
          }
        >
          {user.status}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {user.subscription_tier}
        </Badge>
        {user.status === "active" ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onSuspend(user.id)}
          >
            <UserX size={14} />
          </Button>
        ) : user.status === "suspended" ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-success hover:text-success hover:bg-success/10"
            onClick={() => onActivate(user.id)}
          >
            <UserCheck size={14} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { fetchData, postData } = useApi();

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [overviewData, usersData, activityData] = await Promise.all([
          fetchData("/admin/overview"),
          fetchData("/admin/users?page_size=10"),
          fetchData("/admin/activity?limit=10"),
        ]);

        if (overviewData) setOverview(overviewData);
        if (usersData) setUsers(usersData.users || []);
        if (activityData) setActivity(activityData || []);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, fetchData]);

  const handleSuspendUser = async (userId) => {
    const result = await postData(`/admin/users/${userId}/suspend`);
    if (result) {
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, status: "suspended" } : u))
      );
    }
  };

  const handleActivateUser = async (userId) => {
    const result = await postData(`/admin/users/${userId}/activate`);
    if (result) {
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, status: "active" } : u))
      );
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    const [overviewData, usersData] = await Promise.all([
      fetchData("/admin/overview"),
      fetchData("/admin/users?page_size=10"),
    ]);
    if (overviewData) setOverview(overviewData);
    if (usersData) setUsers(usersData.users || []);
    setIsLoading(false);
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-surface/50 border border-border/50">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-primary/10"
          >
            <Activity size={14} className="mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-primary/10"
          >
            <Users size={14} className="mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="data-[state=active]:bg-primary/10"
          >
            <Settings size={14} className="mr-2" />
            System Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                size={14}
                className={`mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {overview && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Users"
                value={overview.total_users}
                icon={Users}
              />
              <StatCard
                title="Active Users"
                value={overview.active_users}
                icon={UserCheck}
                className="bg-success/10"
              />
              <StatCard
                title="Signals Today"
                value={overview.total_signals_today}
                icon={Radio}
                className="bg-primary/10"
              />
              <StatCard
                title="Connected"
                value={overview.connected_users}
                icon={Activity}
                className="bg-accent-purple/10"
              />
            </div>
          )}

          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[340px]">
                <div className="space-y-3">
                  {activity.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-hover transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                        <Activity size={12} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{log.action}</p>
                        {log.user_email && (
                          <p className="text-xs text-foreground-muted">
                            {log.user_email}
                          </p>
                        )}
                        <p className="text-xs text-foreground-muted mt-1">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {activity.length === 0 && !isLoading && (
                    <p className="text-sm text-foreground-muted text-center py-8">
                      No activity logged yet
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                size={14}
                className={`mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
                All Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background/50"
                  />
                </div>
              </div>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1">
                  {users
                    .filter(
                      (u) =>
                        !searchQuery ||
                        u.email
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        u.full_name
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase())
                    )
                    .map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        onSuspend={handleSuspendUser}
                        onActivate={handleActivateUser}
                      />
                    ))}
                  {users.length === 0 && !isLoading && (
                    <p className="text-sm text-foreground-muted text-center py-8">
                      No users found
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <SystemConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}

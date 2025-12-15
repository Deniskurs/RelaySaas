import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ChevronDown,
  ChevronRight,
  Link,
  Wifi,
  WifiOff,
  MessageSquare,
  TrendingUp,
  StickyNote,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// Helper function to format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return "Never";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

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
          <div className={`p-3 rounded-none ${className || "bg-primary/10"}`}>
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
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

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    const data = await fetchData("/admin/config");
    if (data) {
      setConfig(data);
      setFormData({
        anthropic_api_key: "",
        llm_model: data.llm_model || "claude-haiku-4-5-20251001",
        metaapi_token: "",
        metaapi_account_id: data.metaapi_account_id || "",
      });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const updates = {};

    if (formData.anthropic_api_key) {
      updates.anthropic_api_key = formData.anthropic_api_key;
    }
    if (formData.metaapi_token) {
      updates.metaapi_token = formData.metaapi_token;
    }
    if (formData.metaapi_account_id) {
      updates.metaapi_account_id = formData.metaapi_account_id;
    }
    updates.llm_model = formData.llm_model;

    const result = await putData("/admin/config", updates);
    if (result) {
      setConfig(result);
      setFormData((prev) => ({
        ...prev,
        anthropic_api_key: "",
        metaapi_token: "",
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
        <CardContent className="p-4">
          <p className="text-sm text-foreground-muted">
            <span className="font-medium text-foreground">Note:</span> Telegram
            connection and channel settings have been moved to the{" "}
            <span className="text-primary">Settings</span> page.
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

function UserRow({ user, onSuspend, onActivate, onTierChange }) {
  const { fetchData, postData, putData } = useApi();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const statusColors = {
    active: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    onboarding: "bg-primary/10 text-primary",
    suspended: "bg-destructive/10 text-destructive",
  };

  const tierColors = {
    free: "text-foreground-muted",
    pro: "text-primary",
    premium: "text-accent-teal",
  };

  const handleExpand = async () => {
    if (!isExpanded && !userDetails) {
      // Fetch user details when expanding for the first time
      setIsLoadingDetails(true);
      const details = await fetchData(`/admin/users/${user.id}`);
      if (details) {
        setUserDetails(details);
        // Fetch admin notes separately
        const notesData = await fetchData(`/admin/users/${user.id}/notes`);
        setAdminNotes(notesData?.notes || "");
      }
      setIsLoadingDetails(false);
    }
    setIsExpanded(!isExpanded);
  };

  const handleForceDisconnect = async () => {
    setActionLoading('disconnect');
    const result = await postData(`/admin/users/${user.id}/disconnect`, {});
    if (result) {
      // Update local state
      if (userDetails) {
        setUserDetails({ ...userDetails, is_connected: false });
      }
    }
    setActionLoading(null);
  };

  const handleResetOnboarding = async () => {
    if (!confirm('Are you sure you want to reset onboarding for this user? They will need to complete setup again.')) {
      return;
    }
    setActionLoading('reset');
    const result = await postData(`/admin/users/${user.id}/reset-onboarding`, {});
    if (result) {
      alert('Onboarding has been reset. User status updated.');
      // Reload details
      const details = await fetchData(`/admin/users/${user.id}`);
      if (details) {
        setUserDetails(details);
      }
    }
    setActionLoading(null);
  };

  const handlePasswordReset = async () => {
    setActionLoading('password');
    const result = await postData(`/admin/users/${user.id}/password-reset`, {});
    if (result) {
      const resetLink = result.data?.reset_link;
      if (resetLink) {
        // Show the reset link in an alert
        alert(`Password reset link:\n\n${resetLink}\n\nThis link expires in 1 hour.`);
      } else {
        alert(result.message || 'Password reset email sent');
      }
    }
    setActionLoading(null);
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    const result = await putData(`/admin/users/${user.id}/notes`, { notes: adminNotes });
    if (result) {
      // Notes saved successfully
    }
    setIsSavingNotes(false);
  };

  return (
    <div className="border-b border-border/50 last:border-b-0">
      {/* Collapsed view - always visible */}
      <div
        className="flex items-center justify-between p-3 rounded-none hover:bg-surface-hover transition-colors cursor-pointer"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown size={16} className="text-foreground-muted" />
            ) : (
              <ChevronRight size={16} className="text-foreground-muted" />
            )}
          </div>
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
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Badge
            className={
              statusColors[user.status] || "bg-muted text-muted-foreground"
            }
          >
            {user.status}
          </Badge>
          <Select
            value={user.subscription_tier || "free"}
            onValueChange={(value) => onTierChange(user.id, value)}
          >
            <SelectTrigger className="w-24 h-7 text-xs bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free" className="text-xs">
                <span className={tierColors.free}>Free</span>
              </SelectItem>
              <SelectItem value="pro" className="text-xs">
                <span className={tierColors.pro}>Pro</span>
              </SelectItem>
              <SelectItem value="premium" className="text-xs">
                <span className={tierColors.premium}>Premium</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {user.status === "active" ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onSuspend(user.id);
              }}
            >
              <UserX size={14} />
            </Button>
          ) : user.status === "suspended" ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-success hover:text-success hover:bg-success/10"
              onClick={(e) => {
                e.stopPropagation();
                onActivate(user.id);
              }}
            >
              <UserCheck size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Expanded details panel */}
      {isExpanded && (
        <div className="bg-surface/30 p-4 border-t border-border/50">
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : userDetails ? (
            <div className="space-y-4">
              {/* Connection Status & Last Active */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  {userDetails.is_connected ? (
                    <Wifi className="w-4 h-4 text-success" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-destructive" />
                  )}
                  <div>
                    <p className="text-xs text-foreground-muted uppercase">Connection</p>
                    <p className={`text-sm font-medium ${userDetails.is_connected ? 'text-success' : 'text-destructive'}`}>
                      {userDetails.is_connected ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs text-foreground-muted uppercase">Last Active</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatRelativeTime(userDetails.profile?.last_seen_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs text-foreground-muted uppercase">Signals</p>
                    <p className="text-sm font-medium text-foreground">
                      {userDetails.signals_count || 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs text-foreground-muted uppercase">Trades</p>
                    <p className="text-sm font-medium text-foreground">
                      {userDetails.trades_count || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Telegram Channels */}
              {userDetails.telegram_channels && userDetails.telegram_channels.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <p className="text-xs text-foreground-muted uppercase">Telegram Channels</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {userDetails.telegram_channels.map((channel, idx) => (
                      <Badge key={idx} variant="outline" className="bg-primary/5 border-primary/20">
                        {channel}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* MT Account */}
              {(userDetails.mt_server || userDetails.mt_login) && (
                <div className="space-y-2">
                  <p className="text-xs text-foreground-muted uppercase">MT Account</p>
                  <div className="bg-background/50 p-3 rounded-none space-y-1">
                    {userDetails.mt_server && (
                      <p className="text-sm text-foreground">
                        <span className="text-foreground-muted">Server:</span> {userDetails.mt_server}
                      </p>
                    )}
                    {userDetails.mt_login && (
                      <p className="text-sm text-foreground">
                        <span className="text-foreground-muted">Login:</span> {userDetails.mt_login}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Stripe Customer Link */}
              {userDetails.stripe_customer_id && (
                <div className="space-y-2">
                  <p className="text-xs text-foreground-muted uppercase">Stripe</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(`https://dashboard.stripe.com/test/customers/${userDetails.stripe_customer_id}`, '_blank')}
                  >
                    <Link size={14} />
                    View Customer in Stripe
                  </Button>
                </div>
              )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-primary" />
                  <p className="text-xs text-foreground-muted uppercase">Admin Notes</p>
                </div>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this user..."
                  className="bg-background/50 min-h-[100px]"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes || adminNotes === (userDetails.admin_notes || "")}
                  >
                    {isSavingNotes ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <Save size={14} className="mr-2" />
                    )}
                    Save Notes
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-foreground-muted uppercase mb-3">Admin Actions</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleForceDisconnect}
                    disabled={actionLoading === 'disconnect'}
                  >
                    {actionLoading === 'disconnect' ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <WifiOff size={14} className="mr-2" />
                    )}
                    Force Disconnect
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="border-warning/50 text-warning hover:bg-warning/10"
                    onClick={handleResetOnboarding}
                    disabled={actionLoading === 'reset'}
                  >
                    {actionLoading === 'reset' ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <RefreshCw size={14} className="mr-2" />
                    )}
                    Reset Onboarding
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePasswordReset}
                    disabled={actionLoading === 'password'}
                  >
                    {actionLoading === 'password' ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <Mail size={14} className="mr-2" />
                    )}
                    Send Password Reset
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-foreground-muted">
              <AlertCircle size={16} className="mr-2" />
              Failed to load user details
            </div>
          )}
        </div>
      )}
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

  const handleTierChange = async (userId, newTier) => {
    const result = await postData(`/admin/users/${userId}/tier`, { tier: newTier });
    if (result) {
      setUsers(
        users.map((u) =>
          u.id === userId
            ? {
                ...u,
                subscription_tier: newTier,
                subscription_status: newTier !== "free" ? "active" : "inactive",
              }
            : u
        )
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
                className="bg-accent-teal/10"
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
                      className="flex items-start gap-3 p-2 rounded-none hover:bg-surface-hover transition-colors"
                    >
                      <div className="p-2 rounded-none bg-primary/10 mt-0.5">
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
                        onTierChange={handleTierChange}
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

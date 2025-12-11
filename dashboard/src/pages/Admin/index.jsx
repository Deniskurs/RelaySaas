import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Signal,
  TrendingUp,
  Search,
  ChevronRight,
  Loader2,
  Shield,
  UserX,
  UserCheck,
  RefreshCw,
  Settings,
  Key,
  Save,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

function StatCard({ title, value, icon: Icon, trend, className, index }) {
  return (
    <Card className="glass-card border-0 overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`p-3 rounded-xl ${
              className || "bg-primary/10"
            } group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon className="w-6 h-6 text-primary" />
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                trend > 0
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {trend > 0 ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingUp size={12} className="rotate-180" />
              )}
              {Math.abs(trend)}%
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-3xl font-bold text-foreground tracking-tight">
            {value}
          </h3>
          <p className="text-sm text-foreground-muted font-medium">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// System Configuration Component
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
        default_lot_size: data.default_lot_size || "0.01",
        max_lot_size: data.max_lot_size || "0.1",
        max_open_trades: data.max_open_trades || "5",
        max_risk_percent: data.max_risk_percent || "2.0",
        symbol_suffix: data.symbol_suffix || "",
        split_tps: data.split_tps === "true",
        tp_split_ratios: data.tp_split_ratios || "0.5,0.3,0.2",
        enable_breakeven: data.enable_breakeven === "true",
      });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    // Build update object, only including changed values
    const updates = {};

    // Only send API keys if they were changed (not empty)
    if (formData.anthropic_api_key) {
      updates.anthropic_api_key = formData.anthropic_api_key;
    }
    if (formData.metaapi_token) {
      updates.metaapi_token = formData.metaapi_token;
    }

    // Always send non-sensitive values
    updates.llm_model = formData.llm_model;
    updates.default_lot_size = formData.default_lot_size;
    updates.max_lot_size = formData.max_lot_size;
    updates.max_open_trades = formData.max_open_trades;
    updates.max_risk_percent = formData.max_risk_percent;
    updates.symbol_suffix = formData.symbol_suffix;
    updates.split_tps = formData.split_tps ? "true" : "false";
    updates.tp_split_ratios = formData.tp_split_ratios;
    updates.enable_breakeven = formData.enable_breakeven ? "true" : "false";

    const result = await putData("/admin/config", updates);
    if (result) {
      setConfig(result);
      // Clear API key fields after successful save
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
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-4 border-b border-border/40">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground-muted bg-clip-text text-transparent">
            System Configuration
          </h2>
          <p className="text-sm text-foreground-muted">
            Manage global settings and API connections
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-sm text-success font-medium flex items-center gap-1.5 animate-in slide-in-from-right-4 fade-in">
              <Check size={16} /> Saved Successfully
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-105"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : (
              <Save size={16} className="mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* API Credentials */}
        <Card className="glass-card md:col-span-2 overflow-hidden border-0">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Key size={20} className="text-primary" />
              </div>
              API Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Anthropic Key */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Anthropic API Key
                </label>
                <div className="relative group">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder={
                      config?.anthropic_api_key_set
                        ? "••••••••••••••••"
                        : "sk-ant-..."
                    }
                    value={formData.anthropic_api_key}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        anthropic_api_key: e.target.value,
                      }))
                    }
                    className="bg-background/40 border-primary/20 focus:border-primary/50 pr-10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-primary transition-colors"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {config?.anthropic_api_key_set && (
                  <div className="flex items-center gap-2 text-xs text-success">
                    <Shield size={12} /> Key securely stored
                  </div>
                )}
              </div>

              {/* MetaApi Token */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  MetaApi Token
                </label>
                <div className="relative group">
                  <Input
                    type={showMetaApiToken ? "text" : "password"}
                    placeholder={
                      config?.metaapi_token_set
                        ? "••••••••••••••••"
                        : "token-..."
                    }
                    value={formData.metaapi_token}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        metaapi_token: e.target.value,
                      }))
                    }
                    className="bg-background/40 border-primary/20 focus:border-primary/50 pr-10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMetaApiToken(!showMetaApiToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-primary transition-colors"
                  >
                    {showMetaApiToken ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
                {config?.metaapi_token_set && (
                  <div className="flex items-center gap-2 text-xs text-success">
                    <Shield size={12} /> Token securely stored
                  </div>
                )}
              </div>

              {/* LLM Model */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  LLM Model ID
                  <Badge variant="outline" className="text-[10px] h-5">
                    Advanced
                  </Badge>
                </label>
                <Input
                  value={formData.llm_model}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      llm_model: e.target.value,
                    }))
                  }
                  className="bg-background/40 border-white/5 font-mono text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Limits */}
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Shield size={20} className="text-destructive" />
              </div>
              Risk Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  Max Lot Size
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.max_lot_size}
                  onChange={(e) =>
                    setFormData({ ...formData, max_lot_size: e.target.value })
                  }
                  className="bg-background/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  Max Trades
                </label>
                <Input
                  type="number"
                  step="1"
                  value={formData.max_open_trades}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_open_trades: e.target.value,
                    })
                  }
                  className="bg-background/40"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  Max Risk % Per Trade
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.max_risk_percent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_risk_percent: e.target.value,
                      })
                    }
                    className="bg-background/40 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted text-sm">
                    %
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trade Execution */}
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="p-2 bg-success/10 rounded-lg">
                <Activity size={20} className="text-success" />
              </div>
              Execution Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-white/5">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-foreground">
                    Split Take Profits
                  </span>
                  <p className="text-xs text-foreground-muted">
                    Distribute across multiple TP levels
                  </p>
                </div>
                <Switch
                  checked={formData.split_tps}
                  onCheckedChange={(c) =>
                    setFormData({ ...formData, split_tps: c })
                  }
                />
              </div>

              {formData.split_tps && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-medium text-foreground-muted">
                    Split Ratios (comma separated)
                  </label>
                  <Input
                    value={formData.tp_split_ratios}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tp_split_ratios: e.target.value,
                      })
                    }
                    className="bg-background/40 font-mono text-sm"
                    placeholder="0.5, 0.3, 0.2"
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-white/5">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-foreground">
                    Auto-Breakeven
                  </span>
                  <p className="text-xs text-foreground-muted">
                    Move SL to entry after TP1
                  </p>
                </div>
                <Switch
                  checked={formData.enable_breakeven}
                  onCheckedChange={(c) =>
                    setFormData({ ...formData, enable_breakeven: c })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  Default Lot Size
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.default_lot_size}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_lot_size: e.target.value,
                    })
                  }
                  className="bg-background/40"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UserRow({ user, onSuspend, onActivate }) {
  const statusConfig = {
    active: {
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/20",
      icon: Check,
    },
    pending: {
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/20",
      icon: Loader2,
    },
    onboarding: {
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      icon: Activity,
    },
    suspended: {
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      icon: UserX,
    },
  };

  const config = statusConfig[user.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="group flex items-center justify-between p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/50 hover:border-primary/20 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full ring-2 ring-border/50 group-hover:ring-primary/20 transition-all overflow-hidden bg-surface flex items-center justify-center">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg font-semibold text-primary/80">
              {(user.full_name || user.email)?.[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            {user.full_name || user.email.split("@")[0]}
            {user.status === "active" && (
              <Shield size={12} className="text-primary" />
            )}
          </h4>
          <p className="text-sm text-foreground-muted">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Badge
          variant="outline"
          className={`${config.bg} ${config.color} ${config.border} flex items-center gap-1.5`}
        >
          <StatusIcon size={12} />
          <span className="capitalize">{user.status}</span>
        </Badge>

        <Badge variant="secondary" className="bg-surface font-mono text-xs">
          {user.subscription_tier}
        </Badge>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {user.status === "active" ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
              onClick={() => onSuspend(user.id)}
              title="Suspend User"
            >
              <UserX size={16} />
            </Button>
          ) : user.status === "suspended" ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-success hover:text-success hover:bg-success/10 rounded-lg"
              onClick={() => onActivate(user.id)}
              title="Activate User"
            >
              <UserCheck size={16} />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { fetchData, postData } = useApi();

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
    }
  }, [authLoading, isAdmin, navigate]);

  // Load data
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
    const [overviewData, usersData, activityData] = await Promise.all([
      fetchData("/admin/overview"),
      fetchData("/admin/users?page_size=10"),
      fetchData("/admin/activity?limit=10"),
    ]);
    if (overviewData) setOverview(overviewData);
    if (usersData) setUsers(usersData.users || []);
    if (activityData) setActivity(activityData || []);
    setIsLoading(false);
  };

  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent-purple shadow-lg shadow-primary/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm text-foreground-muted font-medium">
              System Overview & User Management
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6 h-full flex flex-col">
        <TabsList className="bg-surface/50 border border-white/5 p-1 h-12 w-fit rounded-xl self-start">
          <TabsTrigger
            value="overview"
            className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-sm px-6 h-10"
          >
            <Activity size={16} className="mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-sm px-6 h-10"
          >
            <Users size={16} className="mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-sm px-6 h-10"
          >
            <Settings size={16} className="mr-2" />
            System Config
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto pr-2 pb-12 custom-scrollbar">
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8 mt-0">
            {/* Stats */}
            <div className="flex items-center justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="border-white/5 hover:bg-white/5"
              >
                <RefreshCw
                  size={14}
                  className={`mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh Data
              </Button>
            </div>

            {overview && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Users"
                  value={overview.total_users}
                  icon={Users}
                  trend={12}
                  index={0}
                  className="bg-blue-500/10"
                />
                <StatCard
                  title="Active Users"
                  value={overview.active_users}
                  icon={UserCheck}
                  trend={5}
                  index={1}
                  className="bg-emerald-500/10"
                />
                <StatCard
                  title="Signals Today"
                  value={overview.total_signals_today}
                  icon={Signal}
                  trend={-2}
                  index={2}
                  className="bg-purple-500/10"
                />
                <StatCard
                  title="Connected"
                  value={overview.connected_users}
                  icon={Activity}
                  trend={8}
                  index={3}
                  className="bg-amber-500/10"
                />
              </div>
            )}

            {/* Activity Log */}
            <Card className="glass-card border-0 overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Activity size={18} className="text-primary" />
                    Recent Activity
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="divide-y divide-white/5">
                    {activity.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group"
                      >
                        <div className="p-2.5 rounded-xl bg-surface border border-white/10 group-hover:border-primary/30 transition-colors">
                          <Activity
                            size={16}
                            className="text-foreground-muted group-hover:text-primary transition-colors"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-foreground">
                              {log.action}
                            </p>
                            <span className="text-xs text-foreground-muted font-mono bg-surface px-2 py-0.5 rounded">
                              {new Date(log.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {log.user_email && (
                            <p className="text-xs text-foreground-muted flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                              {log.user_email}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {activity.length === 0 && !isLoading && (
                      <div className="flex flex-col items-center justify-center py-16 text-foreground-muted">
                        <div className="p-4 bg-surface rounded-full mb-3">
                          <Activity size={24} className="opacity-50" />
                        </div>
                        <p className="text-sm">No recent activity found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6 mt-0">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-surface/50 border-white/10 focus:bg-surface focus:border-primary/50 transition-all"
                />
              </div>
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
                Refresh List
              </Button>
            </div>

            <Card className="glass-card border-0 bg-transparent shadow-none">
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-18rem)]">
                  <div className="space-y-2 pb-8">
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
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4">
                          <Users
                            size={32}
                            className="text-foreground-muted opacity-50"
                          />
                        </div>
                        <p className="text-lg font-medium text-foreground">
                          No users found
                        </p>
                        <p className="text-sm text-foreground-muted">
                          Try adjusting your search terms
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Config Tab */}
          <TabsContent value="config" className="mt-0">
            <SystemConfig />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";

function StatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground-muted uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {trend && (
              <p className={`text-xs mt-1 ${trend > 0 ? "text-success" : "text-destructive"}`}>
                {trend > 0 ? "+" : ""}{trend}% from yesterday
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
            <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
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
        <Badge className={statusColors[user.status] || "bg-muted text-muted-foreground"}>
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
      setUsers(users.map(u => u.id === userId ? { ...u, status: "suspended" } : u));
    }
  };

  const handleActivateUser = async (userId) => {
    const result = await postData(`/admin/users/${userId}/activate`);
    if (result) {
      setUsers(users.map(u => u.id === userId ? { ...u, status: "active" } : u));
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

  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-foreground-muted">Manage users and monitor system</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw size={14} className={`mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
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
            icon={Signal}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
                Recent Users
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs">
                View All <ChevronRight size={12} className="ml-1" />
              </Button>
            </div>
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
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {users
                  .filter(u =>
                    !searchQuery ||
                    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(user => (
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

        {/* Activity Log */}
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider">
                Recent Activity
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs">
                View All <ChevronRight size={12} className="ml-1" />
              </Button>
            </div>
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
                        <p className="text-xs text-foreground-muted">{log.user_email}</p>
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
      </div>
    </div>
  );
}

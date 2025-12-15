import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isLoading, isAdmin, needsOnboarding } = useAuth();
  const location = useLocation();

  // Update splash progress when auth completes
  useEffect(() => {
    if (!isLoading) {
      window.__setSplashProgress?.(60); // Auth done = 60%
    }
  }, [isLoading]);

  // Show nothing while loading - splash screen handles it
  if (isLoading) {
    return null;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to onboarding if needed (unless already there)
  // Skip onboarding redirect for admin users - they can access dashboard directly
  if (needsOnboarding && !isAdmin && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

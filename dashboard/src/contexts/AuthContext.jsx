import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signInWithApple,
  signOut as supabaseSignOut,
  resetPassword as supabaseResetPassword,
  updatePassword as supabaseUpdatePassword,
  getProfile,
  updateProfile as supabaseUpdateProfile,
} from "@/lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch profile data
  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await getProfile(userId);
      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }
      return data;
    } catch (e) {
      console.error("Error fetching profile:", e);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        setProfile(profileData);
      }

      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        setProfile(profileData);
      } else {
        setProfile(null);
      }

      // Handle specific events
      if (event === "SIGNED_OUT") {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Sign in with email
  const login = async (email, password) => {
    setError(null);
    setIsLoading(true);
    try {
      const { data, error } = await signInWithEmail(email, password);
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up with email
  const register = async (email, password, fullName) => {
    setError(null);
    setIsLoading(true);
    try {
      const { data, error } = await signUpWithEmail(email, password, fullName);
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data, needsConfirmation: !data.session };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in with Google
  const loginWithGoogle = async () => {
    setError(null);
    const { data, error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  };

  // Sign in with Apple
  const loginWithApple = async () => {
    setError(null);
    const { data, error } = await signInWithApple();
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  };

  // Sign out
  const logout = async () => {
    setError(null);
    const { error } = await supabaseSignOut();
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    setUser(null);
    setProfile(null);
    setSession(null);
    return { success: true };
  };

  // Reset password
  const requestPasswordReset = async (email) => {
    setError(null);
    const { data, error } = await supabaseResetPassword(email);
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  };

  // Update password
  const updatePassword = async (newPassword) => {
    setError(null);
    const { data, error } = await supabaseUpdatePassword(newPassword);
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  };

  // Update profile
  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: "Not authenticated" };

    setError(null);
    const { data, error } = await supabaseUpdateProfile(user.id, updates);
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    setProfile(data);
    return { success: true, data };
  };

  // Refresh profile
  const refreshProfile = async () => {
    if (!user) return;
    const profileData = await fetchProfile(user.id);
    setProfile(profileData);
  };

  // Check if user is admin
  const isAdmin = profile?.role === "admin";

  // Check if user needs onboarding
  const needsOnboarding = profile?.status === "pending" || profile?.status === "onboarding";

  // Get onboarding step
  const onboardingStep = profile?.onboarding_step || "telegram";

  const value = {
    user,
    profile,
    session,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdmin,
    needsOnboarding,
    onboardingStep,
    login,
    register,
    loginWithGoogle,
    loginWithApple,
    logout,
    requestPasswordReset,
    updatePassword,
    updateProfile,
    refreshProfile,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

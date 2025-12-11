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

  // Fetch profile data with timeout
  const fetchProfile = useCallback(async (userId) => {
    try {
      console.log("Fetching profile for:", userId);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile fetch timeout")), 5000)
      );

      const fetchPromise = getProfile(userId);
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }
      console.log("Profile fetched:", data);
      return data;
    } catch (e) {
      console.error("Error fetching profile:", e);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initAuth = async () => {
      console.log("initAuth: Starting...");
      try {
        console.log("initAuth: Getting session...");
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log("initAuth: Session result:", { hasSession: !!session, error });

        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          console.log("initAuth: Setting session and user...");
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            console.log("initAuth: Fetching profile...");
            try {
              const profileData = await fetchProfile(session.user.id);
              console.log("initAuth: Profile result:", profileData);
              if (mounted) {
                setProfile(profileData);
              }
            } catch (profileError) {
              // Profile fetch failed but user is authenticated - continue without profile
              console.warn("initAuth: Profile fetch failed, continuing without profile:", profileError);
              if (mounted) {
                // Create a minimal profile from user metadata
                setProfile({
                  id: session.user.id,
                  email: session.user.email,
                  full_name: session.user.user_metadata?.full_name || null,
                  role: "user",  // Default role
                  status: "active",
                });
              }
            }
          }

          console.log("initAuth: Setting isLoading to false");
          setIsLoading(false);
        }
      } catch (e) {
        console.error("Error initializing auth:", e);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);

      if (!mounted) return;

      // Skip INITIAL_SESSION as we handle it in initAuth
      if (event === "INITIAL_SESSION") {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        if (mounted) {
          setProfile(profileData);
        }
      } else {
        setProfile(null);
      }

      // Handle specific events
      if (event === "SIGNED_OUT") {
        setProfile(null);
      }

      // Token refreshed - no action needed, session is already updated
      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      }

      // Ensure loading is false after auth state changes
      if (mounted) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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

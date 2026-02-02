import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

  // Ref to prevent concurrent profile fetches (race condition prevention)
  const fetchInProgressRef = useRef(false);

  // Fetch profile data with timeout (single attempt)
  const fetchProfile = useCallback(async (userId) => {
    try {
      // Add timeout to prevent hanging (15 seconds for slower connections/cold starts)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile fetch timeout")), 15000)
      );

      const fetchPromise = getProfile(userId);
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        console.warn("Profile fetch error (will retry):", error.message || error);
        return null;
      }
      return data;
    } catch (e) {
      // Log as warning since retries will handle it
      console.warn("Profile fetch failed (will retry):", e.message || e);
      return null;
    }
  }, []);

  // Fetch profile with retry logic and exponential backoff
  const fetchProfileWithRetry = useCallback(async (userId, maxRetries = 3) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const data = await fetchProfile(userId);
      if (data) return data;

      // Don't wait after the last failed attempt
      if (attempt < maxRetries - 1) {
        const delay = 1000 * (attempt + 1); // 1s, 2s, 3s delays
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    console.error("All profile fetch attempts failed - user may need to re-login");
    return null;
  }, [fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            try {
              // Use retry logic for initial profile fetch
              const profileData = await fetchProfileWithRetry(session.user.id);
              if (mounted) {
                setProfile(profileData);
              }
            } catch (profileError) {
              console.warn("Profile fetch failed during init:", profileError);
              if (mounted) {
                setProfile(null);
              }
            }
          }

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
      if (!mounted) return;

      // Skip INITIAL_SESSION as we handle it in initAuth
      if (event === "INITIAL_SESSION") {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      // Handle SIGNED_OUT - clear everything
      if (event === "SIGNED_OUT" || !session?.user) {
        setProfile(null);
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      // For other events (TOKEN_REFRESHED, SIGNED_IN, etc.) - fetch profile
      // but preserve existing profile if fetch fails
      if (session?.user) {
        // Prevent concurrent fetches (race condition prevention)
        if (fetchInProgressRef.current) {
          return;
        }

        fetchInProgressRef.current = true;
        try {
          const profileData = await fetchProfile(session.user.id);
          if (mounted) {
            // Only update profile if we got valid data - preserve existing otherwise
            if (profileData) {
              setProfile(profileData);
            } else {
              // Fetch failed - preserve existing profile (don't overwrite with null)
              setProfile(prev => prev || null);
            }
          }
        } finally {
          fetchInProgressRef.current = false;
        }
      }

      // Token refreshed - log for debugging
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
  }, [fetchProfile, fetchProfileWithRetry]);

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

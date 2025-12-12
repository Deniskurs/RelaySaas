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

// localStorage cache key for profile data
const PROFILE_CACHE_KEY = 'relay-profile-cache';

// Cache critical profile fields to localStorage
const cacheProfile = (profileData) => {
  if (profileData && typeof window !== 'undefined') {
    try {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        role: profileData.role,
        subscription_tier: profileData.subscription_tier,
        subscription_status: profileData.subscription_status,
        status: profileData.status,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn("Failed to cache profile:", e);
    }
  }
};

// Get cached profile data if less than 24 hours old
const getCachedProfile = () => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    // Only use cache if less than 24 hours old
    if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
      return data;
    }
  } catch (e) {
    console.warn("Failed to read profile cache:", e);
  }
  return null;
};

// Clear profile cache
const clearProfileCache = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    } catch (e) {
      console.warn("Failed to clear profile cache:", e);
    }
  }
};

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
      console.log("Fetching profile for:", userId);

      // Add timeout to prevent hanging (10 seconds for slower connections)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile fetch timeout")), 10000)
      );

      const fetchPromise = getProfile(userId);
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }
      console.log("Profile fetched:", data);

      // Cache successful profile fetch
      if (data) {
        cacheProfile(data);
      }

      return data;
    } catch (e) {
      console.error("Error fetching profile:", e);
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
        console.log(`Profile fetch attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    console.warn("All profile fetch attempts failed");
    return null;
  }, [fetchProfile]);

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
              // Use retry logic for initial profile fetch
              const profileData = await fetchProfileWithRetry(session.user.id);
              console.log("initAuth: Profile result:", profileData);
              if (mounted) {
                if (profileData) {
                  setProfile(profileData);
                } else {
                  // Profile fetch failed - try to use cached profile data
                  const cachedData = getCachedProfile();
                  if (cachedData) {
                    console.log("initAuth: Using cached profile data");
                    setProfile({
                      id: session.user.id,
                      email: session.user.email,
                      full_name: session.user.user_metadata?.full_name || null,
                      role: cachedData.role,
                      subscription_tier: cachedData.subscription_tier,
                      subscription_status: cachedData.subscription_status,
                      status: cachedData.status || "active",
                    });
                  } else {
                    // No cache available - set profile to null (UI will handle gracefully)
                    console.warn("initAuth: No cached profile available, profile will be null");
                    setProfile(null);
                  }
                }
              }
            } catch (profileError) {
              // Profile fetch failed but user is authenticated
              console.warn("initAuth: Profile fetch failed:", profileError);
              if (mounted) {
                // Try to use cached profile data
                const cachedData = getCachedProfile();
                if (cachedData) {
                  console.log("initAuth: Using cached profile data after error");
                  setProfile({
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || null,
                    role: cachedData.role,
                    subscription_tier: cachedData.subscription_tier,
                    subscription_status: cachedData.subscription_status,
                    status: cachedData.status || "active",
                  });
                } else {
                  // No cache - leave profile null
                  setProfile(null);
                }
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

      // Handle SIGNED_OUT - clear everything including cache
      if (event === "SIGNED_OUT" || !session?.user) {
        setProfile(null);
        clearProfileCache();
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
          console.log("Auth state change: Profile fetch already in progress, skipping");
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
              console.log("Auth state change: Profile fetch failed, preserving existing profile");
              // If we have no existing profile, try cache
              setProfile(prev => {
                if (prev) return prev; // Keep existing profile
                // No existing profile - try cache
                const cachedData = getCachedProfile();
                if (cachedData) {
                  console.log("Auth state change: Using cached profile");
                  return {
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || null,
                    role: cachedData.role,
                    subscription_tier: cachedData.subscription_tier,
                    subscription_status: cachedData.subscription_status,
                    status: cachedData.status || "active",
                  };
                }
                return null;
              });
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
    // Clear profile cache on logout
    clearProfileCache();
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

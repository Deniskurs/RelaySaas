import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase environment variables. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: "signalcopier-auth",  // Use consistent storage key
    storage: window.localStorage,      // Explicitly use localStorage
  },
});

// Auth helper functions
export const signInWithEmail = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signUpWithEmail = async (email, password, fullName) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  return { data, error };
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
};

export const signInWithApple = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const resetPassword = async (email) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  return { data, error };
};

export const updatePassword = async (newPassword) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
};

// Profile helpers
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();  // Use maybeSingle to not error if no profile exists

  // If no profile found, return null data without error
  if (!data && !error) {
    return { data: null, error: null };
  }
  return { data, error };
};

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  return { data, error };
};

// User settings helpers
export const getUserSettings = async (userId) => {
  const { data, error } = await supabase
    .from("user_settings_v2")
    .select("*")
    .eq("user_id", userId)
    .single();
  return { data, error };
};

export const updateUserSettings = async (userId, updates) => {
  const { data, error } = await supabase
    .from("user_settings_v2")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();
  return { data, error };
};

// User credentials helpers
export const getUserCredentials = async (userId) => {
  const { data, error } = await supabase
    .from("user_credentials")
    .select("*")
    .eq("user_id", userId)
    .single();
  return { data, error };
};

export const updateUserCredentials = async (userId, updates) => {
  const { data, error } = await supabase
    .from("user_credentials")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();
  return { data, error };
};

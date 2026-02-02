import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const API_BASE = "/api";

async function getAuthHeaders() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      return {
        Authorization: `Bearer ${session.access_token}`,
      };
    }
  } catch (e) {
    console.error("Error getting auth session:", e);
  }
  return {};
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (endpoint) => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          ...authHeaders,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "API request failed");
      }
      return await response.json();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const postData = useCallback(async (endpoint, data = {}) => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "API request failed");
      }
      return await response.json();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const putData = useCallback(async (endpoint, data = {}) => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "API request failed");
      }
      return await response.json();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const patchData = useCallback(async (endpoint, data = {}) => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "API request failed");
      }
      return await response.json();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteData = useCallback(async (endpoint) => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "DELETE",
        headers: {
          ...authHeaders,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "API request failed");
      }
      return await response.json();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchData, postData, putData, patchData, deleteData, loading, error };
}

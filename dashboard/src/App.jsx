import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { UnsavedChangesProvider } from "./contexts/UnsavedChangesContext";
import { ToastProvider } from "./components/ui/toast";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

// Lazy-loaded pages for code splitting
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AdminDashboard = lazy(() => import("./pages/Admin"));
const Checkout = lazy(() => import("./pages/Checkout"));

// Loading fallback - invisible since static splash handles it
function PageLoader() {
  // Return null - static splash in index.html handles the visual
  return null;
}

// Component to hide splash once mounted inside Suspense
function HideSplashOnReady() {
  useEffect(() => {
    // Small delay for smoother transition
    const timer = setTimeout(() => {
      window.__hideSplash?.();
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <SettingsProvider>
          <UnsavedChangesProvider>
            <ToastProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/checkout" element={<Checkout />} />

                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <Onboarding />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch all - redirect to dashboard */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ToastProvider>
          </UnsavedChangesProvider>
        </SettingsProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}

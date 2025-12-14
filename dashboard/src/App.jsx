import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { UnsavedChangesProvider } from "./contexts/UnsavedChangesContext";
import { ToastProvider } from "./components/ui/toast";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import AdminDashboard from "./pages/Admin";
import Checkout from "./pages/Checkout";

export default function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <SettingsProvider>
          <UnsavedChangesProvider>
            <ToastProvider>
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
            </ToastProvider>
          </UnsavedChangesProvider>
        </SettingsProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}

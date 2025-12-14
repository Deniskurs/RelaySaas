import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Logo, BrandName } from "@/components/Brand/Brand";
import loginVisual from "@/assets/login-visual.png";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    loginWithGoogle,
    loginWithApple,
    error,
    clearError,
    isLoading,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    clearError();

    if (!email || !password) {
      setLocalError("Please enter both email and password");
      return;
    }

    const { success, error } = await login(email, password);
    if (success) {
      navigate(from, { replace: true });
    } else {
      setLocalError(error || "Login failed");
    }
  };

  const handleGoogleLogin = async () => {
    await loginWithGoogle();
  };

  const handleAppleLogin = async () => {
    await loginWithApple();
  };

  const displayError = localError || error;

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="min-h-screen w-full flex bg-background overflow-hidden">
      {/* Left Panel - Visual & Branding (Magic Edition) */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black p-12 flex-col justify-between"
      >
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
          <motion.img
            src={loginVisual}
            alt="Signal Copier Success"
            className="w-full h-full object-cover opacity-80"
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

          {/* Subtle Magic Particles Overlay */}
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent-teal/20 rounded-full blur-[100px] animate-pulse-soft" />
            <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-accent-gold/10 rounded-full blur-[120px] animate-pulse-urgent" />
          </div>
        </div>

        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 flex items-center gap-3"
        >
          <Logo size={42} />
          <BrandName className="scale-110 origin-left" />
        </motion.div>

        {/* Hero Text */}
        <div className="relative z-10 max-w-xl space-y-6">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 96 }} // 24 * 4 = 96px
            transition={{ delay: 0.8, duration: 0.8 }}
            className="h-px bg-accent-teal mb-6"
          />
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8, ease: "easeOut" }}
            className="text-5xl md:text-6xl font-serif text-white leading-tight"
          >
            Get <br />
            Everything <br />
            You Want
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.8 }}
            className="text-gray-300 text-lg max-w-md font-light"
          >
            You can get everything you want if you work hard, trust the process,
            and stick to the plan.
          </motion.p>
        </div>
      </motion.div>

      {/* Right Panel - Login Form (Magic Edition) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 relative">
        {/* Magic Aurora Background for Form Side */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-accent-teal/5 rounded-full blur-[120px] opacity-40 mix-blend-screen" />
          <div className="absolute bottom-[10%] left-[10%] w-[500px] h-[500px] bg-accent-gold/5 rounded-full blur-[100px] opacity-30 mix-blend-screen" />
        </div>

        <motion.div
          className="w-full max-w-[440px] space-y-8 relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={itemVariants}
            className="space-y-2 text-center lg:text-left"
          >
            <div className="lg:hidden flex justify-center mb-6">
              <Logo size={48} />
            </div>
            <h2 className="text-3xl font-serif text-foreground">
              Welcome Back
            </h2>
            <p className="text-foreground-muted">
              Enter your email and password to access your account
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-6">
            <AnimatePresence mode="wait">
              {displayError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="flex items-center gap-2 p-4 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                >
                  <AlertCircle size={16} />
                  {displayError}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Email
                </label>
                <div className="relative group">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-surface/50 border-input focus-visible:ring-accent-teal rounded-none px-4 transition-all duration-300 group-hover:bg-surface/80"
                    disabled={isLoading}
                  />
                  {/* Glow effect on hover/focus */}
                  <div className="absolute inset-0 rounded-none ring-1 ring-accent-teal/0 group-hover:ring-accent-teal/20 pointer-events-none transition-all duration-300" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative group">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-surface/50 border-input focus-visible:ring-accent-teal rounded-none px-4 pr-10 transition-all duration-300 group-hover:bg-surface/80"
                    disabled={isLoading}
                  />
                  {/* Glow effect on hover/focus */}
                  <div className="absolute inset-0 rounded-none ring-1 ring-accent-teal/0 group-hover:ring-accent-teal/20 pointer-events-none transition-all duration-300" />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-foreground-muted cursor-pointer select-none"></label>
                </div>
                <Link
                  to="/forgot-password"
                  className="text-sm text-foreground-muted hover:text-accent-teal transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium rounded-none bg-black hover:bg-black/80 text-white border border-border relative overflow-hidden group"
                disabled={isLoading}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                Sign In
              </Button>
            </form>

            {/* Social Auth */}
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full h-12 gap-3 rounded-none border-border bg-surface/30 hover:bg-surface/50 text-foreground transition-all duration-300"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign In with Google
              </Button>
            </div>

            <div className="pt-4 text-center">
              <span className="text-foreground-muted">
                Don't have an account?{" "}
              </span>
              <Link
                to="/register"
                className="text-foreground font-medium hover:text-accent-teal transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

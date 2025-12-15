import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { Logo, BrandName } from "@/components/Brand/Brand";
import { SplashIntro } from "@/components/Brand/SplashIntro";
import { useLoginSplash } from "@/hooks/useLoginSplash";
import loginVisual from "@/assets/login-visual.png";

// Apple-style easing for premium animations
const appleEase = [0.16, 1, 0.3, 1];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const {
    login,
    loginWithGoogle,
    loginWithApple,
    error,
    clearError,
    isLoading,
  } = useAuth();

  const { showSplash, splashPhase, skipSplash } = useLoginSplash();

  // Hide static HTML splash - Login has its own SplashIntro
  useEffect(() => {
    window.__hideSplash?.();
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);

  const from = location.state?.from?.pathname || "/";

  // Auto-focus email input after splash
  useEffect(() => {
    if (!showSplash && emailInputRef.current) {
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 600); // Wait for form animation
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

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
      setLoginSuccess(true);
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1200);
    } else {
      setLocalError(error || "Login failed");
    }
  };

  const handleGoogleLogin = async () => {
    await loginWithGoogle();
  };

  const handleEmailKeyDown = (e) => {
    if (e.key === "Enter" && email) {
      e.preventDefault();
      passwordInputRef.current?.focus();
    }
  };

  const displayError = localError || error;

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 10, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4, ease: appleEase },
    },
  };

  return (
    <>
      {/* Splash Intro - All Screen Sizes */}
      <SplashIntro
        showSplash={showSplash}
        splashPhase={splashPhase}
        onSkip={skipSplash}
      />

      {/* Main Login Content */}
      <AnimatePresence>
        {!showSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: appleEase }}
            className="min-h-screen w-full flex bg-background overflow-hidden"
          >
            {/* Left Panel - Visual & Branding (Desktop Only) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: appleEase, delay: 0.2 }}
              className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black p-12 flex-col justify-between"
            >
              {/* Background Layer */}
              <div className="absolute inset-0 z-0">
                <motion.img
                  src={loginVisual}
                  alt="Relay Signal Infrastructure"
                  className="w-full h-full object-cover opacity-70"
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 1.5, ease: appleEase }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />

                {/* Subtle texture overlay */}
                <div
                  className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }}
                />

                {/* Aurora effects */}
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent-teal/20 rounded-full blur-[100px] animate-pulse-soft" />
                  <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-accent-gold/10 rounded-full blur-[120px] animate-pulse-urgent" />
                </div>
              </div>

              {/* Brand Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, ease: appleEase }}
                className="relative z-10 flex items-center gap-3"
              >
                <Logo size={42} />
                <BrandName className="scale-110 origin-left" />
              </motion.div>

              {/* Hero Text */}
              <div className="relative z-10 max-w-xl space-y-8">
                {/* Signal line - sharper */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 1.2, ease: appleEase }}
                  className="h-[2px] w-24 bg-accent-teal origin-left"
                />

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.8, ease: appleEase }}
                  className="text-5xl md:text-6xl lg:text-7xl font-serif font-light text-white leading-[1.1] tracking-tight"
                >
                  Get <br />
                  Everything <br />
                  You Want
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.4, duration: 0.8 }}
                  className="text-foreground-muted text-base md:text-lg max-w-md font-light leading-relaxed"
                >
                  You can get everything you want if you work hard, trust the
                  process, and stick to the plan.
                </motion.p>

                {/* Trust metrics */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.0, duration: 1 }}
                  className="flex items-center gap-8 pt-6 border-t border-white/5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
                    <span className="text-foreground-subtle font-mono text-xs tracking-wider">
                      Live Infrastructure
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-gold" />
                    <span className="text-foreground-subtle font-mono text-xs tracking-wider">
                      Institutional Grade
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Glass divider between panels */}
            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-[1px] z-50">
              <div className="w-full h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-16 relative">
              {/* Mobile Background Adaptation */}
              <div className="lg:hidden absolute inset-0 pointer-events-none overflow-hidden">
                {/* Darkened brand image - top quarter */}
                <div className="absolute top-0 left-0 right-0 h-1/4 opacity-15">
                  <img
                    src={loginVisual}
                    className="w-full h-full object-cover"
                    style={{
                      maskImage:
                        "linear-gradient(to bottom, black 0%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to bottom, black 0%, transparent 100%)",
                    }}
                    alt=""
                  />
                </div>

                {/* Repositioned aurora */}
                <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-accent-teal/8 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-0 w-[250px] h-[250px] bg-accent-gold/6 rounded-full blur-[100px]" />

                {/* Subtle grid pattern */}
                <div
                  className="absolute inset-0 opacity-[0.02]"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: "60px 60px",
                  }}
                />
              </div>

              {/* Floating logo - mobile only */}
              <div className="lg:hidden absolute top-6 left-6 z-10">
                <Logo size={32} />
              </div>

              {/* Success overlay */}
              <AnimatePresence>
                {loginSuccess && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center z-50"
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, ease: appleEase }}
                    >
                      <CheckCircle2 className="w-12 h-12 text-accent-teal mb-4" />
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-lg font-serif"
                    >
                      Welcome back
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-sm text-foreground-muted mt-2 font-mono"
                    >
                      Loading your signals...
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form Container with Glass Treatment */}
              <motion.div
                className="w-full max-w-[440px] space-y-8 relative z-10 glass-form-panel p-8 sm:p-10"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div
                  variants={itemVariants}
                  className="space-y-2 text-center lg:text-left"
                >
                  <div className="lg:hidden flex justify-center mb-6">
                    {/* Empty - logo now floats in corner */}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-serif text-foreground">
                    Welcome Back
                  </h2>
                  <p className="text-foreground-muted text-sm sm:text-base">
                    Enter your credentials to access your account
                  </p>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-6">
                  <AnimatePresence mode="wait">
                    {displayError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -4 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -4 }}
                        transition={{ duration: 0.3, ease: appleEase }}
                        className="flex items-start gap-3 p-4 rounded-none bg-destructive/5 border-l-4 border-l-destructive border-r border-t border-b border-destructive/10 text-destructive/90 text-sm"
                      >
                        <AlertCircle
                          size={16}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <span>{displayError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground-subtle uppercase tracking-wider flex items-center gap-2">
                        Email
                        <span className="w-1 h-1 rounded-full bg-accent-teal/40" />
                      </label>
                      <div className="relative group">
                        <Input
                          ref={emailInputRef}
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={handleEmailKeyDown}
                          className="h-12 input-signal rounded-none px-4 text-foreground placeholder:text-foreground-subtle/40"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground-subtle uppercase tracking-wider flex items-center gap-2">
                        Password
                        <span className="w-1 h-1 rounded-full bg-accent-teal/40" />
                      </label>
                      <div className="relative group">
                        <Input
                          ref={passwordInputRef}
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-12 input-signal rounded-none px-4 pr-12 text-foreground placeholder:text-foreground-subtle/40"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle/60 hover:text-foreground-subtle transition-colors duration-150 w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-sm"
                        >
                          {showPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <Link
                        to="/forgot-password"
                        className="text-xs text-foreground-muted hover:text-accent-teal transition-colors tracking-wide"
                      >
                        Forgot Password?
                      </Link>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-medium rounded-none btn-tesla relative overflow-hidden group"
                      disabled={isLoading}
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : null}
                      Sign In
                    </Button>

                    {/* Loading state message */}
                    <AnimatePresence>
                      {isLoading && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-center text-xs text-foreground-subtle font-mono"
                        >
                          Establishing secure connection...
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </form>

                  {/* Social Auth */}
                  <div className="space-y-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/6" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card/40 px-3 text-foreground-subtle">
                          or
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full h-12 gap-3 rounded-none bg-black/15 border border-white/8 hover:bg-black/20 hover:border-white/12 text-foreground transition-all duration-200 active:scale-[0.98]"
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
                    <span className="text-foreground-muted text-sm">
                      Don't have an account?{" "}
                    </span>
                    <Link
                      to="/register"
                      className="text-foreground font-medium hover:text-accent-teal transition-colors text-sm"
                    >
                      Sign Up
                    </Link>
                  </div>

                  {/* Trust indicators */}
                  <motion.div
                    variants={itemVariants}
                    className="mt-8 pt-6 border-t border-white/5"
                  >
                    <div className="flex items-center justify-center gap-6 text-[10px] text-foreground-subtle/60">
                      <div className="flex items-center gap-1.5">
                        <Shield size={12} />
                        <span>256-bit Encryption</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-teal/60" />
                        <span className="font-mono">99.9% Uptime</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={12} />
                        <span>SOC 2</span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

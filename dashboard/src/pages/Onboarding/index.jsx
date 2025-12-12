import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, MessageSquare, BarChart3, Settings, Check, ChevronRight, Loader2 } from "lucide-react";
import TelegramStep from "./TelegramStep";
import MetaTraderStep from "./MetaTraderStep";
import SettingsStep from "./SettingsStep";

const STEPS = [
  { id: "telegram", label: "Telegram", icon: MessageSquare, description: "Connect your Telegram account" },
  { id: "metatrader", label: "MetaTrader", icon: BarChart3, description: "Link your trading account" },
  { id: "settings", label: "Settings", icon: Settings, description: "Configure trading parameters" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, updateProfile, refreshProfile, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  // Determine initial step from profile
  useEffect(() => {
    if (profile?.onboarding_step) {
      const stepIndex = STEPS.findIndex(s => s.id === profile.onboarding_step);
      if (stepIndex !== -1) {
        setCurrentStep(stepIndex);
      }
    }
    // If profile status is active, redirect to dashboard
    if (profile?.status === "active") {
      navigate("/");
    }
  }, [profile, navigate]);

  const handleStepComplete = async (stepId) => {
    const nextStepIndex = currentStep + 1;

    if (nextStepIndex < STEPS.length) {
      // Move to next step
      await updateProfile({
        onboarding_step: STEPS[nextStepIndex].id,
        status: "onboarding",
      });
      setCurrentStep(nextStepIndex);
    } else {
      // Complete onboarding
      setIsCompleting(true);
      await updateProfile({
        onboarding_step: "complete",
        status: "active",
      });
      await refreshProfile();
      navigate("/");
    }
  };

  const handleSkipStep = async () => {
    await handleStepComplete(STEPS[currentStep].id);
  };

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case "telegram":
        return <TelegramStep onComplete={() => handleStepComplete("telegram")} onSkip={handleSkipStep} />;
      case "metatrader":
        return <MetaTraderStep onComplete={() => handleStepComplete("metatrader")} onSkip={handleSkipStep} />;
      case "settings":
        return <SettingsStep onComplete={() => handleStepComplete("settings")} />;
      default:
        return null;
    }
  };

  if (authLoading || isCompleting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-none bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to Relay</h1>
          <p className="text-sm text-foreground-muted">
            Let's get your account set up in just a few steps
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isComplete
                        ? "bg-success/10 text-success"
                        : "bg-background-raised text-foreground-muted"
                    }`}
                  >
                    {isComplete ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className="w-4 h-4 mx-1 text-foreground-muted" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="glass-card border-0">
          <CardContent className="p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {STEPS[currentStep].description}
              </h2>
              <p className="text-sm text-foreground-muted mt-1">
                Step {currentStep + 1} of {STEPS.length}
              </p>
            </div>
            {renderStep()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

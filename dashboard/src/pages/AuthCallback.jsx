import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the auth code from the URL
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          navigate("/login?error=callback_failed");
          return;
        }

        if (data.session) {
          // Check if user needs onboarding
          const { data: profile } = await supabase
            .from("profiles")
            .select("status, onboarding_step")
            .eq("id", data.session.user.id)
            .single();

          if (profile?.status === "pending" || profile?.status === "onboarding") {
            navigate("/onboarding");
          } else {
            navigate("/");
          }
        } else {
          navigate("/login");
        }
      } catch (e) {
        console.error("Auth callback error:", e);
        navigate("/login?error=unexpected");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-foreground-muted">Completing sign in...</p>
      </div>
    </div>
  );
}

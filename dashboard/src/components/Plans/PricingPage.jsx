import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Check,
  X,
  ChevronDown,
  Zap,
  HelpCircle,
} from "lucide-react";
import { PricingCards, BillingToggle, PLANS } from "./PricingCards";

// Feature comparison data
const COMPARISON_FEATURES = {
  "Signal Management": [
    {
      name: "Daily Signals",
      free: "5/day",
      pro: "Unlimited",
      premium: "Unlimited",
    },
    {
      name: "Signal History",
      free: "7 days",
      pro: "30 days",
      premium: "1 year",
    },
    { name: "Early Access", free: false, pro: "5 min", premium: "10 min" },
    { name: "Advanced Filters", free: false, pro: true, premium: true },
    { name: "Signal Analytics", free: false, pro: "Basic", premium: "Full" },
  ],
  "Account Management": [
    { name: "MT5 Accounts", free: "1", pro: "3", premium: "10" },
    { name: "Telegram Channels", free: "2", pro: "5", premium: "Unlimited" },
    { name: "Concurrent Copiers", free: "1", pro: "3", premium: "10" },
  ],
  "Automation & Integration": [
    { name: "Auto-copy Signals", free: true, pro: true, premium: true },
    {
      name: "Risk Management",
      free: "Basic",
      pro: "Advanced",
      premium: "Advanced",
    },
    { name: "Custom Lot Sizing", free: false, pro: true, premium: true },
    { name: "API Access", free: false, pro: false, premium: true },
    { name: "Custom Webhooks", free: false, pro: false, premium: true },
  ],
  Support: [
    { name: "Response Time", free: "24-48h", pro: "4-8h", premium: "1-2h" },
    {
      name: "Support Channels",
      free: "Email",
      pro: "Email + Chat",
      premium: "Email + Chat + Phone",
    },
    { name: "Onboarding Call", free: false, pro: false, premium: true },
  ],
};

// FAQ data
const FAQ_ITEMS = [
  {
    question: "Can I switch plans anytime?",
    answer:
      "Yes! You can upgrade instantly or downgrade at the end of your current billing cycle. Changes take effect immediately for upgrades, with prorated billing.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, Amex) via Stripe. For annual plans, we also accept cryptocurrency payments.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes, we offer a 14-day money-back guarantee on all paid plans. If you're not satisfied, contact us for a full refund, no questions asked.",
  },
  {
    question: "What happens if I downgrade?",
    answer:
      "Your Pro/Premium features remain active until the end of your billing period. After that, limits apply and extra accounts will be disconnected (we'll notify you first).",
  },
  {
    question: "Can I try Pro before buying?",
    answer:
      "After 7 days of active use on the Free plan, you'll receive a free 24-hour Pro Day to experience all features. You can also request an extended trial by contacting support.",
  },
  {
    question: "Do prices include taxes?",
    answer:
      "Prices shown exclude VAT/sales tax. Applicable taxes will be calculated at checkout based on your location.",
  },
];

// Render cell value
function FeatureValue({ value }) {
  if (value === true) {
    return <Check size={16} className="text-[hsl(var(--accent-teal))]" />;
  }
  if (value === false) {
    return <X size={16} className="text-foreground-muted/30" />;
  }
  if (value === "Unlimited") {
    return (
      <span className="text-[hsl(var(--accent-teal))] font-medium">
        {value}
      </span>
    );
  }
  return <span className="text-foreground-muted">{value}</span>;
}

// Comparison table component
function ComparisonTable({ className }) {
  const [expandedSections, setExpandedSections] = useState(
    Object.keys(COMPARISON_FEATURES)
  );

  const toggleSection = (section) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      <div className="text-center mb-10">
        <h3 className="text-2xl font-semibold text-foreground mb-2">
          Compare Features
        </h3>
        <p className="text-sm text-foreground-muted/70">
          What's included in each plan
        </p>
      </div>

      {/* Mobile scroll wrapper */}
      <div className="overflow-x-auto lg:overflow-visible pb-4 -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="min-w-[600px] lg:min-w-0 bg-white/[0.015] border border-white/[0.06] overflow-hidden">
          {/* Table header */}
          <div className="bg-white/[0.02] border-b border-white/[0.06] py-4 px-5">
            <div className="grid grid-cols-4 gap-4 items-center">
              <div className="text-xs font-medium uppercase tracking-wider text-foreground-muted/60">
                Feature
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-foreground-muted">Free</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-[hsl(var(--accent-teal))]">Pro</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-[hsl(var(--accent-gold))]">Premium</div>
              </div>
            </div>
          </div>

          {/* Feature sections */}
          <div className="divide-y divide-white/[0.04]">
            {Object.entries(COMPARISON_FEATURES).map(([section, features]) => (
              <div key={section}>
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between py-3 px-5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted/50">
                    {section}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-foreground-muted/40 transition-transform duration-200",
                      expandedSections.includes(section) && "rotate-180"
                    )}
                  />
                </button>

                {/* Features */}
                <AnimatePresence>
                  {expandedSections.includes(section) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      {features.map((feature, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-4 gap-4 py-3 px-5 border-t border-white/[0.03] hover:bg-white/[0.015] transition-colors"
                        >
                          <div className="text-sm text-foreground-muted/80 flex items-center gap-2">
                            {feature.name}
                            {feature.name.includes("Analytics") && (
                              <span className="text-[9px] font-semibold bg-[hsl(var(--accent-teal))]/15 text-[hsl(var(--accent-teal))] px-1.5 py-0.5">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex justify-center items-center">
                            <FeatureValue value={feature.free} />
                          </div>
                          <div className="flex justify-center items-center">
                            <FeatureValue value={feature.pro} />
                          </div>
                          <div className="flex justify-center items-center">
                            <FeatureValue value={feature.premium} />
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// FAQ accordion
function FAQSection({ className }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className={cn("w-full max-w-2xl mx-auto", className)}>
      <div className="text-center mb-10">
        <h3 className="text-2xl font-semibold text-foreground mb-2">
          Questions & Answers
        </h3>
        <p className="text-sm text-foreground-muted/70">
          Common questions about pricing
        </p>
      </div>

      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "overflow-hidden transition-all duration-200 border",
              openIndex === i
                ? "bg-white/[0.03] border-white/[0.08]"
                : "bg-transparent border-white/[0.04] hover:border-white/[0.06]"
            )}
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between py-4 px-5 text-left"
            >
              <span
                className={cn(
                  "text-sm font-medium transition-colors pr-4",
                  openIndex === i ? "text-foreground" : "text-foreground-muted"
                )}
              >
                {item.question}
              </span>
              <ChevronDown
                size={14}
                className={cn(
                  "shrink-0 text-foreground-muted/40 transition-transform duration-200",
                  openIndex === i && "rotate-180 text-foreground-muted"
                )}
              />
            </button>

            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-0">
                    <p className="text-sm text-foreground-muted/70 leading-relaxed border-t border-white/[0.04] pt-3">
                      {item.answer}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Testimonial component
function Testimonials({ className }) {
  const testimonials = [
    {
      quote: "Upgraded after missing a 200-pip EUR/USD move. Pro is worth 10x the price.",
      author: "Marcus C.",
      role: "London",
    },
    {
      quote: "The analytics save me hours of manual tracking. Premium pays for itself.",
      author: "Sarah M.",
      role: "NYC",
    },
  ];

  return (
    <div className={cn("w-full max-w-3xl mx-auto", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testimonials.map((t, i) => (
          <div
            key={i}
            className="border border-white/[0.04] bg-white/[0.015] p-5"
          >
            <p className="text-sm text-foreground-muted/80 leading-relaxed mb-4">
              "{t.quote}"
            </p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/[0.04] flex items-center justify-center text-[10px] font-semibold text-foreground-muted/60">
                {t.author.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-medium text-foreground/80">{t.author}</p>
                <p className="text-[10px] text-foreground-muted/50">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Pricing Page
export function PricingPage({
  standalone = false, // For landing page mode
  onSelectPlan,
  className,
}) {
  return (
    <div className={cn("w-full", className)}>
      {/* Hero section (for standalone mode) */}
      {standalone && (
        <div className="relative text-center mb-16 pt-8">
          {/* Subtle ambient glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[hsl(var(--accent-teal))]/[0.06] blur-[100px] rounded-full pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10"
          >
            {/* Elegant serif headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-light text-foreground mb-4 tracking-tight leading-[1.1]">
              Choose a{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-[hsl(var(--accent-teal))]">plan</span>
                <span className="absolute inset-x-0 bottom-1 h-2 bg-[hsl(var(--accent-teal))]/10 -z-0" />
              </span>
            </h1>
            <p className="text-base text-foreground-muted/70 max-w-md mx-auto">
              Signal automation that scales with your trading
            </p>
          </motion.div>
        </div>
      )}

      {/* Pricing cards */}
      <PricingCards onSelectPlan={onSelectPlan} className="mb-16" />

      {/* Comparison table */}
      <div className="border-t border-white/[0.06] pt-12 mb-16">
        <ComparisonTable />
      </div>

      {/* Testimonials (for standalone mode) */}
      {standalone && (
        <div className="border-t border-white/[0.04] pt-10 mb-12">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted/40 text-center mb-6">
            What traders say
          </p>
          <Testimonials />
        </div>
      )}

      {/* FAQ */}
      <div className="border-t border-white/[0.04] pt-10 mb-10">
        <FAQSection />
      </div>

      {/* Final CTA (for standalone mode) */}
      {standalone && (
        <div className="text-center py-10 border-t border-white/[0.04]">
          <p className="text-sm text-foreground-muted/70 mb-4">
            Ready to automate your trading?
          </p>
          <button
            onClick={() => onSelectPlan?.("free")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-foreground hover:bg-white/[0.1] hover:border-white/[0.12] transition-all"
          >
            Get Started Free
            <Zap size={14} className="text-[hsl(var(--accent-teal))]" />
          </button>
        </div>
      )}

      {/* Help link */}
      <div className="text-center py-4">
        <a
          href="#"
          className="inline-flex items-center gap-1.5 text-xs text-foreground-muted/50 hover:text-foreground-muted transition-colors"
        >
          <HelpCircle size={12} />
          Need help? Contact our team
        </a>
      </div>
    </div>
  );
}

// Export comparison data for use elsewhere
export { COMPARISON_FEATURES, FAQ_ITEMS };

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  HelpCircle,
  ExternalLink,
  Star,
  MessageSquare,
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
    <div className={cn("w-full max-w-5xl mx-auto", className)}>
      <div className="text-center mb-12">
        <h3 className="text-3xl font-bold text-foreground mb-4">
          Compare All Features
        </h3>
        <p className="text-foreground-muted">
          Detailed breakdown of what's included in each plan
        </p>
      </div>

      {/* Mobile scroll wrapper - styled scrollbar */}
      <div className="overflow-x-auto lg:overflow-visible pb-4 -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="min-w-[700px] lg:min-w-0 bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-sm">
          {/* Table header - sticky */}
          <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/[0.06] py-6 px-6">
            <div className="grid grid-cols-4 gap-4 items-center">
              <div className="text-base font-semibold text-foreground">
                Feature
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-foreground mb-1">
                  Free
                </div>
                <div className="text-xs text-foreground-muted">Entry Level</div>
              </div>
              <div className="text-center relative">
                <div className="text-lg font-bold text-[hsl(var(--accent-teal))] mb-1">
                  Pro
                </div>
                <div className="text-xs text-foreground-muted">
                  Most Popular
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[hsl(var(--accent-gold))] mb-1">
                  Premium
                </div>
                <div className="text-xs text-foreground-muted">Power Users</div>
              </div>
            </div>
          </div>

          {/* Feature sections */}
          <div className="divide-y divide-white/[0.04]">
            {Object.entries(COMPARISON_FEATURES).map(([section, features]) => (
              <div key={section} className="bg-transparent">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between py-4 px-6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <span className="text-sm font-bold uppercase tracking-wider text-foreground-muted">
                    {section}
                  </span>
                  {expandedSections.includes(section) ? (
                    <ChevronUp size={16} className="text-foreground-muted" />
                  ) : (
                    <ChevronDown size={16} className="text-foreground-muted" />
                  )}
                </button>

                {/* Features */}
                <AnimatePresence>
                  {expandedSections.includes(section) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {features.map((feature, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-4 gap-4 py-4 px-6 border-t border-white/[0.02] hover:bg-white/[0.01] transition-colors"
                        >
                          <div className="text-sm font-medium text-foreground-muted/90 flex items-center">
                            {feature.name}
                            {feature.name.includes("Analytics") && (
                              <span className="ml-2 text-[10px] bg-[hsl(var(--accent-teal))]/10 text-[hsl(var(--accent-teal))] px-1.5 py-0.5 rounded">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex justify-center items-center">
                            <FeatureValue value={feature.free} />
                          </div>
                          <div className="flex justify-center items-center relative">
                            {/* Subtle column highlight for Pro */}
                            <div className="absolute inset-y-[-16px] inset-x-[-16px] bg-[hsl(var(--accent-teal))]/[0.02] pointer-events-none" />
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
    <div className={cn("w-full max-w-3xl mx-auto", className)}>
      <div className="text-center mb-12">
        <h3 className="text-3xl font-bold text-foreground mb-4">
          Frequently Asked Questions
        </h3>
        <p className="text-foreground-muted">
          Everything you need to know about our pricing and plans
        </p>
      </div>

      <div className="space-y-4">
        {FAQ_ITEMS.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "rounded-xl overflow-hidden transition-all duration-200 border",
              openIndex === i
                ? "bg-white/[0.04] border-white/[0.1] shadow-lg"
                : "bg-transparent border-white/[0.04] hover:bg-white/[0.02] hover:border-white/[0.08]"
            )}
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between p-6 text-left"
            >
              <span
                className={cn(
                  "text-base font-medium transition-colors",
                  openIndex === i
                    ? "text-[hsl(var(--accent-teal))]"
                    : "text-foreground"
                )}
              >
                {item.question}
              </span>
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                  openIndex === i
                    ? "bg-[hsl(var(--accent-teal))]/20 text-[hsl(var(--accent-teal))]"
                    : "bg-white/[0.06] text-foreground-muted"
                )}
              >
                <ChevronDown
                  size={14}
                  className={cn(
                    "transition-transform duration-300",
                    openIndex === i && "rotate-180"
                  )}
                />
              </div>
            </button>

            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "circOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 pt-0">
                    <p className="text-base text-foreground-muted leading-relaxed border-t border-white/[0.06] pt-4">
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

// Testimonial component (placeholder - replace with real testimonials)
function Testimonials({ className }) {
  const testimonials = [
    {
      quote:
        "Upgraded after missing a 200-pip EUR/USD move. Never again. Pro is worth 10x the price.",
      author: "Marcus C.",
      role: "Pro Trader, London",
      rating: 5,
    },
    {
      quote:
        "The analytics alone save me hours of manual tracking. Premium pays for itself every week.",
      author: "Sarah M.",
      role: "Fund Analyst, NYC",
      rating: 5,
    },
  ];

  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {testimonials.map((t, i) => (
          <div
            key={i}
            className="rounded-none border border-white/[0.06] bg-white/[0.02] p-6"
          >
            {/* Rating */}
            <div className="flex gap-1 mb-3">
              {Array.from({ length: t.rating }).map((_, j) => (
                <Star
                  key={j}
                  size={14}
                  className="text-[hsl(var(--accent-gold))] fill-[hsl(var(--accent-gold))]"
                />
              ))}
            </div>

            {/* Quote */}
            <p className="text-sm text-foreground italic mb-4">"{t.quote}"</p>

            {/* Author */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center">
                <MessageSquare size={14} className="text-foreground-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t.author}
                </p>
                <p className="text-xs text-foreground-muted">{t.role}</p>
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
        <div className="relative text-center mb-20 pt-10">
          {/* Ambient background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(var(--accent-teal))]/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[hsl(var(--accent-teal))]/5 to-transparent blur-[80px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              From Manual Trader
              <br />
              to{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--accent-teal))] to-[hsl(var(--accent-teal))]/60">
                Automated Pro
              </span>
            </h1>
            <p className="text-xl text-foreground-muted max-w-2xl mx-auto leading-relaxed">
              Choose the plan that matches your trading goals.
              <br className="hidden md:block" />
              All plans include a{" "}
              <span className="text-foreground font-medium">
                14-day money-back guarantee
              </span>
              .
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
        <div className="border-t border-white/[0.06] pt-12 mb-16">
          <h3 className="text-lg font-semibold text-foreground text-center mb-6">
            Trusted by 10,000+ Traders
          </h3>
          <Testimonials />
        </div>
      )}

      {/* FAQ */}
      <div className="border-t border-white/[0.06] pt-12 mb-8">
        <FAQSection />
      </div>

      {/* Final CTA (for standalone mode) */}
      {standalone && (
        <div className="text-center py-12 border-t border-white/[0.06]">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Ready to automate your trading?
          </h3>
          <p className="text-foreground-muted mb-6">
            Start with our Free plan - no credit card required.
          </p>
          <button
            onClick={() => onSelectPlan?.("free")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-none bg-[hsl(var(--accent-teal))] text-background font-medium hover:bg-[hsl(var(--accent-teal))]/90 transition-colors"
          >
            <Zap size={18} />
            Get Started Free
          </button>
        </div>
      )}

      {/* Help link */}
      <div className="text-center text-sm text-foreground-muted">
        <a
          href="#"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <HelpCircle size={14} />
          Need help choosing? Contact our team
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

// Export comparison data for use elsewhere
export { COMPARISON_FEATURES, FAQ_ITEMS };

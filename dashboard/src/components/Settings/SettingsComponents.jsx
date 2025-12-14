import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function SettingRow({ label, description, children, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-5 first:pt-0 last:pb-0",
        className
      )}
    >
      <div className="flex flex-col gap-0.5 pr-8 min-w-0">
        <span className="text-[15px] font-medium text-foreground">
          {label}
        </span>
        {description && (
          <span className="text-[12px] text-foreground-muted/70 leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );
}

export function NumberInput({ value, onChange, min, max, step, suffix, className }) {
  const handleChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) onChange(val);
  };

  return (
    <div className="flex items-center gap-2.5">
      <Input
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        className={cn(
          "w-24 h-10 px-3 text-center font-mono text-[13px]",
          "bg-white/[0.03] border-white/[0.08] rounded-none",
          "hover:border-white/[0.12] hover:bg-white/[0.04]",
          "focus:border-white/[0.20] focus:bg-white/[0.05]",
          "focus:ring-2 focus:ring-white/[0.06] focus:ring-offset-0",
          "focus:shadow-[0_0_0_4px_rgba(255,255,255,0.03)]",
          "transition-all duration-200",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
      />
      {suffix && (
        <span className="text-[13px] text-foreground-muted/60 font-medium min-w-[20px]">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function SymbolTags({ symbols, onChange }) {
  const [input, setInput] = useState("");

  const addSymbol = (e) => {
    if (e.key === "Enter" && input) {
      e.preventDefault();
      if (!symbols.includes(input.toUpperCase())) {
        onChange([...symbols, input.toUpperCase()]);
      }
      setInput("");
    }
  };

  const removeSymbol = (symbolToRemove) => {
    onChange(symbols.filter((s) => s !== symbolToRemove));
  };

  return (
    <div className="flex flex-wrap gap-2 items-center justify-end">
      {symbols.map((symbol) => (
        <span
          key={symbol}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium",
            "bg-white/[0.05] text-foreground/80 border border-white/[0.06] rounded-sm",
            "hover:bg-white/[0.08] hover:border-white/[0.10] hover:-translate-y-[1px]",
            "transition-all duration-150"
          )}
        >
          {symbol}
          <button
            onClick={() => removeSymbol(symbol)}
            className="hover:text-foreground transition-colors opacity-60 hover:opacity-100"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addSymbol}
        placeholder="+ Add"
        className={cn(
          "w-16 h-8 px-2 text-xs rounded-sm",
          "bg-transparent border-white/[0.06] border-dashed",
          "hover:border-white/[0.12] hover:bg-white/[0.02]",
          "focus:border-white/20 focus:bg-white/[0.03]",
          "transition-all duration-200 placeholder:text-foreground-muted/40"
        )}
      />
    </div>
  );
}

export function ChannelTags({ channels, onChange }) {
  const [input, setInput] = useState("");

  const addChannel = (e) => {
    if (e.key === "Enter" && input) {
      e.preventDefault();
      if (!channels.includes(input)) {
        onChange([...channels, input]);
      }
      setInput("");
    }
  };

  const removeChannel = (channelToRemove) => {
    onChange(channels.filter((c) => c !== channelToRemove));
  };

  return (
    <div className="flex flex-wrap gap-2 items-center justify-end">
      {channels.map((channel) => (
        <span
          key={channel}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono",
            "bg-white/[0.04] text-foreground/70 border border-white/[0.06] rounded-sm",
            "hover:bg-white/[0.07] hover:border-white/[0.10] hover:-translate-y-[1px]",
            "transition-all duration-150"
          )}
        >
          {channel}
          <button
            onClick={() => removeChannel(channel)}
            className="hover:text-foreground transition-colors opacity-60 hover:opacity-100"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addChannel}
        placeholder="+ Add ID"
        className={cn(
          "w-20 h-8 px-2 text-xs font-mono rounded-sm",
          "bg-transparent border-white/[0.06] border-dashed",
          "hover:border-white/[0.12] hover:bg-white/[0.02]",
          "focus:border-white/20 focus:bg-white/[0.03]",
          "transition-all duration-200 placeholder:text-foreground-muted/40"
        )}
      />
    </div>
  );
}

export function TPRatioInputs({ ratios, onChange }) {
  const handleChange = (index, value) => {
    const newRatios = [...ratios];
    newRatios[index] = parseFloat(value);
    onChange(newRatios);
  };

  const total = ratios.reduce((a, b) => a + b, 0);
  const isValid = Math.abs(total - 1) < 0.001;

  return (
    <div className="flex items-center gap-2.5">
      {ratios.map((ratio, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[10px] text-foreground-muted/60 font-medium">
            TP{i + 1}
          </span>
          <Input
            type="number"
            value={ratio}
            onChange={(e) => handleChange(i, e.target.value)}
            step={0.1}
            min={0}
            max={1}
            className={cn(
              "w-14 h-9 px-2 text-center font-mono text-xs",
              "bg-white/[0.03] border-white/[0.08] rounded-none",
              "hover:border-white/[0.12] hover:bg-white/[0.04]",
              "focus:border-white/[0.20] focus:bg-white/[0.05] focus:ring-0",
              "transition-all duration-200",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            )}
          />
        </div>
      ))}
      <span
        className={cn(
          "text-xs font-mono px-2.5 py-1.5 rounded-sm",
          isValid
            ? "text-accent-gold bg-accent-gold/10 border border-accent-gold/20"
            : "text-rose-400/80 bg-rose-500/10 border border-rose-500/20"
        )}
      >
        {(total * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export function PasswordInput({ value, onChange, placeholder, className, disabled }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-10 pr-10 font-mono text-[13px]",
          "bg-white/[0.03] border-white/[0.08] rounded-none",
          "hover:border-white/[0.12] hover:bg-white/[0.04]",
          "focus:border-white/[0.20] focus:bg-white/[0.05]",
          "focus:ring-2 focus:ring-white/[0.06] focus:ring-offset-0",
          "transition-all duration-200",
          className
        )}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted/50 hover:text-foreground-muted transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// Common input class for consistency
export const inputClass = cn(
  "h-10 font-mono text-[13px]",
  "bg-white/[0.03] border-white/[0.08] rounded-none",
  "hover:border-white/[0.12] hover:bg-white/[0.04]",
  "focus:border-white/[0.20] focus:bg-white/[0.05]",
  "focus:ring-2 focus:ring-white/[0.06] focus:ring-offset-0",
  "transition-all duration-200 placeholder:text-foreground-muted/40"
);

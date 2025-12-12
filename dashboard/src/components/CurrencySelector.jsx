import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function CurrencySelector() {
  const { currency, setCurrency, currencies, currencyData } = useCurrency();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 px-3 rounded-full transition-all duration-300",
            "bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10",
            "text-foreground hover:text-white",
            "shadow-lg shadow-black/10 backdrop-blur-md",
            "group"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-foreground">
              {currencyData.symbol}
            </span>
            <span className="text-sm font-medium tracking-tight">
              {currency}
            </span>
            <ChevronDown
              size={12}
              className="text-foreground-muted group-hover:text-foreground transition-colors"
            />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={cn(
          "w-56 glass-panel border-white/5 p-2",
          "animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
        )}
      >
        <div className="px-2 py-2">
          <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
            Display Currency
          </p>
        </div>

        <DropdownMenuSeparator className="bg-white/5 mx-2 my-1" />

        <DropdownMenuRadioGroup value={currency} onValueChange={setCurrency}>
          {Object.values(currencies).map((curr) => {
            const isSelected = currency === curr.code;
            return (
              <DropdownMenuRadioItem
                key={curr.code}
                value={curr.code}
                className={cn(
                  "cursor-pointer rounded-md my-1 px-3 py-2.5",
                  "focus:bg-white/5 focus:text-white transition-colors",
                  "data-[state=checked]:bg-white/10 data-[state=checked]:text-foreground"
                )}
              >
                <div className="flex items-center w-full gap-3">
                  <span
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono border",
                      isSelected
                        ? "bg-white/15 border-white/15 text-foreground"
                        : "bg-white/5 border-white/5 text-foreground-muted group-hover:border-white/10"
                    )}
                  >
                    {curr.symbol}
                  </span>

                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-none">
                      {curr.code}
                    </span>
                    <span className="text-[10px] text-foreground-muted mt-0.5">
                      {curr.name}
                    </span>
                  </div>

                  {isSelected && (
                    <Check className="ml-auto w-4 h-4 text-foreground" />
                  )}
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

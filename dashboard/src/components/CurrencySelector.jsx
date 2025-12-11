import { ChevronDown } from "lucide-react";
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
            "gap-1.5 text-xs font-medium h-8 px-2",
            "text-foreground-muted hover:text-foreground"
          )}
        >
          <span className="font-mono">{currencyData.symbol}</span>
          <span>{currency}</span>
          <ChevronDown size={12} className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-foreground-muted">
          Account Currency
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currency} onValueChange={setCurrency}>
          {Object.values(currencies).map((curr) => (
            <DropdownMenuRadioItem
              key={curr.code}
              value={curr.code}
              className="cursor-pointer"
            >
              <span className="font-mono w-8 text-right mr-2">{curr.symbol}</span>
              <span>{curr.code}</span>
              <span className="ml-auto text-xs text-foreground-muted">
                {curr.name}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

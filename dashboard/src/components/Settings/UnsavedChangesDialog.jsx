import { AlertTriangle, Save, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Premium Dark Unsaved Changes Dialog
 *
 * Visually striking modal that warns users about unsaved changes.
 * Features glass morphism and premium dark theme aesthetic.
 *
 * @param {boolean} open - Controls dialog visibility
 * @param {function} onSave - Called when user clicks "Save Changes"
 * @param {function} onDiscard - Called when user clicks "Discard"
 * @param {function} onCancel - Called when user clicks "Cancel" or closes dialog
 * @param {boolean} isSaving - Shows loading state on Save button
 * @param {string} title - Optional custom title
 * @param {string} description - Optional custom description
 */
export default function UnsavedChangesDialog({
  open,
  onSave,
  onDiscard,
  onCancel,
  isSaving = false,
  title = "You have unsaved changes",
  description = "Your recent changes haven't been saved yet. Would you like to save them before continuing?",
}) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="w-[90vw] max-w-[480px]">
        {/* Header with accent border */}
        <AlertDialogHeader className="relative">
          {/* Accent glow effect */}
          <div className="absolute -top-6 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

          <div className="flex items-start gap-4">
            {/* Warning Icon with subtle pulse */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-amber-500/20 blur-xl animate-pulse-soft rounded-full" />
              <div className={cn(
                "relative flex items-center justify-center",
                "w-12 h-12 rounded-full",
                "bg-amber-500/10 border border-amber-500/20",
                "shadow-[0_0_20px_rgba(245,158,11,0.15)]"
              )}>
                <AlertTriangle className="w-6 h-6 text-amber-400" strokeWidth={2} />
              </div>
            </div>

            {/* Title and Description */}
            <div className="flex-1 pt-1">
              <AlertDialogTitle className="text-[20px] font-semibold tracking-tight text-foreground">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-[14px] leading-relaxed text-foreground-muted/90 italic">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {/* Action Buttons */}
        <AlertDialogFooter className="border-t border-white/[0.06] bg-white/[0.01]">
          <div className="flex flex-col-reverse sm:flex-row w-full gap-2.5">
            {/* Cancel Button - Ghost style */}
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={isSaving}
              className={cn(
                "flex-1 sm:flex-none h-10 px-5",
                "text-foreground-muted hover:text-foreground",
                "hover:bg-white/[0.06]",
                "transition-all duration-200"
              )}
            >
              <X size={16} className="mr-2" />
              Cancel
            </Button>

            {/* Discard Button - Destructive style */}
            <Button
              variant="outline"
              onClick={onDiscard}
              disabled={isSaving}
              className={cn(
                "flex-1 sm:flex-none h-10 px-5",
                "border-rose-500/20 bg-rose-500/5",
                "text-rose-400 hover:text-rose-300",
                "hover:bg-rose-500/10 hover:border-rose-500/30",
                "active:scale-[0.98]",
                "transition-all duration-200"
              )}
            >
              <Trash2 size={16} className="mr-2" />
              Discard
            </Button>

            {/* Save Button - Primary action */}
            <Button
              onClick={onSave}
              disabled={isSaving}
              className={cn(
                "flex-1 sm:flex-none h-10 px-6",
                "bg-foreground text-background",
                "hover:shadow-[0_4px_20px_rgba(255,255,255,0.2)]",
                "hover:scale-[1.02]",
                "active:scale-[0.98]",
                "disabled:opacity-50 disabled:scale-100 disabled:shadow-none",
                "transition-all duration-200 font-medium",
                // Subtle gradient overlay for premium feel
                "relative overflow-hidden",
                "before:absolute before:inset-0",
                "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
                "before:translate-x-[-200%] hover:before:translate-x-[200%]",
                "before:transition-transform before:duration-700"
              )}
            >
              <Save size={16} className="mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

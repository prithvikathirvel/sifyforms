import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "../../lib/utils"

export interface CheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    onCheckedChange?: (checked: boolean) => void;
    checked?: boolean;
}

/**
 * A checkbox that stays legible in every theme.
 *
 * The box is drawn on the card surface rather than the page background, so it
 * never disappears into a dark canvas, and the tick is painted in
 * `primary-foreground` — the token guaranteed to contrast with the `primary`
 * fill behind it. Previously the tick inherited body text colour, which on the
 * darker themes put near-black on a dark accent.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, onCheckedChange, ...props }, ref) => {
        return (
            <div className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                <input
                    type="checkbox"
                    className={cn(
                        "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[0.25rem] border border-input bg-card",
                        "transition-colors duration-150 ring-offset-background",
                        "hover:border-primary/60",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "checked:border-primary checked:bg-primary",
                        className
                    )}
                    ref={ref}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    {...props}
                />
                <Check
                    className="pointer-events-none absolute h-3 w-3 text-primary-foreground opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
                    strokeWidth={3}
                />
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

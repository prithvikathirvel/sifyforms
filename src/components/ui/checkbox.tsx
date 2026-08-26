import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "../../lib/utils"

export interface CheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    onCheckedChange?: (checked: boolean) => void;
    checked?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, onCheckedChange, ...props }, ref) => {
        return (
            <div className="relative flex items-center justify-center w-4 h-4">
                <input
                    type="checkbox"
                    className={cn(
                        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none checked:bg-primary checked:border-primary peer-checked:text-primary-foreground bg-background",
                        className
                    )}
                    ref={ref}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    {...props}
                />
                {/* check icon inherits current text color; input sets
                     its color to primary-foreground when checked so the icon
                     always contrasts with the check background */}
                <Check className="h-3 w-3 absolute pointer-events-none opacity-0 peer-checked:opacity-100" strokeWidth={3} />
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

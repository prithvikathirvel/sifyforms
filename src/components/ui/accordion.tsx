import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AccordionItemProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({ title, subtitle, icon, defaultOpen = false, children, className }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 bg-white hover:bg-muted transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2.5">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <div>
            <div className="text-[13px] font-medium text-foreground">{title}</div>
            {subtitle && <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
        <div className="text-muted-foreground transition-transform duration-200">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
      </button>
      {isOpen && (
        <div className="px-3.5 py-3 bg-muted border-t">
          {children}
        </div>
      )}
    </div>
  );
}

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
}

import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function PageHeader({ title, description, icon: Icon, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-1">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center shrink-0">
            <Icon size={22} />
          </div>
        )}
        <div>
          <h1 className="font-heading font-bold tracking-tight text-foreground text-[clamp(21px,3.4vw,27px)] leading-tight">{title}</h1>
          <p className="text-[13px] md:text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0 flex items-center">{action}</div>}
    </div>
  );
}

import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick?: () => void;
  iconColor?: string;
};

/**
 * Feature Card Component - Modern card with icon and hover effects
 */
export function FeatureCard({ icon, title, description, badge, onClick, iconColor = "text-primary" }: FeatureCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-background ${iconColor} transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        {badge && (
          <span className="rounded-full bg-primary/20 px-2 py-1 text-xs font-semibold text-primary">
            {badge}
          </span>
        )}
      </div>

      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>

      <div className="flex items-center text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        <span>Configure</span>
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );
}

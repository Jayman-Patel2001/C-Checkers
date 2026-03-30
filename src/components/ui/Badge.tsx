import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | "active"
    | "paused"
    | "completed"
    | "pending"
    | "work"
    | "personal"
    | "approved"
    | "rejected"
    | "admin"
    | "employee"
    | "default";
  className?: string;
}

const variants: Record<string, string> = {
  active: "bg-green-100 text-green-700 border border-green-200",
  paused: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  completed: "bg-slate-100 text-slate-600 border border-slate-200",
  pending: "bg-blue-100 text-blue-700 border border-blue-200",
  work: "bg-blue-50 text-blue-700 border border-blue-100",
  personal: "bg-orange-50 text-orange-700 border border-orange-100",
  approved: "bg-green-100 text-green-700 border border-green-200",
  rejected: "bg-red-100 text-red-700 border border-red-200",
  admin: "bg-purple-100 text-purple-700 border border-purple-200",
  employee: "bg-blue-100 text-blue-700 border border-blue-200",
  default: "bg-slate-100 text-slate-600 border border-slate-200",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        variants[variant] || variants.default,
        className
      )}
    >
      {children}
    </span>
  );
}

import * as React from "react"
import { cn } from "@/src/utils/cn"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: "border-transparent bg-zinc-50 text-zinc-900 hover:bg-zinc-50/80",
      secondary: "border-transparent bg-zinc-800 text-zinc-50 hover:bg-zinc-800/80",
      destructive: "border-transparent bg-red-500/10 text-red-500 hover:bg-red-500/20",
      outline: "text-zinc-50 border border-white/10",
      success: "border-transparent bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2",
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }

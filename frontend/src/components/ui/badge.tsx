import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Amoeba Web Style Guide v2.0 §7.6 — Badge / Tag
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amb-primary-500 focus-visible:ring-offset-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Amoeba status badges — §7.6
        default: "bg-amb-primary-100 text-amb-primary-800",
        active: "bg-green-100 text-green-800",
        pending: "bg-yellow-100 text-yellow-800",
        draft: "bg-gray-100 text-gray-600",
        error: "bg-red-100 text-red-800",
        info: "bg-blue-100 text-blue-800",
        // legacy-compatible aliases
        secondary: "bg-gray-100 text-gray-700",
        destructive: "bg-red-100 text-red-800",
        outline: "border-gray-300 text-gray-700",
        ghost: "text-gray-600 hover:bg-gray-100",
        link: "text-amb-primary-600 underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }

import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amb-primary-500 focus-visible:ring-offset-2 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Amoeba Web Style Guide v2.0 §7.1 — primary
        default: "bg-amb-primary-500 text-white hover:bg-amb-primary-600",
        primary: "bg-amb-primary-500 text-white hover:bg-amb-primary-600",
        // §7.1 — secondary (neutral)
        secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
        // §7.1 — outline
        outline:
          "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50",
        // §7.1 — ghost
        ghost: "text-gray-600 hover:bg-gray-100",
        // §7.1 — danger (destructive)
        destructive: "bg-amb-error text-white hover:bg-red-600",
        danger: "bg-amb-error text-white hover:bg-red-600",
        link: "text-amb-primary-600 underline-offset-4 hover:underline",
      },
      size: {
        // Amoeba §7.1 sizes: sm=h-8, md=h-10, lg=h-12
        default: "h-10 gap-1.5 px-4",
        sm: "h-8 gap-1 px-3 text-[0.8rem]",
        md: "h-10 gap-1.5 px-4",
        lg: "h-12 gap-2 px-5 text-base",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        icon: "size-10",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-md": "size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// forwardRef required so base-ui render={<Button />} pattern (e.g. DialogClose)
// can attach its internal ref — prevents "Function components cannot be given refs" warning
const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(function Button(
  { className, variant = "default", size = "default", ...props },
  ref,
) {
  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})

export { Button, buttonVariants }

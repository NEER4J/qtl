"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      gap={8}
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-600" />,
        info: <InfoIcon className="size-4 text-blue-500" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
        error: <OctagonXIcon className="size-4 text-red-500" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!bg-white dark:!bg-[hsl(160,24%,10%)] !border !border-[hsl(152,18%,86%)] dark:!border-[hsl(160,16%,19%)] !shadow-lg !shadow-black/10 dark:!shadow-black/40 !rounded-lg !text-[hsl(160,18%,11%)] dark:!text-[hsl(144,22%,95%)]",
          title: "!font-semibold !text-sm",
          description: "!text-xs !opacity-75",
          success: "!border-l-4 !border-l-emerald-500",
          error: "!border-l-4 !border-l-red-500",
          warning: "!border-l-4 !border-l-amber-500",
          info: "!border-l-4 !border-l-blue-500",
        },
      }}
      style={
        {
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

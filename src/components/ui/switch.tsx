"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
              // base styles
              "relative inline-flex h-5 w-10 items-center rounded-full border transition-colors outline",
              // visible outline
              "border-gray-200",
              // background color when on/off
              "data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-white, dark:data-[state=checked]:bg-blue-600 dark:data-[state=unchecked]:bg-white",
              className
            )}      
            {...props}
          >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-blue-100 dark:data-[state=checked]:bg-blue-800 pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

"use client"

import { Tooltip as TooltipRoot } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

const TooltipProvider = TooltipRoot.Provider
const TooltipTrigger = TooltipRoot.Trigger
const TooltipPortal = TooltipRoot.Portal

function TooltipPositioner({
  className,
  ...props
}: React.ComponentProps<typeof TooltipRoot.Positioner>) {
  return (
    <TooltipRoot.Positioner
      data-slot="tooltip-positioner"
      className={cn("wiki-tooltip-positioner", className)}
      {...props}
    />
  )
}

function TooltipPopup({
  className,
  ...props
}: React.ComponentProps<typeof TooltipRoot.Popup>) {
  return (
    <TooltipRoot.Popup
      data-slot="tooltip-popup"
      className={cn("wiki-tooltip", className)}
      {...props}
    />
  )
}

function TooltipArrow({
  className,
  ...props
}: React.ComponentProps<typeof TooltipRoot.Arrow>) {
  return (
    <TooltipRoot.Arrow
      data-slot="tooltip-arrow"
      className={cn("wiki-tooltip__arrow", className)}
      {...props}
    />
  )
}

function Tooltip({
  children,
  content,
  delayDuration = 400,
}: {
  children: React.ReactNode
  content: React.ReactNode
  delayDuration?: number
}) {
  return (
    <TooltipProvider delay={delayDuration}>
      <TooltipRoot.Root>
        <TooltipTrigger render={(props) => <span {...props}>{children}</span>} />
        <TooltipPortal>
          <TooltipPositioner sideOffset={6}>
            <TooltipPopup>
              <TooltipArrow />
              {content}
            </TooltipPopup>
          </TooltipPositioner>
        </TooltipPortal>
      </TooltipRoot.Root>
    </TooltipProvider>
  )
}

export {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipPortal,
  TooltipPositioner,
  TooltipPopup,
  TooltipArrow,
}

"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface ToastProps {
  message: string
  visible: boolean
  onDismiss?: () => void
  /** Auto-dismiss duration in ms (default 2000) */
  duration?: number
  className?: string
}

function Toast({ message, visible, onDismiss, duration = 2000, className }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onDismiss?.()
      timerRef.current = null
    }, duration)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [visible, duration, onDismiss])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-slot="toast"
      className={cn("wiki-toast", className)}
    >
      {message}
    </div>
  )
}

export { Toast, type ToastProps }

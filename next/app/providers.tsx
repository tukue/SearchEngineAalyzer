"use client"

import { type ReactNode, useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { Toaster } from "@/components/ui/toaster"
import { createQueryClient } from "@/lib/queryClient"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}

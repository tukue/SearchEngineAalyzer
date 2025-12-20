<<<<<<< HEAD
"use client";

import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

export default function Providers({ children }: PropsWithChildren<{}>) {
=======
"use client"

import { type ReactNode, useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { Toaster } from "@/components/ui/toaster"
import { createQueryClient } from "@/lib/queryClient"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient())

>>>>>>> origin/main
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
<<<<<<< HEAD
  );
=======
  )
>>>>>>> origin/main
}

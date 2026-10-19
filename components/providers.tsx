"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react";
import { Image, ImageKitProvider } from '@imagekit/next';

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { envConfig } from "@/lib/env";

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser tab (useState keeps it stable across re-renders).
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        <ImageKitProvider urlEndpoint={envConfig.imagekit.urlEndpoint}>
        <TooltipProvider>{children}</TooltipProvider>
        </ImageKitProvider>
        <Toaster position="top-center" />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

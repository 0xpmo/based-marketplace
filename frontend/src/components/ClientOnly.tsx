// frontend/src/components/ClientOnly.tsx
"use client";

import { useEffect, useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getActiveChain } from "@/config/chains";

export default function ClientOnly({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  // Create a stable config object that won't change on re-renders
  const [config] = useState(
    () =>
      createConfig({
        chains: [getActiveChain()],
        transports: {
          // Use explicit typing for the transport configuration
          [getActiveChain().id]: http(),
        } as Record<number, ReturnType<typeof http>>,
      })
    // createConfig(
    //   getDefaultConfig({
    //     chains: [getActiveChain()],
    //     transports: {
    //       // Add your transport config here
    //     },
    //     walletConnectProjectId:
    //       process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    //   })
    // )
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // If not mounted yet, return a placeholder or null
  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

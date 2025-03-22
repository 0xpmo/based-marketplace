// frontend/src/components/providers/Web3Provider.tsx
"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { WagmiConfig } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/config/web3";
import { initWalletKit } from "@/config/walletkit";
// We don't need this import if we're not using it
// import type { WalletKit } from "@reown/walletkit";

// Create a client for react-query
const queryClient = new QueryClient();

// Create context for WalletKit with safer typing
interface WalletKitContextType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletKit: any | null; // Use a more flexible type for third-party library
  initialized: boolean;
  error: Error | null;
}

const WalletKitContext = createContext<WalletKitContextType>({
  walletKit: null,
  initialized: false,
  error: null,
});

// Hook to access WalletKit
export function useWalletKit() {
  return useContext(WalletKitContext);
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [walletKit, setWalletKit] = useState<any | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize WalletKit when the component mounts
  useEffect(() => {
    // Skip initialization on the server
    if (typeof window === "undefined") return;

    let isMounted = true;

    async function initialize() {
      try {
        const kit = await initWalletKit();
        if (isMounted) {
          setWalletKit(kit);
          setInitialized(true);
        }
      } catch (err) {
        console.error("Failed to initialize WalletKit:", err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setInitialized(true); // Still mark as initialized to not keep trying
        }
      }
    }

    initialize();

    // Clean up function
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <WalletKitContext.Provider value={{ walletKit, initialized, error }}>
      <WagmiConfig config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiConfig>
    </WalletKitContext.Provider>
  );
}

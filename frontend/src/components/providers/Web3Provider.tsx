// frontend/src/components/providers/Web3Provider.tsx
"use client";

import { WagmiConfig } from "wagmi";
import { ConnectKitProvider } from "connectkit";
import { wagmiConfig } from "@/config/web3";

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <ConnectKitProvider
        customTheme={{
          "--ck-connectbutton-background": "#22c55e",
          "--ck-connectbutton-hover-background": "#16a34a",
          "--ck-connectbutton-active-background": "#15803d",
          "--ck-connectbutton-color": "#ffffff",
          "--ck-body-background": "#121212",
          "--ck-body-color": "#ffffff",
          "--ck-body-color-muted": "#a3a3a3",
          "--ck-body-action-color": "#22c55e",
          "--ck-body-divider": "#333333",
          "--ck-primary-button-background": "#22c55e",
          "--ck-primary-button-hover-background": "#16a34a",
          "--ck-primary-button-active-background": "#15803d",
          "--ck-secondary-button-background": "#333333",
          "--ck-secondary-button-hover-background": "#444444",
          "--ck-secondary-button-color": "#ffffff",
          "--ck-modal-background": "#1e1e1e",
          "--ck-overlay-background": "rgba(0, 0, 0, 0.8)",
        }}
      >
        {children}
      </ConnectKitProvider>
    </WagmiConfig>
  );
}

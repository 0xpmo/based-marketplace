// frontend/src/config/web3.ts
import { createConfig, http } from "wagmi";
import { getDefaultConfig } from "connectkit";
import { getActiveChain } from "./chains";

// Get the active chain based on environment
const activeChain = getActiveChain();

// Contract addresses from environment variables
export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
export const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;

// Create ConnectKit config
export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [activeChain],
    transports: {
      [activeChain.id]: http(),
    },
    appName: "NFT Marketplace",
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  })
);

export const chains = [activeChain];

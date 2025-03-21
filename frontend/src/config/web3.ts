// frontend/src/config/web3.ts
import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "connectkit";

// Define the Based AI chain
export const basedAIChain = defineChain({
  id: 32323,
  name: "Based AI",
  nativeCurrency: {
    decimals: 18,
    name: "BasedAI",
    symbol: "BASED",
  },
  rpcUrls: {
    default: { http: ["https://mainnet.basedaibridge.com/rpc/"] },
  },
  blockExplorers: {
    default: {
      name: "Based AI Explorer",
      url: "https://explorer.getbased.ai",
    },
  },
});

// Contract addresses (replace with your deployed addresses)
export const FACTORY_ADDRESS = "0x0000000000000000000000000000000000000000";
export const MARKETPLACE_ADDRESS = "0x0000000000000000000000000000000000000000";

// Create ConnectKit config
export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [basedAIChain],
    transports: {
      [basedAIChain.id]: http(),
    },
    appName: "Pepe NFT Marketplace",
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  })
);

export const chains = [basedAIChain];

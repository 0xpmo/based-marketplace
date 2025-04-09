// frontend/src/config/web3.ts
import { createConfig, http } from "wagmi";
import { getActiveChain } from "./chains";

// Get the active chain based on environment
const activeChain = getActiveChain();

console.log("active chain", activeChain);

// Create wagmi config
export const wagmiConfig = createConfig({
  chains: [activeChain],
  transports: {
    // Use explicit typing for the transport configuration
    [activeChain.id]: http(),
  } as Record<number, ReturnType<typeof http>>,
});

export const chains = [activeChain];

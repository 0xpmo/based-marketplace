"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useWalletKit } from "@/components/providers/Web3Provider";
import PepeButton from "./PepeButton";

export default function WalletConnectButton() {
  const { walletKit, initialized } = useWalletKit();
  const { address, isConnected } = useAccount();
  const [isConnecting, setIsConnecting] = useState(false);

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Handle connect button click
  const handleConnect = async () => {
    if (!walletKit || !initialized || isConnecting) return;

    try {
      setIsConnecting(true);
      // We can safely call methods on walletKit now
      await walletKit.connect({
        // You can specify chains to connect to if needed
        // chains: ['eip155:1'], // Ethereum Mainnet
      });
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle disconnect button click
  const handleDisconnect = async () => {
    if (!walletKit || !initialized || !isConnected) return;

    try {
      // We can safely call methods on walletKit now
      await walletKit.disconnect();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  };

  // Button content based on connection state
  const buttonContent = () => {
    if (isConnecting) {
      return (
        <span className="flex items-center">
          <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2" />
          Connecting...
        </span>
      );
    }

    if (isConnected && address) {
      return formatAddress(address);
    }

    return "Connect Wallet";
  };

  return (
    <div>
      <PepeButton
        variant={isConnected ? "outline" : "primary"}
        onClick={isConnected ? handleDisconnect : handleConnect}
        disabled={!initialized || isConnecting}
      >
        {buttonContent()}
      </PepeButton>
    </div>
  );
}

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
          <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-cyan-200 rounded-full mr-2" />
          Connecting...
        </span>
      );
    }

    if (isConnected && address) {
      return (
        <span className="flex items-center">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 mr-2 animate-pulse"></span>
          {formatAddress(address)}
        </span>
      );
    }

    return (
      <span className="flex items-center">
        <svg
          className="mr-1 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        Connect Wallet
      </span>
    );
  };

  return (
    <div>
      <PepeButton
        variant={isConnected ? "outline" : "primary"}
        onClick={isConnected ? handleDisconnect : handleConnect}
        disabled={!initialized || isConnecting}
        className={
          isConnected
            ? "border-blue-500 text-blue-300 hover:bg-blue-900/30"
            : "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500 relative overflow-hidden group"
        }
      >
        {isConnected ? (
          buttonContent()
        ) : (
          <>
            <span className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/30 to-blue-400/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
            {buttonContent()}
          </>
        )}
      </PepeButton>
    </div>
  );
}

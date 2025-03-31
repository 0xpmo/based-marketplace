"use client";

import { useState, useRef, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useConfig,
  usePublicClient,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { switchChain } from "wagmi/actions";
import { useWalletKit } from "@/components/providers/Web3Provider";
import PepeButton from "./PepeButton";
import Link from "next/link";
import { getActiveChain } from "@/config/chains";
import toast from "react-hot-toast";

export default function WalletConnectButton() {
  const {} = useWalletKit();
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const config = useConfig();
  const targetChainId = getActiveChain().id;
  const publicClient = usePublicClient();
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);

  // Attempt to switch chain when connected but on wrong network
  useEffect(() => {
    const attemptNetworkSwitch = async () => {
      if (isConnected && address && chainId !== targetChainId) {
        try {
          setIsSwitchingChain(true);
          console.log(`Switching from chain ${chainId} to ${targetChainId}`);
          await switchChain(config, { chainId: targetChainId });
          toast.success(`Connected to ${getActiveChain().name}`);
        } catch (error) {
          console.error("Failed to switch network:", error);
          toast.error("Please switch to the BasedAI network in your wallet");
        } finally {
          setIsSwitchingChain(false);
        }
      }
    };

    attemptNetworkSwitch();
  }, [address, chainId, config, targetChainId, isConnected]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Copy address to clipboard
  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setDropdownOpen(false);
      toast.success("Address copied to clipboard");
    }
  };

  // Handle connect button click
  const handleConnect = async () => {
    if (isConnecting) return;

    try {
      console.log("Attempting to connect...");
      setIsConnecting(true);
      connect({ connector: injected() });
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      toast.error("Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle disconnect button click
  const handleDisconnect = async () => {
    // Only check if connected, don't care about initialization state for disconnect
    if (!isConnected) {
      console.log("Not connected, returning early");
      return;
    }

    try {
      await disconnect();
      setDropdownOpen(false);
      toast.success("Wallet disconnected");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      toast.error("Failed to disconnect wallet");
    }
  };

  // Handle wallet button click when connected
  const handleWalletClick = () => {
    if (isConnected) {
      setDropdownOpen(!dropdownOpen);
    } else {
      handleConnect();
    }
  };

  // Network status display
  const getNetworkStatus = () => {
    if (!isConnected) return null;

    const isCorrectNetwork = chainId === targetChainId;

    return (
      <div className="px-4 py-2 border-t border-blue-800">
        <div className="flex items-center">
          <span
            className={`inline-block w-2 h-2 rounded-full mr-2 ${
              isCorrectNetwork ? "bg-green-400" : "bg-red-400"
            } animate-pulse`}
          ></span>
          <span
            className={`text-xs ${
              isCorrectNetwork ? "text-green-300" : "text-red-300"
            }`}
          >
            {isCorrectNetwork
              ? `Connected to ${publicClient?.chain?.name || "BasedAI"}`
              : "Wrong network - click to switch"}
          </span>
        </div>
      </div>
    );
  };

  // Button content based on connection state
  const buttonContent = () => {
    if (isConnecting || isSwitchingChain) {
      return (
        <span className="flex items-center">
          <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-cyan-200 rounded-full mr-2" />
          {isSwitchingChain ? "Switching Network..." : "Connecting..."}
        </span>
      );
    }

    if (isConnected && address) {
      const isCorrectNetwork = chainId === targetChainId;
      return (
        <span className="flex items-center">
          <span
            className={`inline-block w-2 h-2 rounded-full mr-2 ${
              isCorrectNetwork ? "bg-cyan-400" : "bg-red-400"
            } animate-pulse`}
          ></span>
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
    <div className="relative" ref={dropdownRef}>
      <PepeButton
        variant={isConnected ? "outline" : "primary"}
        onClick={handleWalletClick}
        disabled={isConnecting || isSwitchingChain}
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

      {/* Dropdown Menu */}
      {dropdownOpen && isConnected && (
        <div className="absolute right-0 mt-2 w-56 bg-blue-900/95 backdrop-blur-sm rounded-lg shadow-lg border border-blue-700/50 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-800">
            <p className="text-sm text-blue-300">Connected Wallet</p>
            <p className="text-sm font-medium text-white truncate mt-1">
              {formatAddress(address || "")}
            </p>
          </div>

          {/* Display network status */}
          {getNetworkStatus()}

          <div className="py-1">
            <Link
              href="/my-nfts"
              className="flex items-center px-4 py-2 text-sm text-cyan-100 hover:bg-blue-800/50 transition-colors"
              onClick={() => setDropdownOpen(false)}
            >
              <svg
                className="mr-2 h-5 w-5 text-cyan-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              My NFTs
            </Link>

            {/* <Link
              href="/profile"
              className="flex items-center px-4 py-2 text-sm text-cyan-100 hover:bg-blue-800/50 transition-colors"
              onClick={() => setDropdownOpen(false)}
            >
              <svg
                className="mr-2 h-5 w-5 text-cyan-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Profile
            </Link> */}

            <button
              onClick={copyAddress}
              className="flex w-full items-center px-4 py-2 text-sm text-cyan-100 hover:bg-blue-800/50 transition-colors"
            >
              <svg
                className="mr-2 h-5 w-5 text-cyan-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy Address
            </button>
          </div>

          <div className="border-t border-blue-800">
            <button
              onClick={handleDisconnect}
              className="flex w-full items-center px-4 py-2 text-sm text-red-300 hover:bg-red-900/30 transition-colors"
            >
              <svg
                className="mr-2 h-5 w-5 text-red-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

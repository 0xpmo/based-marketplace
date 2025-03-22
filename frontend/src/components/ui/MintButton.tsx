"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface MintButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

export default function MintButton({
  onClick,
  disabled = false,
  loading = false,
  children,
  className = "",
}: MintButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`
        group relative overflow-hidden px-8 py-3 rounded-lg font-semibold
        bg-gradient-to-r from-blue-600 to-cyan-500 
        border border-cyan-600 text-white
        disabled:opacity-50 disabled:cursor-not-allowed
        shadow-lg shadow-blue-900/30
        transition-all duration-300
        ${className}
      `}
    >
      {/* Wave overlay effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -bottom-1 left-0 right-0 h-16 opacity-30 group-hover:opacity-50 transition-opacity">
          <svg
            className="absolute bottom-0 w-full"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              fill="#ffffff"
              opacity=".8"
              className="animate-[wave_10s_ease-in-out_infinite]"
            ></path>
          </svg>
        </div>

        {/* Animated bubbles */}
        <div
          className="absolute rounded-full bg-white/30 z-10"
          style={{
            width: "8px",
            height: "8px",
            left: "15%",
            bottom: "0%",
            animation: "mint-bubble-rise 3s infinite ease-in-out",
          }}
        />
        <div
          className="absolute rounded-full bg-white/30 z-10"
          style={{
            width: "10px",
            height: "10px",
            left: "40%",
            bottom: "0%",
            animation: "mint-bubble-rise 2.5s infinite ease-in-out 0.5s",
          }}
        />
        <div
          className="absolute rounded-full bg-white/30 z-10"
          style={{
            width: "6px",
            height: "6px",
            left: "75%",
            bottom: "0%",
            animation: "mint-bubble-rise 3.5s infinite ease-in-out 1s",
          }}
        />
      </div>

      {/* Button content with loading state */}
      <div className="relative z-10 flex items-center justify-center">
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
        ) : null}
        <span>{children}</span>
      </div>

      {/* Global animation styles */}
      <style jsx global>{`
        @keyframes mint-bubble-rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          20% {
            opacity: 0.7;
          }
          80% {
            opacity: 0.2;
          }
          100% {
            transform: translateY(-40px) translateX(5px) scale(0.8);
            opacity: 0;
          }
        }
      `}</style>
    </motion.button>
  );
}

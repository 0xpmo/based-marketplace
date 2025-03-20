// frontend/src/components/effects/PepeConfetti.tsx
"use client";

import { useEffect, useState } from "react";
import ReactConfetti from "react-confetti";

interface PepeConfettiProps {
  trigger: boolean;
  duration?: number;
}

export default function PepeConfetti({
  trigger,
  duration = 5000,
}: PepeConfettiProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Set dimensions to window size
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // Handle window resize
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (trigger) {
      setShowConfetti(true);

      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, duration);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [trigger, duration]);

  // Custom Pepe-themed confetti colors
  const colors = [
    "#16a34a", // pepe-600
    "#22c55e", // pepe-500
    "#4ade80", // pepe-400
    "#86efac", // pepe-300
    "#bbf7d0", // pepe-200
  ];

  if (!showConfetti) return null;

  return (
    <ReactConfetti
      width={dimensions.width}
      height={dimensions.height}
      recycle={false}
      numberOfPieces={200}
      gravity={0.3}
      colors={colors}
    />
  );
}

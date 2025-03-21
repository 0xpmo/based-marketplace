// frontend/src/components/ui/PepeButton.tsx
import React from "react";
import { motion } from "framer-motion";

interface PepeButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  icon?: React.ReactNode;
}

export default function PepeButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  fullWidth = false,
  type = "button",
  icon,
}: PepeButtonProps) {
  // Base classes
  const baseClasses =
    "relative inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2";

  // Size classes
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  // Variant classes
  const variantClasses = {
    primary:
      "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20",
    secondary:
      "bg-green-200 hover:bg-green-300 text-green-800 shadow-lg shadow-green-200/20",
    outline: "border-2 border-green-500 text-green-500 hover:bg-green-50",
    ghost: "text-green-600 hover:bg-green-50",
  };

  // Disabled classes
  const disabledClasses = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  // Width classes
  const widthClasses = fullWidth ? "w-full" : "";

  return (
    <motion.button
      type={type}
      onClick={disabled ? undefined : onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${widthClasses} ${className}`}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      disabled={disabled}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </motion.button>
  );
}

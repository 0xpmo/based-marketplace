// components/nfts/NFTPropertiesSection.tsx
import { motion } from "framer-motion";

interface Attribute {
  trait_type: string;
  value: string | number;
}

interface NFTPropertiesSectionProps {
  attributes?: Attribute[];
}

const NFTPropertiesSection = ({ attributes }: NFTPropertiesSectionProps) => {
  // Skip rendering if no attributes
  if (!attributes || attributes.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="bg-blue-900/30 border border-blue-800/30 rounded-xl p-6 shadow-lg mt-8 backdrop-blur-sm"
    >
      <h2 className="text-lg font-semibold mb-4 flex items-center text-blue-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
        Properties
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {attributes.map((attribute, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 * index }}
            className="bg-blue-950/50 border border-blue-800/30 rounded-lg p-3 text-center hover:border-blue-500/50 transition-colors group relative"
            title={`${attribute.trait_type}: ${attribute.value.toString()}`}
          >
            <div className="text-xs text-blue-400 uppercase mb-1 font-semibold break-words">
              {attribute.trait_type}
            </div>
            <div className="font-semibold text-blue-100 break-words">
              {attribute.value.toString()}
            </div>
            {/* Tooltip that appears on hover */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-blue-900 text-blue-100 text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
              {attribute.trait_type}: {attribute.value.toString()}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default NFTPropertiesSection;

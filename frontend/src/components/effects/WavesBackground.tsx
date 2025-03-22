import { motion } from "framer-motion";

interface WavesBackgroundProps {
  className?: string;
  bubbleCount?: number;
}

export default function WavesBackground({
  className = "",
  bubbleCount = 8,
}: WavesBackgroundProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden z-0 ${className}`}>
      {/* Static Wave SVGs */}
      <svg
        className="absolute bottom-0 w-full"
        viewBox="0 0 1440 320"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="#0c4a6e"
          fillOpacity="0.6"
          d="M0,288L48,272C96,256,192,224,288,197.3C384,171,480,149,576,165.3C672,181,768,235,864,250.7C960,267,1056,245,1152,224C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        ></path>
        <path
          fill="#0369a1"
          fillOpacity="0.4"
          d="M0,160L48,181.3C96,203,192,245,288,261.3C384,277,480,267,576,229.3C672,192,768,128,864,117.3C960,107,1056,149,1152,181.3C1248,213,1344,235,1392,245.3L1440,256L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        ></path>
      </svg>

      {/* Animated bubbles */}
      {[...Array(bubbleCount)].map((_, i) => {
        const size = Math.floor(Math.random() * 40) + 10;
        const duration = Math.floor(Math.random() * 8) + 6;
        const delay = Math.random() * 2;
        const leftPos = Math.random() * 90;

        return (
          <motion.div
            key={i}
            className="absolute bottom-0 rounded-full bg-white/20 z-0"
            style={{
              width: size,
              height: size,
              left: `${leftPos}%`,
            }}
            initial={{ y: 100, opacity: 0 }}
            animate={{
              y: -500,
              opacity: [0, 0.7, 0],
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              delay: delay,
              ease: "linear",
            }}
          />
        );
      })}
    </div>
  );
}

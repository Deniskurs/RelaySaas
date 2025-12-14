import { motion } from "framer-motion";

/**
 * AnimatedEllipsis - Animated "..." dots for loading states
 *
 * Creates a typing-style animation with three dots that fade in sequence
 */
export default function AnimatedEllipsis({ className = "" }) {
  return (
    <span className={`inline-flex ml-0.5 ${className}`}>
      <motion.span
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
      >
        .
      </motion.span>
      <motion.span
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
      >
        .
      </motion.span>
      <motion.span
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
      >
        .
      </motion.span>
    </span>
  );
}

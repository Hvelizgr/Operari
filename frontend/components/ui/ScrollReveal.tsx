'use client';
import { motion } from 'framer-motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  width?: 'fit-content' | '100%';
  delay?: number;
  className?: string;
}

export default function ScrollReveal({
  children,
  width = 'fit-content',
  delay = 0,
  className = '',
}: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      style={{ width }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

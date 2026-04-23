'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="from-primary-500 via-primary fixed left-0 right-0 top-0 z-50 h-1 origin-left bg-gradient-to-r to-pink-500"
      style={{ scaleX }}
    />
  );
}

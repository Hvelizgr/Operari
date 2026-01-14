"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export default function Card({ children, className = "", hover = true }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hover ? { y: -8, scale: 1.02 } : {}}
      className={`bg-white rounded-xl shadow-lg p-6 border border-gray-100 transition-shadow duration-300 ${
        hover ? "hover:shadow-2xl hover:border-gray-200" : ""
      } ${className}`}
      style={{ willChange: hover ? "transform" : "auto" }}
    >
      {children}
    </motion.div>
  );
}

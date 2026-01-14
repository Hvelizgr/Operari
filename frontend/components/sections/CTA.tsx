"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import SignUpModal from "@/components/ui/SignUpModal";

export default function CTA() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 -z-10" />

        <motion.div
          className="absolute inset-0 -z-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-primary-300 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 0.5, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </motion.div>

        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-20 animate-pulse" />

            <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500" />

              <div className="px-6 py-16 sm:px-12 sm:py-20 lg:py-24 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-100 to-purple-100 rounded-full mb-6">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold text-primary-700">
                      10,000+ teams already automated
                    </span>
                  </div>

                  <h2 className="text-4xl md:text-6xl font-bold mb-6">
                    <span className="text-gray-900">Ready to Automate </span>
                    <span className="bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Your Workflow?
                    </span>
                  </h2>

                  <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                    Build your first automation in under 5 minutes. No credit card required.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8"
                >
                  <motion.button
                    onClick={() => setIsModalOpen(true)}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="group relative px-8 py-4 bg-gradient-to-r from-primary-600 to-purple-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600"
                      initial={{ x: "100%" }}
                      whileHover={{ x: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    <span className="relative flex items-center gap-2">
                      Start Building Free
                      <motion.svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </motion.svg>
                    </span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 text-lg font-semibold text-gray-700 hover:text-primary-600 transition-colors flex items-center gap-2"
                  >
                    Watch Demo
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </motion.button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600"
                >
                  {[
                    { icon: "✓", text: "SOC 2 compliant" },
                    { icon: "✓", text: "99.9% uptime" },
                    { icon: "✓", text: "Cancel anytime" },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xs font-bold">
                        {item.icon}
                      </div>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 }}
                  className="mt-12 pt-8 border-t border-gray-200"
                >
                  <p className="text-gray-500 text-sm mb-4">
                    Trusted by leading companies worldwide
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-8 opacity-50">
                    {["Acme", "TechCo", "StartupXYZ", "GlobalInc", "Innovate"].map(
                      (company) => (
                        <div
                          key={company}
                          className="text-gray-400 font-bold text-lg"
                        >
                          {company}
                        </div>
                      )
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <SignUpModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

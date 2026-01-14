"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface Step {
  id: number;
  title: string;
  icon: string;
  visual: React.ReactNode;
}

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps: Step[] = [
    {
      id: 1,
      title: "Link the tools you already use",
      icon: "🔌",
      visual: (
        <div className="grid grid-cols-3 gap-3">
          {["💙", "💚", "🧡"].map((emoji, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: i * 0.2, type: "spring", bounce: 0.5 }}
              className="w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center text-3xl"
            >
              {emoji}
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      id: 2,
      title: "Drag and connect nodes visually",
      icon: "⚙️",
      visual: (
        <div className="relative w-full h-32">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: i * 60, opacity: 1 }}
              transition={{ delay: i * 0.2, type: "spring" }}
              className="absolute top-8"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-purple-500 rounded-lg shadow-lg" />
              {i < 2 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.2 + 0.3 }}
                  className="absolute left-12 top-6 w-12 h-0.5 bg-gradient-to-r from-primary-400 to-purple-500 origin-left"
                />
              )}
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      id: 3,
      title: "Watch it run, then scale to production",
      icon: "🚀",
      visual: (
        <div className="relative w-full h-32 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.6 }}
            className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full shadow-lg flex items-center justify-center text-4xl"
          >
            ✓
          </motion.div>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                x: Math.cos((i * Math.PI) / 4) * 60,
                y: Math.sin((i * Math.PI) / 4) * 60,
              }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
              className="absolute w-3 h-3 bg-green-400 rounded-full"
            />
          ))}
        </div>
      ),
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setProgress(0);
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + (100 / 30);
      });
    }, 100);

    return () => clearInterval(progressInterval);
  }, [activeStep]);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600">Simple. Fast. Powerful.</p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <div className="relative">
            <div className="flex justify-between mb-12 relative">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 -z-10" />
              <motion.div
                className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-primary-500 to-purple-500 -translate-y-1/2 -z-10"
                initial={{ width: 0 }}
                animate={{
                  width: `${(activeStep / (steps.length - 1)) * 100}%`,
                }}
                transition={{ duration: 0.6 }}
              />

              {steps.map((step, index) => (
                <motion.button
                  key={step.id}
                  onClick={() => setActiveStep(index)}
                  className="relative z-10 flex flex-col items-center gap-3 group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-300 ${
                      activeStep === index
                        ? "bg-gradient-to-br from-primary-500 to-purple-500 text-white shadow-lg shadow-primary-500/50"
                        : activeStep > index
                        ? "bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg"
                        : "bg-white text-gray-400 border-2 border-gray-200"
                    }`}
                    animate={
                      activeStep === index
                        ? { scale: [1, 1.1, 1] }
                        : {}
                    }
                    transition={
                      activeStep === index
                        ? { duration: 0.6, repeat: Infinity, repeatDelay: 2 }
                        : {}
                    }
                  >
                    {activeStep > index ? "✓" : step.id}
                  </motion.div>

                  <span
                    className={`text-sm font-semibold transition-colors hidden md:block ${
                      activeStep === index
                        ? "text-primary-600"
                        : "text-gray-500"
                    }`}
                  >
                    {step.icon} {step.title}
                  </span>

                  {activeStep === index && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary-500 rounded-full"
                    />
                  )}
                </motion.button>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 border border-gray-100 min-h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                    className="text-6xl mb-6"
                  >
                    {steps[activeStep].icon}
                  </motion.div>

                  <h3 className="text-3xl font-bold text-gray-900 mb-8">
                    {steps[activeStep].title}
                  </h3>

                  <div className="w-full max-w-md mb-8">
                    {steps[activeStep].visual}
                  </div>

                  <div className="w-full max-w-md bg-gray-100 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>

                  <div className="flex gap-2 mt-8">
                    {steps.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveStep(index)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          activeStep === index
                            ? "bg-primary-500 w-8"
                            : "bg-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              { icon: "⚡", label: "5 min", text: "Setup" },
              { icon: "🎯", label: "Zero", text: "Code Required" },
              { icon: "♾️", label: "Unlimited", text: "Possibilities" },
            ].map((item, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 text-center"
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="text-2xl font-bold text-primary-600 mb-1">
                  {item.label}
                </div>
                <div className="text-sm text-gray-600">{item.text}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

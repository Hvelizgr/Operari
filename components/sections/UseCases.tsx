"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Card from "@/components/ui/Card";

interface UseCase {
  id: string;
  title: string;
  icon: string;
  description: string;
  benefits: string[];
  stats: { label: string; value: string }[];
  color: string;
}

export default function UseCases() {
  const [activeTab, setActiveTab] = useState("businesses");

  const useCases: Record<string, UseCase> = {
    businesses: {
      id: "businesses",
      title: "Operations & Business Teams",
      icon: "🏢",
      description: "Automate cross-system workflows without developer resources",
      benefits: [
        "Connect CRM, marketing, and sales tools in minutes",
        "Eliminate manual data entry across departments",
        "Scale operations without increasing headcount",
      ],
      stats: [
        { label: "Time Saved", value: "75%" },
        { label: "Error Reduction", value: "90%" },
        { label: "ROI", value: "300%" },
      ],
      color: "from-blue-500 to-cyan-500",
    },
    developers: {
      id: "developers",
      title: "Engineering Teams",
      icon: "👨‍💻",
      description: "Ship integrations faster with visual tools and code control",
      benefits: [
        "Build API workflows without writing boilerplate",
        "Debug with real-time execution visualization",
        "Version control workflows like you version code",
      ],
      stats: [
        { label: "API Calls", value: "1M+" },
        { label: "Integrations", value: "400+" },
        { label: "Uptime", value: "99.9%" },
      ],
      color: "from-purple-500 to-pink-500",
    },
    teams: {
      id: "teams",
      title: "Platform & DevOps",
      icon: "👥",
      description: "Orchestrate complex systems with visual execution clarity",
      benefits: [
        "Manage data pipelines and microservice workflows",
        "Monitor execution across environments in real-time",
        "Collaborate with role-based access and audit logs",
      ],
      stats: [
        { label: "Team Size", value: "Unlimited" },
        { label: "Workflows", value: "1000+" },
        { label: "Security", value: "SOC 2" },
      ],
      color: "from-orange-500 to-red-500",
    },
  };

  const currentCase = useCases[activeTab];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            Built for Every Team
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            No matter your role, NanoFlow adapts to your workflow
          </motion.p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-gray-100 rounded-xl p-1.5 gap-2">
            {Object.values(useCases).map((useCase) => (
              <motion.button
                key={useCase.id}
                onClick={() => setActiveTab(useCase.id)}
                className={`relative px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                  activeTab === useCase.id
                    ? "text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                whileHover={{ scale: activeTab === useCase.id ? 1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {activeTab === useCase.id && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute inset-0 bg-gradient-to-r ${useCase.color} rounded-lg shadow-lg`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <span className="text-xl">{useCase.icon}</span>
                  <span className="hidden sm:inline">{useCase.title}</span>
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-6"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className={`w-16 h-16 bg-gradient-to-br ${currentCase.color} rounded-2xl flex items-center justify-center text-3xl shadow-lg`}
                    >
                      {currentCase.icon}
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900">
                      {currentCase.title}
                    </h3>
                  </div>
                  <p className="text-lg text-gray-600 mb-6">
                    {currentCase.description}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h4 className="text-xl font-semibold text-gray-900 mb-4">
                    Key Benefits
                  </h4>
                  <ul className="space-y-3">
                    {currentCase.benefits.map((benefit, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <svg
                          className={`w-6 h-6 mt-0.5 flex-shrink-0 bg-gradient-to-br ${currentCase.color} rounded-full p-1 text-white`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-gray-700">{benefit}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </div>

              <div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 h-full"
                >
                  <h4 className="text-xl font-semibold text-gray-900 mb-6">
                    Performance Metrics
                  </h4>
                  <div className="grid grid-cols-1 gap-6">
                    {currentCase.stats.map((stat, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                        className="bg-white rounded-xl p-6 shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 font-medium">
                            {stat.label}
                          </span>
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              delay: 0.6 + index * 0.1,
                              type: "spring",
                              bounce: 0.5,
                            }}
                            className={`text-4xl font-bold bg-gradient-to-r ${currentCase.color} bg-clip-text text-transparent`}
                          >
                            {stat.value}
                          </motion.span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mt-8"
                  >
                    <div className="bg-white rounded-xl p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`w-10 h-10 bg-gradient-to-br ${currentCase.color} rounded-lg flex items-center justify-center`}
                        >
                          <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                        </div>
                        <h5 className="font-semibold text-gray-900">
                          Quick Start
                        </h5>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Get started in minutes with our pre-built templates
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`w-full py-3 px-4 bg-gradient-to-r ${currentCase.color} text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300`}
                      >
                        Explore Templates
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {[
                {
                  title: "Easy Setup",
                  description: "Get started in under 5 minutes",
                  icon: "⚡",
                },
                {
                  title: "24/7 Support",
                  description: "Expert help whenever you need it",
                  icon: "💬",
                },
                {
                  title: "Secure & Compliant",
                  description: "Enterprise-grade security built-in",
                  icon: "🔒",
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                >
                  <Card hover={false}>
                    <div className="text-center">
                      <div className="text-3xl mb-3">{feature.icon}</div>
                      <h5 className="font-semibold text-gray-900 mb-2">
                        {feature.title}
                      </h5>
                      <p className="text-sm text-gray-600">
                        {feature.description}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

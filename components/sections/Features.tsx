"use client";

import { motion } from "framer-motion";
import Card from "@/components/ui/Card";

export default function Features() {
  const features = [
    {
      title: "Visual Builder",
      description:
        "Drag nodes. Connect flows. No code required.",
      icon: "🎨",
    },
    {
      title: "400+ Integrations",
      description:
        "Connect APIs, databases, and services. Pre-built or custom.",
      icon: "🔌",
    },
    {
      title: "Real-time Execution",
      description:
        "See exactly where data moves. Debug by watching, not guessing.",
      icon: "⚡",
    },
    {
      title: "Conditional Logic",
      description:
        "If/else branches, loops, data transforms. Handle complex workflows.",
      icon: "🧠",
    },
    {
      title: "Production Security",
      description:
        "SOC 2 compliant. GDPR ready. Encrypted at rest and in transit.",
      icon: "🔒",
    },
    {
      title: "Team Infrastructure",
      description:
        "Version control. Role-based access. Audit logs. Deploy together.",
      icon: "👥",
    },
  ];

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            What It Does
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            Infrastructure for technical automation workflows
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

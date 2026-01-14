"use client";

import { motion } from "framer-motion";
import Card from "@/components/ui/Card";

export default function Testimonials() {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "CTO at TechCorp",
      content:
        "We ship integrations 5x faster. The visual execution makes debugging trivial. Reduced our automation maintenance time by 70%.",
      avatar: "SC",
    },
    {
      name: "Marcus Rodriguez",
      role: "Engineering Manager at StartupXYZ",
      content:
        "Connected 12 internal APIs in two days. Version control workflows like code. Zero production incidents since migration.",
      avatar: "MR",
    },
    {
      name: "Emily Watson",
      role: "Platform Lead at GlobalCo",
      content:
        "Real-time execution visibility changed how we debug. Team went from 3 weeks to 3 days on complex pipeline builds.",
      avatar: "EW",
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            In Production
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            Engineering teams running workflows on NanoFlow
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
            >
              <Card hover={false}>
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold mr-4">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 italic">&quot;{testimonial.content}&quot;</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";

export default function Integrations() {
  const integrations = [
    { name: "Slack", color: "bg-purple-500" },
    { name: "GitHub", color: "bg-gray-800" },
    { name: "Google", color: "bg-blue-500" },
    { name: "Notion", color: "bg-black" },
    { name: "Stripe", color: "bg-indigo-600" },
    { name: "Salesforce", color: "bg-sky-500" },
    { name: "Shopify", color: "bg-green-600" },
    { name: "Airtable", color: "bg-yellow-500" },
    { name: "Twilio", color: "bg-red-500" },
    { name: "HubSpot", color: "bg-orange-500" },
    { name: "Mailchimp", color: "bg-yellow-400" },
    { name: "Zendesk", color: "bg-teal-600" },
  ];

  return (
    <section id="integrations" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            400+ Integrations
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            Connect APIs, databases, SaaS tools, and webhooks
          </motion.p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {integrations.map((integration, index) => (
            <motion.div
              key={integration.name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 100 }}
              whileHover={{ scale: 1.15, rotate: [0, -5, 5, 0], y: -5 }}
              className="relative group cursor-pointer"
            >
              <div
                className={`${integration.color} aspect-square rounded-xl shadow-lg flex items-center justify-center text-white font-bold text-sm transition-all duration-300 group-hover:shadow-2xl`}
                style={{ willChange: "transform" }}
              >
                {integration.name}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-12"
        >
          <a
            href="#"
            className="text-primary-600 font-semibold hover:text-primary-700 transition-colors"
          >
            View all 400+ integrations →
          </a>
        </motion.div>
      </div>
    </section>
  );
}

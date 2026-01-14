"use client";

import { motion } from "framer-motion";

export default function Footer() {
  const footerLinks = {
    Product: ["Features", "Integrations", "Pricing", "Changelog"],
    Company: ["About", "Blog", "Careers", "Contact"],
    Resources: ["Documentation", "Guides", "API Reference", "Community"],
    Legal: ["Privacy", "Terms", "Security", "Compliance"],
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="col-span-2 md:col-span-1"
          >
            <div className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent mb-4">
              NanoFlow
            </div>
            <p className="text-sm text-gray-400">
              Build powerful automation workflows with ease.
            </p>
          </motion.div>

          {Object.entries(footerLinks).map(([category, links], index) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
            >
              <h3 className="font-semibold text-white mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm hover:text-primary-400 transition-colors relative inline-block group"
                    >
                      {link}
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-primary-400 transition-all duration-300 group-hover:w-full" />
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center"
        >
          <p className="text-sm text-gray-400">
            © 2024 NanoFlow. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            {["Twitter", "GitHub", "LinkedIn"].map((social) => (
              <motion.a
                key={social}
                href="#"
                whileHover={{ scale: 1.1, y: -2 }}
                className="text-gray-400 hover:text-primary-400 transition-colors"
              >
                {social}
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

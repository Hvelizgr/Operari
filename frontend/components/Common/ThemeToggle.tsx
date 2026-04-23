'use client';

import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useAccessibility } from '../../context/AccessibilityContext';

interface ThemeToggleProps {
  lang: 'en' | 'es';
}

export default function ThemeToggle({ lang }: ThemeToggleProps) {
  const { highContrast, toggleHighContrast } = useAccessibility();

  const content = {
    en: {
      highContrast: 'High Contrast Mode',
      normal: 'Normal Mode',
      toggle: 'Toggle contrast mode',
    },
    es: {
      highContrast: 'Modo Alto Contraste',
      normal: 'Modo Normal',
      toggle: 'Cambiar modo de contraste',
    },
  };

  const text = content[lang] || content['en'];

  return (
    <motion.button
      onClick={toggleHighContrast}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-lg transition-colors ${
        highContrast
          ? 'border-yellow-600 bg-yellow-500 text-black hover:bg-yellow-400'
          : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
      } `}
      aria-label={text.toggle}
      aria-pressed={highContrast}
      title={highContrast ? text.normal : text.highContrast}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      {highContrast ? <Eye size={16} /> : <EyeOff size={16} />}
      <span className="hidden sm:inline">{highContrast ? text.highContrast : text.normal}</span>
    </motion.button>
  );
}

'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface CopyYamlButtonProps {
  yaml: string;
  copyLabel: string;
  copiedLabel: string;
}

export function CopyYamlButton({ yaml, copyLabel, copiedLabel }: CopyYamlButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API denied — fall back to a textarea selection
      const ta = document.createElement('textarea');
      ta.value = yaml;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // out of fallbacks; silently fail (rare)
      }
      document.body.removeChild(ta);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="border-border/70 bg-background/60 hover:bg-background/90 hover:border-primary/40 text-foreground/90 inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
    >
      {copied ? (
        <>
          <Check className="text-primary h-4 w-4" />
          {copiedLabel}
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          {copyLabel}
        </>
      )}
    </button>
  );
}

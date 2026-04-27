import * as Icons from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { createElement, useEffect, useState } from 'react';

import { storageRead, storageWrite } from '../lib/storage-compat';

export interface NodeType {
  id?: string;
  type: string;
  icon: React.ReactNode;
  label: { en: string; es: string };
  color: string;
  category: string;
  description?: { en: string; es: string };
  inputs?: string[] | any; // JSON from DB
  outputs?: string[] | any;
}

export function useNodeTypes() {
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNodes = async () => {
      // Try to load from localStorage first
      const cached = storageRead('operari-node-types');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Map icons for cached data
          const mappedCached = parsed.map((node: any) => {
            const IconComponent =
              (Icons as unknown as Record<string, LucideIcon>)[node.icon] || Icons.Box;
            return { ...node, icon: createElement(IconComponent, { size: 18 }) };
          });
          setNodeTypes(mappedCached);
          setLoading(false);
          // We still fetch in background to update cache
        } catch (e) {
          console.error('Error parsing cached node types', e);
        }
      }

      try {
        const res = await fetch('/api/node-types'); // Use proxy defined in next.config.ts
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        // Cache the raw data (without React elements)
        storageWrite('operari-node-types', JSON.stringify(data));

        const mappedNodes = data.map((node: any) => {
          // Resolve icon from string name
          const IconComponent =
            (Icons as unknown as Record<string, LucideIcon>)[node.icon] || Icons.Box;

          return {
            ...node,
            // Ensure defaults
            inputs: node.inputs || [],
            outputs: node.outputs || [],
            // Create React Element for the icon
            icon: createElement(IconComponent, { size: 18 }),
          };
        });

        setNodeTypes(mappedNodes);
      } catch (error) {
        console.error('Error fetching node types:', error);

        // Fallback to defaults if specific hardcoded types allow, otherwise empty
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, []);

  return { nodeTypes, loading };
}

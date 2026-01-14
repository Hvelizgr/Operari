
import { useState, useEffect, createElement } from 'react';
import * as Icons from 'lucide-react';
import { LucideIcon } from 'lucide-react';

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
            try {
                const res = await fetch('/api/node-types'); // Use proxy defined in next.config.ts
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();

                const mappedNodes = data.map((node: any) => {
                    // Resolve icon from string name
                    const IconComponent = (Icons as any)[node.icon] || Icons.Box;

                    return {
                        ...node,
                        // Ensure defaults
                        inputs: node.inputs || [],
                        outputs: node.outputs || [],
                        // Create React Element for the icon
                        icon: createElement(IconComponent, { size: 18 })
                    };
                });

                setNodeTypes(mappedNodes);
            } catch (error) {
                console.error('Error fetching node types:', error);
                // Fallback or empty? Let's leave empty and let component handle it
            } finally {
                setLoading(false);
            }
        };

        fetchNodes();
    }, []);

    return { nodeTypes, loading };
}

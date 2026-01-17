import useSWR from 'swr';
import { createElement } from 'react';
import dynamic from 'next/dynamic';
import { Box } from 'lucide-react';

// Dynamically import Lucide icons to avoid bundling the entire library
// In a real production app, you might want a curated map or a more robust dynamic loader
// This is a trade-off: much smaller initial bundle vs async icon loading
const IconMap: Record<string, any> = {
    // Common defaults to have instantly available
    Box,
};

function getIcon(iconName: string) {
    if (IconMap[iconName]) return IconMap[iconName];

    // Fallback for unknown icons or lazy loading logic could go here
    // For now, we default to Box to prevent crashes, or we could lazy load if we had a way to map strings to dynamic imports safely
    // Since we can't dynamic import arbitrary strings in webpack easily without a large context,
    // we will stick to a safe default if not found, or efficient mapping if we had a defined list.

    // NOTE: Loading *all* icons dynamically by string is tricky in webpack/nextjs without generating a map.
    // To solve the "import * as Icons" performance killer, we should ideally only import what we use.
    // Since the DB defines icons by string, we have to map them.
    // Ideally, this list should be generated or we accept that we only support a subset of icons.

    return Box;
}

// Helper to lazy load specific icons if we ever wanted to support the full set without the cost:
// const DynamicIcon = dynamic(() => import('lucide-react').then(mod => mod[iconName]))
// But dynamic() creates a component, not an icon function.

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

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useNodeTypes() {
    // SWR handles caching, revalidation, and deduping automatically
    const { data, error, isLoading } = useSWR('/api/node-types', fetcher, {
        revalidateOnFocus: false, // Don't refetch just because window focused
        dedupingInterval: 60000, // Dedupe requests for 1 minute
    });

    // We process the data to attach the icon components
    const nodeTypes: NodeType[] = data ? data.map((node: any) => {
        // If we want to support dynamic icons from the DB string, we need a smarter way than "import *"
        // For now, we use a default to stop the massive bundle bloat.
        // A better long-term fix is a mapping of allowed icons.

        // TEMPORARY: To fix the "import *" performance cliff, we are defaulting to Box.
        // If specific icons are critical, add them to IconMap above explicitly.
        // import { Activity, Zap, ... } from 'lucide-react'; 
        // IconMap = { Activity, Zap, ... };

        const IconComponent = getIcon(node.icon);

        return {
            ...node,
            inputs: node.inputs || [],
            outputs: node.outputs || [],
            icon: createElement(IconComponent, { size: 18 })
        };
    }) : [];

    return { nodeTypes, loading: isLoading, error };
}

import useSWR from 'swr';
import { createElement } from 'react';
import {
    Box, Globe, Database, MessageSquare, Mail,
    Calendar, Clock, Zap, GitBranch, Play,
    Cloud, Cpu, FileText, Layout, List, Users,
    Search, Terminal, Share2, Settings, Layers, Activity,
    Github, Sun, CreditCard, MessageCircle, BarChart, ShoppingCart
} from 'lucide-react';
import { safeFetcher } from './useSWRConfig';

export interface NodeType {
    id?: string;
    type: string;
    icon: React.ReactNode;
    label: { en: string; es: string };
    color: string;
    category: string;
    description?: { en: string; es: string };
    subtitle?: { en: string; es: string };
    inputs?: string[] | any;
    outputs?: string[] | any;
    properties?: any[];
}

const IconMap: Record<string, any> = {
    Box, Globe, Database, MessageSquare, Mail,
    Calendar, Clock, Zap, GitBranch, Play,
    Cloud, Cpu, FileText, Layout, List, Users,
    Search, Terminal, Share2, Settings, Layers, Activity,
    Github, Sun, CreditCard, MessageCircle, BarChart, ShoppingCart
};

export function useNodeTypes() {
    const { data, error, isLoading } = useSWR('/api/node-types', safeFetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
    });

    const getIconComponent = (node: any) => {
        const type = node.type.toLowerCase();
        const category = node.category.toLowerCase();

        if (type.includes('google') || type.includes('http')) return Globe;
        if (type.includes('openai') || type.includes('anthropic') || category.includes('ai') || type.includes('langchain')) return MessageSquare;
        if (type.includes('mail') || type.includes('sendgrid') || type.includes('gmail')) return Mail;
        if (type.includes('database') || type.includes('postgres') || type.includes('sql') || type.includes('mongodb') || type.includes('redis')) return Database;
        if (type.includes('slack') || type.includes('discord') || type.includes('telegram') || type.includes('message')) return MessageCircle;
        if (type.includes('aws') || type.includes('storage') || type.includes('s3') || type.includes('drive')) return Cloud;
        if (type.includes('weather') || type.includes('sun')) return Sun;
        if (type.includes('github') || type.includes('git')) return Github;
        if (type.includes('payment') || type.includes('stripe') || type.includes('billing')) return CreditCard;
        if (type.includes('shopify') || type.includes('shop') || type.includes('cart')) return ShoppingCart;
        if (type.includes('chart') || type.includes('stats') || type.includes('metrics')) return BarChart;
        if (category.includes('triggers') || type.includes('trigger')) return Play;
        if (category.includes('logic') || category.includes('flow') || type.includes('filter') || type.includes('if')) return GitBranch;
        if (type.includes('code') || type.includes('script') || type.includes('function') || type.includes('executable')) return Terminal;
        if (type.includes('sheet') || type.includes('csv') || type.includes('excel') || type.includes('pdf') || type.includes('file')) return FileText;
        if (type.includes('calendar')) return Calendar;
        if (type.includes('search')) return Search;
        if (type.includes('setting') || type.includes('config')) return Settings;
        if (type.includes('user') || type.includes('customer')) return Users;

        // Try mapping from DB icon string if provided
        if (node.icon) {
            const iconName = node.icon.charAt(0).toUpperCase() + node.icon.slice(1);
            if (IconMap[iconName]) return IconMap[iconName];
        }

        return Box;
    };

    const nodeTypes: NodeType[] = data ? (data as any[]).reduce((acc: NodeType[], node: any) => {
        // Skip if we already have this node type to prevent React key errors
        if (acc.find(t => t.type === node.type)) return acc;

        const IconComponent = getIconComponent(node);
        // Ensure color is a valid tailwind class or hex color
        let color = node.color || '#64748b'; // slate-500 hex
        const isHex = /^#([0-9A-F]{3}){1,2}$/i.test(color);
        const isRgb = /^rgb/.test(color);
        if (!isHex && !isRgb && !color.startsWith('bg-') && !color.includes('-')) {
            color = `bg-${color}`;
        }

        const category = (node.category || 'integrations').toLowerCase();

        acc.push({
            ...node,
            type: node.type,
            label: node.label || { en: node.displayName || node.name || node.type, es: node.displayName || node.name || node.type },
            description: node.description ? (typeof node.description === 'string' ? { en: node.description, es: node.description } : node.description) : undefined,
            subtitle: node.subtitle ? (typeof node.subtitle === 'string' ? { en: node.subtitle, es: node.subtitle } : node.subtitle) : undefined,
            category,
            color,
            inputs: node.inputs || [],
            outputs: node.outputs || [],
            properties: node.properties || [],
            icon: createElement(IconComponent, { size: 18 })
        });
        return acc;
    }, []) : [];

    return { nodeTypes, loading: isLoading, error };
}

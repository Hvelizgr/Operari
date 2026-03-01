'use client';

import { Card, CardBody, Input, Button, Chip, Spinner } from "@heroui/react";
import { Search, Box, ArrowRight, Zap, Database, Globe, Cpu, Cloud, Shield, Download, Star, Package, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../../utils/api";

interface CommunityNode {
    name: string;
    description: string;
    author: string;
    stars?: number;
    downloads?: number;
    version?: string;
    url?: string;
    source: 'github' | 'npm' | 'ncnodes';
}

const categories = [
    { id: 'all', label: 'All' },
    { id: 'popular', label: 'Popular' },
    { id: 'github', label: 'GitHub' },
    { id: 'npm', label: 'NPM' },
];

const getSourceIcon = (source: string) => {
    switch (source) {
        case 'github': return <Globe size={16} />;
        case 'npm': return <Package size={16} />;
        default: return <Box size={16} />;
    }
};

export default function NodesMarketplacePage() {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [nodes, setNodes] = useState<CommunityNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchNodes = async () => {
            setLoading(true);
            setError(null);
            try {
                let endpoint = '/api/community-nodes';
                if (selectedCategory === 'popular') {
                    endpoint = '/api/community-nodes/popular';
                } else if (selectedCategory === 'github') {
                    endpoint = '/api/community-nodes/github';
                } else if (selectedCategory === 'npm') {
                    endpoint = '/api/community-nodes/npm';
                }
                
                const params = new URLSearchParams();
                if (searchQuery) params.set('q', searchQuery);
                params.set('limit', '50');
                
                const response = await apiFetch(`${endpoint}?${params.toString()}`);
                setNodes(response.nodes || []);
            } catch (err) {
                setError('Failed to load community nodes');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        const debounce = setTimeout(fetchNodes, 300);
        return () => clearTimeout(debounce);
    }, [selectedCategory, searchQuery]);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen text-white">
            
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">
                        Community Nodes
                    </h1>
                    <p className="text-gray-400 max-w-xl text-lg font-light">
                        Discover and install community-built n8n nodes to extend your workflows.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Chip color="primary" variant="flat" size="sm">
                        {nodes.length} nodes
                    </Chip>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 sticky top-0 py-4 z-20 bg-black/50 backdrop-blur-xl -mx-8 px-8 border-b border-white/5">
                <Input
                    placeholder="Search community nodes..."
                    startContent={<Search className="text-gray-500" size={20} />}
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    classNames={{
                        input: "text-white",
                        inputWrapper: "bg-white/5 border-white/10 hover:border-white/20 h-12 rounded-xl group-data-[focus=true]:border-blue-500/50"
                    }}
                    className="w-full md:w-96"
                />
                
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`
                                px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                                ${selectedCategory === cat.id 
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                                    : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'}
                            `}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Spinner size="lg" color="primary" />
                </div>
            ) : error ? (
                <div className="text-center py-20 text-red-400">{error}</div>
            ) : nodes.length === 0 ? (
                <div className="text-center py-20 text-gray-500">No nodes found</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {nodes.map((node, idx) => (
                        <motion.div
                            key={`${node.name}-${idx}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: idx * 0.02 }}
                            whileHover={{ y: -5 }}
                            className="group relative"
                        >
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-3xl opacity-0 group-hover:opacity-30 blur-lg transition duration-500" />
                            
                            <Card className="h-full bg-[#09090b] border border-white/10 relative overflow-hidden rounded-3xl hover:border-white/20 transition-colors">
                                <CardBody className="p-6 flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-300 group-hover:bg-blue-500/20 group-hover:text-blue-400 group-hover:scale-110 transition-all duration-300">
                                            {getSourceIcon(node.source)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {node.stars && node.stars > 10 && (
                                                <div className="flex items-center gap-1 text-xs text-yellow-400">
                                                    <Star size={12} fill="currentColor" />
                                                    {node.stars}
                                                </div>
                                            )}
                                            <Chip size="sm" variant="flat" className="text-[10px]">
                                                {node.source}
                                            </Chip>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors truncate">{node.name}</h3>
                                        <p className="text-xs text-gray-500 mb-2">by {node.author || 'Unknown'}</p>
                                        <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 font-light">
                                            {node.description || 'No description available'}
                                        </p>
                                    </div>

                                    <div className="mt-auto pt-4 flex justify-between items-center border-t border-white/5">
                                        <span className="text-xs text-gray-600 font-mono">{node.version || 'latest'}</span>
                                        <div className="flex items-center gap-2">
                                            {node.downloads && (
                                                <div className="flex items-center gap-1 text-xs text-gray-500" title="Downloads">
                                                    <Download size={12} />
                                                    {node.downloads.toLocaleString()}
                                                </div>
                                            )}
                                            {node.url && (
                                                <a 
                                                    href={node.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-white hover:text-black transition-colors"
                                                    title="View on external site"
                                                >
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

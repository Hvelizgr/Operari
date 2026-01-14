'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Globe, Webhook, Zap, Play, Settings, X, Code2, Terminal } from 'lucide-react';
import type { content } from '../../content/en';

type EditorProps = {
    content: typeof content.editor;
};

const codeSnippets = {
    webhook: `// Webhook Configuration
export const config = {
  method: 'POST',
  path: '/v1/ingest',
  auth: 'bearer-token'
};`,
    transform: `export default async function transform(input: any) {
  // Pure TypeScript logic
  const refined = input.data.map(item => ({
    id: item.id,
    value: item.amount * 1.2, // Apply markup
    timestamp: new Date().toISOString()
  }));

  return refined;
}`,
    api: `import { axios } from '@nanoflow/http';

export async function sync(data: any) {
  const response = await axios.post(
    'https://api.crm.com/v3/leads',
    data,
    { headers: { timeout: 5000 } }
  );
  return response.data;
}`,
    db: `import { db } from '@nanoflow/postgres';

export async function save(record: any) {
  const result = await db
    .insert('transactions')
    .values(record)
    .returning('*');
    
  console.log(\`Saved record \${result.id}\`);
  return result;
}`
};

const Node = ({ icon: Icon, label, x, y, delay, color, isActive, onClick }: any) => (
    <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 10 }}
        whileInView={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay, ease: "backOut" }}
        viewport={{ once: true, margin: "-50px" }}
        onClick={onClick}
        className={`absolute w-56 bg-card/90 backdrop-blur-md border rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-3 flex items-center gap-4 group cursor-pointer transition-all z-10 
            ${isActive ? 'border-primary ring-2 ring-primary/20 bg-secondary/30 scale-105' : 'border-border/60 hover:border-primary/50 hover:ring-2 hover:ring-primary/10'}`}
        style={{ left: x, top: y }}
    >
        <div className={`p-2.5 rounded-lg ${color} text-white shadow-sm`}>
            <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-sm text-foreground/90">{label}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {isActive ? 'Editing' : 'Running'}
            </span>
        </div>

        {/* Port Indicators */}
        <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-background border-2 rounded-full transition-colors ${isActive ? 'border-primary' : 'border-border/60 group-hover:border-primary'}`} />
        <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-background border-2 rounded-full transition-colors ${isActive ? 'border-primary' : 'border-border/60 group-hover:border-primary'}`} />
    </motion.div>
);

const Connection = ({ start, end, delay }: any) => (
    <motion.svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.5, delay }}
        viewport={{ once: true }}
    >
        <path
            d={`M ${start.x} ${start.y} C ${start.x + 100} ${start.y}, ${end.x - 100} ${end.y}, ${end.x} ${end.y}`}
            fill="none"
            strokeWidth="2"
            className="stroke-border/40"
        />
        <motion.path
            d={`M ${start.x} ${start.y} C ${start.x + 100} ${start.y}, ${end.x - 100} ${end.y}, ${end.x} ${end.y}`}
            fill="none"
            stroke="url(#gradient-line)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay, ease: "easeInOut" }}
            viewport={{ once: true }}
        />
        <defs>
            <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
        </defs>
    </motion.svg>
);

export default function EditorSimulation({ content }: EditorProps) {
    const [activeNode, setActiveNode] = useState<string>('transform');

    // Auto cycle through nodes for demo
    useEffect(() => {
        const sequence = ['webhook', 'transform', 'api', 'db'];
        const interval = setInterval(() => {
            setActiveNode(current => {
                const idx = sequence.indexOf(current);
                return sequence[(idx + 1) % sequence.length];
            });
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const activeCode = codeSnippets[activeNode as keyof typeof codeSnippets];

    return (
        <section className="pt-32 pb-24 bg-gradient-to-b from-background via-muted/20 to-background overflow-hidden">
            <div className="container px-4">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{content.title}</h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">{content.description}</p>
                </div>

                <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto items-start">
                    {/* Visual Canvas - Top */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="relative rounded-xl border border-border/60 bg-background/50 shadow-xl backdrop-blur-sm overflow-hidden h-[420px]"
                    >
                        <div className="absolute inset-0 bg-muted/5">
                            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                        </div>

                        <div className="absolute inset-0 p-8 transform origin-top-left scale-[0.6] sm:scale-[0.8] md:scale-[0.85] lg:scale-[0.95]">
                            {/* Connection: Webhook -> Transform */}
                            <Connection start={{ x: 264, y: 190 }} end={{ x: 380, y: 90 }} delay={0.8} />

                            {/* Connection: Webhook -> API */}
                            <Connection start={{ x: 264, y: 190 }} end={{ x: 380, y: 290 }} delay={0.8} />

                            {/* Connection: Transform -> DB */}
                            <Connection start={{ x: 604, y: 90 }} end={{ x: 700, y: 190 }} delay={1.0} />

                            {/* Connection: API -> DB */}
                            <Connection start={{ x: 604, y: 290 }} end={{ x: 700, y: 190 }} delay={1.2} />

                            <Node icon={Webhook} label={content.nodes.webhook} x="40px" y="150px" delay={0.2} color="bg-orange-500"
                                isActive={activeNode === 'webhook'} onClick={() => setActiveNode('webhook')} />

                            <Node icon={Zap} label={content.nodes.transform} x="380px" y="50px" delay={0.4} color="bg-blue-500"
                                isActive={activeNode === 'transform'} onClick={() => setActiveNode('transform')} />

                            <Node icon={Globe} label={content.nodes.api} x="380px" y="250px" delay={0.6} color="bg-purple-500"
                                isActive={activeNode === 'api'} onClick={() => setActiveNode('api')} />

                            <Node icon={Database} label={content.nodes.db} x="700px" y="150px" delay={0.8} color="bg-green-500"
                                isActive={activeNode === 'db'} onClick={() => setActiveNode('db')} />
                        </div>
                    </motion.div>

                    {/* Code Editor Panel */}
                    <motion.div
                        initial={{ x: 20, opacity: 0 }}
                        whileInView={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="relative rounded-xl border border-border/60 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col h-[400px] lg:h-auto"
                    >
                        {/* Editor Tab Bar */}
                        <div className="h-10 border-b border-white/10 bg-zinc-900/50 flex items-center px-4 justify-between select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-blue-400"><Code2 size={14} /></span>
                                <span className="text-xs text-zinc-400 font-mono">
                                    {activeNode}.ts
                                </span>
                            </div>
                            <div className="flex gap-1.5 opacity-50">
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                            </div>
                        </div>

                        {/* Editor Content */}
                        <div className="flex-1 p-4 lg:p-6 font-mono text-sm text-zinc-300 overflow-hidden relative" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                            <div className="absolute left-0 top-0 bottom-0 w-12 bg-zinc-950/50 border-r border-white/5 flex flex-col items-end pr-3 pt-4 lg:pt-6 text-zinc-700 select-none">
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <div key={i}>{i + 1}</div>
                                ))}
                            </div>
                            <div className="ml-12 h-full">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeNode}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1.02 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <pre className="whitespace-pre-wrap font-mono">
                                            <code className="language-typescript">
                                                {activeCode.split('\n').map((line, i) => (
                                                    <div key={i}>
                                                        <span className="text-purple-400">{line.match(/^(import|export|const|return|async|function)/)?.[0]}</span>
                                                        <span>{line.replace(/^(import|export|const|return|async|function)/, '')}</span>
                                                    </div>
                                                ))}
                                            </code>
                                        </pre>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Logs Panel */}
                        <div className="h-32 border-t border-white/10 bg-black/20">
                            <div className="h-8 border-b border-white/5 bg-white/5 px-4 flex items-center gap-2 text-xs text-zinc-400 select-none">
                                <Terminal size={12} />
                                <span>Output</span>
                            </div>
                            <div className="p-3 font-mono text-xs">
                                <p className="text-zinc-500">{`> Compiling ${activeNode}.ts...`}</p>
                                <motion.div
                                    key={activeNode}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <p className="mt-1 text-emerald-400">{`✓ Build successful (45ms)`}</p>
                                    <p className="mt-1 text-blue-400">{`> Deployed to edge runner v2.1`}</p>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

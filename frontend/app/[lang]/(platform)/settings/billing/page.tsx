'use client';

import { Card, CardBody, CardHeader, Button, Chip, Slider, Divider, Progress, Spinner } from "@heroui/react";
import { CreditCard, CheckCircle, Zap, Shield, Users, ArrowUpRight, Check, Activity, Workflow, UsersRound, AlertTriangle } from "lucide-react";
import { useSubscription } from "@/context/SubscriptionContext";
import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api";
import { useAuthStore } from "@/context/AuthContext";

interface UsageData {
    plan: string;
    limits: {
        maxWorkflows: number;
        maxExecutionsPerMonth: number;
        maxNodesPerWorkflow: number;
        maxUsers: number;
        features: Record<string, boolean>;
    };
    usage: {
        workflows: { current: number; limit: number; percentage: number };
        users: { current: number; limit: number; percentage: number };
        executions: { current: number; limit: number; percentage: number };
    };
}

export default function BillingPage() {
    const { plan, setPlan } = useSubscription();
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);
    const { token } = useAuthStore();

    useEffect(() => {
        if (!token) return;

        const fetchUsage = async () => {
            try {
                const data = await apiFetch('/api/tenant/usage');
                setUsage(data);
            } catch (error) {
                console.error('Failed to fetch usage:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchUsage();
        const interval = setInterval(fetchUsage, 30000);
        return () => clearInterval(interval);
    }, [token]);

    const plans = [
        {
            id: 'student',
            name: 'Free / Student',
            price: '$0',
            period: '/month',
            description: 'Perfect for learning and small personal projects.',
            features: ['100 Executions/mo', 'Basic Nodes', 'Community Support', '1 User'],
            color: 'default'
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '$29',
            period: '/month',
            description: 'For professionals and freelancers scaling their workflows.',
            features: ['50,000 Executions/mo', 'All Integrations', 'Priority Support', '5 Users', 'API Access'],
            color: 'primary',
            popular: true
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: 'Custom',
            period: '',
            description: 'Full governance, security, and dedicated infrastructure.',
            features: ['Unlimited Executions', 'Audit Logs', 'SSO & SAML', 'Unlimited Users', 'Dedicated Success Manager', 'On-premise Option'],
            color: 'secondary'
        }
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 text-white min-h-screen">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Subscription & Billing</h1>
                    <p className="text-gray-400 mt-2">Manage your plan, payment methods, and invoices.</p>
                </div>
                <Button variant="bordered" startContent={<CreditCard size={16} />} className="text-white border-[#27272a] hover:bg-[#27272a]">
                    Manage Payment Methods
                </Button>
            </div>

            {/* Current Usage Dashboard */}
            {loading ? (
                <Card className="bg-[#18181b] border border-[#27272a]">
                    <CardBody className="p-8 flex items-center justify-center">
                        <Spinner size="lg" />
                    </CardBody>
                </Card>
            ) : usage ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Executions */}
                    <Card className={`bg-gradient-to-br border ${usage.usage.executions.percentage >= 80 ? 'from-red-900/20 to-orange-900/10 border-red-500/30' : 'from-blue-900/10 to-purple-900/10 border-blue-500/20'}`}>
                        <CardBody className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${usage.usage.executions.percentage >= 80 ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                                        <Activity size={20} className={usage.usage.executions.percentage >= 80 ? 'text-red-400' : 'text-blue-400'} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Executions</h3>
                                        <p className="text-xs text-gray-500">This month</p>
                                    </div>
                                </div>
                                {usage.usage.executions.percentage >= 80 && (
                                    <AlertTriangle size={18} className="text-red-400" />
                                )}
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-2xl font-bold">{usage.usage.executions.current.toLocaleString()}</span>
                                <span className="text-sm text-gray-400">/ {usage.usage.executions.limit === Infinity ? '∞' : usage.usage.executions.limit.toLocaleString()}</span>
                            </div>
                            <Progress 
                                value={usage.usage.executions.percentage} 
                                maxValue={100} 
                                color={usage.usage.executions.percentage >= 80 ? "danger" : "primary"} 
                                size="sm" 
                                className="w-full"
                                classNames={{
                                    track: "bg-[#27272a]",
                                    indicator: usage.usage.executions.percentage >= 80 ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-gradient-to-r from-blue-500 to-purple-500"
                                }}
                            />
                            <p className="text-xs text-gray-500 mt-2">{usage.usage.executions.percentage.toFixed(1)}% used</p>
                        </CardBody>
                    </Card>

                    {/* Workflows */}
                    <Card className={`bg-gradient-to-br border ${usage.usage.workflows.percentage >= 80 ? 'from-red-900/20 to-orange-900/10 border-red-500/30' : 'from-green-900/10 to-emerald-900/10 border-green-500/20'}`}>
                        <CardBody className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${usage.usage.workflows.percentage >= 80 ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                                        <Workflow size={20} className={usage.usage.workflows.percentage >= 80 ? 'text-red-400' : 'text-green-400'} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Workflows</h3>
                                        <p className="text-xs text-gray-500">Total created</p>
                                    </div>
                                </div>
                                {usage.usage.workflows.percentage >= 80 && (
                                    <AlertTriangle size={18} className="text-red-400" />
                                )}
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-2xl font-bold">{usage.usage.workflows.current}</span>
                                <span className="text-sm text-gray-400">/ {usage.usage.workflows.limit === Infinity ? '∞' : usage.usage.workflows.limit}</span>
                            </div>
                            <Progress 
                                value={usage.usage.workflows.percentage} 
                                maxValue={100} 
                                color={usage.usage.workflows.percentage >= 80 ? "danger" : "success"} 
                                size="sm" 
                                className="w-full"
                                classNames={{
                                    track: "bg-[#27272a]",
                                    indicator: usage.usage.workflows.percentage >= 80 ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-gradient-to-r from-green-500 to-emerald-500"
                                }}
                            />
                            <p className="text-xs text-gray-500 mt-2">{usage.usage.workflows.percentage.toFixed(1)}% used</p>
                        </CardBody>
                    </Card>

                    {/* Users */}
                    <Card className={`bg-gradient-to-br border ${usage.usage.users.percentage >= 80 ? 'from-red-900/20 to-orange-900/10 border-red-500/30' : 'from-purple-900/10 to-pink-900/10 border-purple-500/20'}`}>
                        <CardBody className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${usage.usage.users.percentage >= 80 ? 'bg-red-500/20' : 'bg-purple-500/20'}`}>
                                        <UsersRound size={20} className={usage.usage.users.percentage >= 80 ? 'text-red-400' : 'text-purple-400'} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Team Members</h3>
                                        <p className="text-xs text-gray-500">Active users</p>
                                    </div>
                                </div>
                                {usage.usage.users.percentage >= 80 && (
                                    <AlertTriangle size={18} className="text-red-400" />
                                )}
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-2xl font-bold">{usage.usage.users.current}</span>
                                <span className="text-sm text-gray-400">/ {usage.usage.users.limit === Infinity ? '∞' : usage.usage.users.limit}</span>
                            </div>
                            <Progress 
                                value={usage.usage.users.percentage} 
                                maxValue={100} 
                                color={usage.usage.users.percentage >= 80 ? "danger" : "secondary"} 
                                size="sm" 
                                className="w-full"
                                classNames={{
                                    track: "bg-[#27272a]",
                                    indicator: usage.usage.users.percentage >= 80 ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-gradient-to-r from-purple-500 to-pink-500"
                                }}
                            />
                            <p className="text-xs text-gray-500 mt-2">{usage.usage.users.percentage.toFixed(1)}% used</p>
                        </CardBody>
                    </Card>
                </div>
            ) : (
                <Card className="bg-[#18181b] border border-[#27272a]">
                    <CardBody className="p-8 text-center text-gray-400">
                        Failed to load usage data
                    </CardBody>
                </Card>
            )}

            {/* Plan Overview */}
            {usage && (
                <Card className="bg-[#18181b] border border-[#27272a]">
                    <CardBody className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/20 rounded-xl">
                                <Shield size={24} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Current Plan</p>
                                <p className="text-xl font-bold uppercase tracking-wider text-blue-400">{usage.plan}</p>
                            </div>
                        </div>
                        <div className="flex gap-6 text-center">
                            <div>
                                <p className="text-xs text-gray-500">Max Nodes/Workflow</p>
                                <p className="font-bold">{usage.limits.maxNodesPerWorkflow === Infinity ? '∞' : usage.limits.maxNodesPerWorkflow}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">SSO</p>
                                <p className="font-bold">{usage.limits.features.sso ? '✓' : '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Audit Logs</p>
                                <p className="font-bold">{usage.limits.features.auditLogs ? '✓' : '—'}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            )}

            <Divider className="bg-[#27272a]" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((p) => {
                    const isCurrent = plan === p.id;
                    return (
                        <Card 
                            key={p.id} 
                            className={`
                                relative border transition-all duration-300
                                ${isCurrent ? 'bg-[#18181b] border-blue-500 shadow-xl shadow-blue-900/10 scale-[1.02]' : 'bg-[#09090b] border-[#27272a] hover:border-[#3f3f46]'}
                            `}
                        >
                            {p.popular && !isCurrent && (
                                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
                                    Popular
                                </div>
                            )}
                             {isCurrent && (
                                <div className="absolute top-0 right-0 bg-green-500/20 text-green-400 border-l border-b border-green-500/20 text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg flex items-center gap-1">
                                    <Check size={10} /> Active
                                </div>
                            )}

                            <CardHeader className="flex flex-col items-start px-6 pt-6 pb-0">
                                <h3 className="text-lg font-bold">{p.name}</h3>
                                <div className="flex items-baseline mt-2">
                                    <span className="text-3xl font-bold tracking-tight">{p.price}</span>
                                    <span className="text-sm text-gray-500 ml-1">{p.period}</span>
                                </div>
                                <p className="text-sm text-gray-400 mt-4 min-h-[40px]">{p.description}</p>
                            </CardHeader>

                            <CardBody className="px-6 py-6">
                                <ul className="space-y-3 mb-6">
                                    {p.features.map((feat, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                            <CheckCircle size={16} className={isCurrent ? "text-blue-500" : "text-gray-600"} />
                                            {feat}
                                        </li>
                                    ))}
                                </ul>

                                <Button 
                                    className={`w-full font-bold ${isCurrent ? 'bg-[#27272a] text-gray-400 cursor-default' : 'bg-white text-black hover:bg-gray-200'}`}
                                    variant={isCurrent ? "flat" : "solid"}
                                    onClick={() => !isCurrent && setPlan(p.id as any)}
                                    disabled={isCurrent}
                                >
                                    {isCurrent ? 'Current Plan' : (p.id === 'enterprise' ? 'Contact Sales' : 'Upgrade')}
                                </Button>
                            </CardBody>
                        </Card>
                    );
                })}
            </div>
            
            <div className="mt-8 pt-8 border-t border-[#27272a]">
                <h3 className="font-bold mb-4">Invoice History</h3>
                
                <Card className="bg-[#18181b] border border-[#27272a] shadow-none">
                    <CardBody className="p-0">
                        {[
                            { date: 'Jan 1, 2026', amount: '$29.00', status: 'Paid', id: 'INV-2026-001' },
                            { date: 'Dec 1, 2025', amount: '$29.00', status: 'Paid', id: 'INV-2025-012' },
                            { date: 'Nov 1, 2025', amount: '$29.00', status: 'Paid', id: 'INV-2025-011' }
                        ].map((inv, idx) => (
                             <div key={idx} className={`flex items-center justify-between p-4 ${idx !== 2 ? 'border-b border-[#27272a]' : ''} hover:bg-[#27272a]/50 transition-colors`}>
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-[#27272a] rounded text-gray-400">
                                        <CreditCard size={16} />
                                    </div>
                                    <div>
                                        <div className="font-mono text-sm">{inv.id}</div>
                                        <div className="text-xs text-gray-500">{inv.date}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                     <div className="font-bold">{inv.amount}</div>
                                     <Chip size="sm" color="success" variant="flat" className="h-6 text-[10px] uppercase">Paid</Chip>
                                     <Button size="sm" isIconOnly variant="light" className="min-w-8 w-8 h-8 rounded-full">
                                         <ArrowUpRight size={14} className="text-gray-400" />
                                     </Button>
                                </div>
                            </div>
                        ))}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}

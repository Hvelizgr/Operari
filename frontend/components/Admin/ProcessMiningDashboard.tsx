
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Divider, Chip, Progress, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { Activity, AlertTriangle, Clock, Zap } from 'lucide-react';
import axios from 'axios';

interface Bottleneck {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    avgDuration: number;
    failureRate: number;
    executionCount: number;
    impactScore: number;
}

export function ProcessMiningDashboard() {
    const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBottlenecks = async () => {
            try {
                const response = await axios.get('/api/admin/process-mining/global');
                setBottlenecks(response.data);
            } catch (error) {
                console.error('Error fetching process mining data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBottlenecks();
    }, []);

    if (loading) return <div>Loading insights...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-default-50 border-none shadow-sm">
                    <CardHeader className="flex gap-3">
                        <Activity className="text-primary" />
                        <div className="flex flex-col">
                            <p className="text-md font-bold">Workflow Health</p>
                            <p className="text-small text-default-500">Overall success rate across tenant</p>
                        </div>
                    </CardHeader>
                    <CardBody>
                        <div className="flex items-center gap-4">
                            <Progress 
                                value={94} 
                                color="success" 
                                className="max-w-md" 
                                showValueLabel={true}
                                label="Execution Success"
                            />
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-default-50 border-none shadow-sm">
                    <CardHeader className="flex gap-3">
                        <Zap className="text-warning" />
                        <div className="flex flex-col">
                            <p className="text-md font-bold">Optimization Opportunities</p>
                            <p className="text-small text-default-500">Nodes with highest impact on latency</p>
                        </div>
                    </CardHeader>
                    <CardBody>
                        <p className="text-2xl font-bold text-warning">{bottlenecks.length} Bottlenecks</p>
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <AlertTriangle className="text-danger" size={20} />
                        Top Bottlenecks Detected
                    </h3>
                </CardHeader>
                <Divider />
                <CardBody>
                    <Table aria-label="Bottlenecks table" removeWrapper>
                        <TableHeader>
                            <TableColumn>NODE NAME</TableColumn>
                            <TableColumn>TYPE</TableColumn>
                            <TableColumn>AVG DURATION</TableColumn>
                            <TableColumn>FAILURE RATE</TableColumn>
                            <TableColumn>IMPACT SCORE</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent={"No bottlenecks detected yet."}>
                            {bottlenecks.map((b) => (
                                <TableRow key={b.nodeId}>
                                    <TableCell className="font-medium">{b.nodeName}</TableCell>
                                    <TableCell>
                                        <Chip size="sm" variant="flat" color="primary">{b.nodeType}</Chip>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Clock size={14} className="text-default-400" />
                                            {(b.avgDuration / 1000).toFixed(2)}s
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            size="sm" 
                                            color={b.failureRate > 0.1 ? "danger" : "warning"} 
                                            variant="dot"
                                        >
                                            {(b.failureRate * 100).toFixed(1)}%
                                        </Chip>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Progress 
                                                size="sm" 
                                                value={b.impactScore * 10} 
                                                color={b.impactScore > 7 ? "danger" : "warning"} 
                                            />
                                            <span className="text-tiny text-default-400">Score: {b.impactScore.toFixed(1)}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardBody>
            </Card>
        </div>
    );
}

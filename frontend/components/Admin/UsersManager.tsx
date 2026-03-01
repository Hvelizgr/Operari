'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Card, CardBody, CardHeader, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, User, Select, SelectItem, Button } from "@heroui/react";
import { Shield, Mail, Calendar, UserCog } from "lucide-react";

export function UsersManager() {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const roles = ['ADMIN', 'USER', 'VIEWER'];

    const fetchUsers = async () => {
        try {
            const data = await apiFetch('/api/users');
            setUsers(data.users);
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            await apiFetch(`/api/users/${userId}/role`, {
                method: 'PUT',
                body: JSON.stringify({ role: newRole }),
            });
            await fetchUsers();
        } catch (error) {
            alert('Failed to update role');
        }
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Shield className="text-blue-500" /> User Management
                    </h1>
                    <p className="text-gray-400">Manage permissions and roles for your team</p>
                </div>
                <Button color="primary" variant="flat" startContent={<UserCog size={18} />}>
                    Invite User
                </Button>
            </div>

            <Card className="bg-black/40 border-white/10 backdrop-blur-md">
                <CardBody p-0>
                    <Table 
                        aria-label="Users table"
                        classNames={{
                            base: "max-h-[70vh] overflow-scroll",
                            table: "min-w-[600px]",
                            th: "bg-transparent text-gray-400 border-b border-white/10",
                            td: "py-4 text-white"
                        }}
                    >
                        <TableHeader>
                            <TableColumn>USER</TableColumn>
                            <TableColumn>ROLE</TableColumn>
                            <TableColumn>MEMBER SINCE</TableColumn>
                            <TableColumn>ACTIONS</TableColumn>
                        </TableHeader>
                        <TableBody isLoading={isLoading} loadingContent={<div>Loading users...</div>}>
                            {users.map((item) => (
                                <TableRow key={item.id} className="border-b border-white/5 last:border-0">
                                    <TableCell>
                                        <User
                                            name={item.name || 'Anonymous'}
                                            description={item.email}
                                            avatarProps={{
                                                src: `https://i.pravatar.cc/150?u=${item.id}`,
                                                className: "bg-blue-500/20"
                                            }}
                                            classNames={{
                                                name: "text-white font-medium",
                                                description: "text-gray-500"
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            size="sm" 
                                            variant="flat" 
                                            color={item.role === 'ADMIN' ? "danger" : item.role === 'EDITOR' ? "primary" : "default"}
                                        >
                                            {item.role}
                                        </Chip>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                                            <Calendar size={14} />
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 max-w-[150px]">
                                            <Select 
                                                size="sm"
                                                variant="bordered"
                                                className="min-w-[120px]"
                                                selectedKeys={[item.role]}
                                                onSelectionChange={(keys) => {
                                                    const newRole = Array.from(keys)[0] as string;
                                                    handleRoleChange(item.id, newRole);
                                                }}
                                                classNames={{
                                                    trigger: "border-white/10 bg-white/5 text-white",
                                                    value: "text-white"
                                                }}
                                            >
                                                {roles.map((r) => (
                                                    <SelectItem key={r} className="text-black">
                                                        {r}
                                                    </SelectItem>
                                                ))}
                                            </Select>
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

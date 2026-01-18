'use client';

import { Card, CardBody, CardHeader, Divider, Button, Tabs, Tab, Avatar, Input, Switch, Chip } from "@heroui/react";
import { User, Shield, List, Settings, Plus as PlusIcon } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function AdminPage() {
    const { tenant, users, auditLogs, loading } = useTenant();

    if (loading) return <div className="p-8">Cargando...</div>;

    return (
        <div className="p-8 space-y-8 max-w-[1200px] mx-auto">
            <div className="mb-8">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-rose-600">
                    Administración: {tenant?.name}
                </h1>
                <p className="text-default-500 mt-2">Control centralizado de usuarios, roles y seguridad.</p>
            </div>

            <Tabs aria-label="admin options" color="danger" variant="underlined">

                {/* USERS TAB */}
                <Tab key="users" title={
                    <div className="flex items-center gap-2">
                        <User size={18} />
                        <span>Usuarios</span>
                    </div>
                }>
                    <Card className="mt-4 p-4 border border-white/10 bg-white/5 backdrop-blur-md">
                        <CardHeader className="flex justify-between">
                            <div>
                                <h3 className="text-xl font-bold">Gestión de Usuarios</h3>
                                <p className="text-sm text-default-500">Administra quién tiene acceso a la plataforma.</p>
                            </div>
                            <Button color="danger" variant="flat" startContent={<User size={18} />}>Invitar Usuario</Button>
                        </CardHeader>
                        <Divider className="my-2 bg-white/10" />
                        <CardBody className="space-y-4">
                            {users?.map((u: any) => (
                                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                    <div className="flex items-center gap-4">
                                        <Avatar name={u.name} size="md" className="transition-transform hover:scale-105" src={`https://i.pravatar.cc/150?u=${u.id}`} />
                                        <div>
                                            <p className="font-bold text-default-900">{u.name || 'Sin nombre'}</p>
                                            <p className="text-xs text-default-500">{u.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Chip size="sm" color={u.role === 'ADMIN' ? 'danger' : 'default'} variant="dot">{u.role}</Chip>
                                        <Button size="sm" variant="light" color="danger">Revocar</Button>
                                    </div>
                                </div>
                            ))}
                        </CardBody>
                    </Card>
                </Tab>

                {/* AUDIT LOGS TAB */}
                <Tab key="logs" title={
                    <div className="flex items-center gap-2">
                        <List size={18} />
                        <span>Audit Logs</span>
                    </div>
                }>
                    <Card className="mt-4 p-4 border border-white/10 bg-white/5 backdrop-blur-md">
                        <CardHeader>
                            <h3 className="text-xl font-bold">Registro de Auditoría</h3>
                            <p className="text-sm text-default-500">Historial de acciones críticas en el workspace.</p>
                        </CardHeader>
                        <Divider className="my-2 bg-white/10" />
                        <CardBody>
                            <div className="space-y-2">
                                {auditLogs?.map((log: any) => (
                                    <div key={log.id} className="text-xs p-2 rounded bg-black/20 flex justify-between items-center border-l-2 border-red-500">
                                        <div>
                                            <span className="font-bold text-red-400 mr-2">{log.action}</span>
                                            <span className="text-default-400">por {log.user?.name || log.user?.email}</span>
                                            <span className="mx-2 opacity-50">•</span>
                                            <span className="italic">{log.resourceType}: {log.resourceId}</span>
                                        </div>
                                        <div className="text-default-500">
                                            {format(new Date(log.createdAt), "HH:mm:ss d/MM", { locale: es })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </Tab>

                {/* SECURITY TAB */}
                <Tab key="security" title={
                    <div className="flex items-center gap-2">
                        <Shield size={18} />
                        <span>Seguridad</span>
                    </div>
                }>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-4 border border-white/10 bg-white/5 backdrop-blur-md">
                            <CardHeader>
                                <h3 className="font-bold text-lg">Políticas de Acceso</h3>
                            </CardHeader>
                            <CardBody className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">Force 2FA</p>
                                        <p className="text-xs text-default-500">Require Two-Factor Authentication for all admins.</p>
                                    </div>
                                    <Switch color="danger" size="sm" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">SSO Login Only</p>
                                        <p className="text-xs text-default-500">Disable email/password login.</p>
                                    </div>
                                    <Switch color="danger" size="sm" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">IP Whitelist</p>
                                        <p className="text-xs text-default-500">Restrict access to corporate VPN IPs.</p>
                                    </div>
                                    <Switch color="danger" size="sm" />
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="p-4 border border-white/10 bg-white/5 backdrop-blur-md">
                            <CardHeader>
                                <h3 className="font-bold text-lg">API Keys Globales</h3>
                            </CardHeader>
                            <CardBody className="space-y-4">
                                <div className="p-3 bg-black/20 rounded-lg border border-white/10">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-bold">Servidor Producción</span>
                                        <Chip size="sm" color="success" variant="flat">Activa</Chip>
                                    </div>
                                    <code className="text-xs block bg-black/40 p-1.5 rounded font-mono truncate text-green-400">sk_live_51Mz...q3f1</code>
                                    <p className="text-xs text-default-400 mt-2">Creada el 12 Ene 2025</p>
                                </div>
                                <Button variant="bordered" className="w-full border-dashed border-2 border-default-500/20 hover:border-default-500/50" startContent={<PlusIcon />}>
                                    Generar Nueva API Key
                                </Button>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                {/* SYSTEM CONFIG TAB */}
                <Tab key="system" title={
                    <div className="flex items-center gap-2">
                        <Settings size={18} />
                        <span>Sistema</span>
                    </div>
                }>
                    <Card className="mt-4 p-6 border border-white/10 bg-white/5 backdrop-blur-md">
                        <h3 className="text-xl font-bold mb-6">Configuración del Workspace</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Workspace Name" placeholder="My Workspace" defaultValue={tenant?.name} variant="bordered" />
                            <Input label="Workspace Slug" placeholder="my-workspace" defaultValue={tenant?.slug} variant="bordered" isReadOnly />
                            <Input label="Storage Usage" defaultValue={`${(tenant?.storageUsage || 0) / 1024} MB`} variant="bordered" isReadOnly />
                            <Input label="Plan Actual" defaultValue={tenant?.plan} variant="bordered" isReadOnly />
                        </div>
                        <div className="flex justify-end mt-6">
                            <Button color="danger">Guardar Cambios</Button>
                        </div>
                    </Card>
                </Tab>
            </Tabs>
        </div>
    );
}

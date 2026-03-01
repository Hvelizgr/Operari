'use client';

import { Card, CardBody, CardHeader, Button, Input, Avatar, Switch, Divider, Tab, Tabs } from "@heroui/react";
import { User, Mail, Shield, Bell, Key, Save } from "lucide-react";
import { useState } from "react";

export default function ProfileSettingsPage() {
    const [isLoading, setIsLoading] = useState(false);

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 text-white min-h-screen">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
                <p className="text-gray-400 mt-2">Manage your personal information and preferences.</p>
            </div>

            <Tabs aria-label="Settings Options" color="primary" variant="underlined">
                <Tab key="general" title="General">
                    <div className="space-y-6 mt-4">
                        {/* Profile Card */}
                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6">
                                <h3 className="text-lg font-bold">Profile Information</h3>
                            </CardHeader>
                            <CardBody className="px-6 pb-6 gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                                            UN
                                        </div>
                                        <Button size="sm" isIconOnly className="absolute bottom-0 right-0 rounded-full bg-[#27272a] border border-[#3f3f46]">
                                            <User size={14} />
                                        </Button>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input 
                                                label="Full Name" 
                                                placeholder="User Name" 
                                                defaultValue="User Name" 
                                                variant="bordered"
                                                classNames={{
                                                    inputWrapper: "bg-[#27272a] border-transparent hover:border-[#3f3f46]",
                                                    label: "text-gray-400",
                                                    input: "text-white"
                                                }}
                                            />
                                            <Input 
                                                label="Email" 
                                                placeholder="user@example.com" 
                                                defaultValue="user@nanoflow.dev" 
                                                isDisabled
                                                variant="bordered"
                                                classNames={{
                                                    inputWrapper: "bg-[#27272a]/50 border-transparent",
                                                    label: "text-gray-400",
                                                    input: "text-gray-400"
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Preferences */}
                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6">
                                <h3 className="text-lg font-bold">Preferences</h3>
                            </CardHeader>
                            <CardBody className="px-6 pb-6 gap-4">
                                <div className="flex justify-between items-center py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                            <Bell size={18} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Email Notifications</p>
                                            <p className="text-xs text-gray-400">Receive updates about your workflow executions.</p>
                                        </div>
                                    </div>
                                    <Switch defaultSelected color="primary" size="sm" aria-label="Email Notifications" />
                                </div>
                                <Divider className="bg-[#27272a]"/>
                                <div className="flex justify-between items-center py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                            <Shield size={18} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Two-Factor Auth</p>
                                            <p className="text-xs text-gray-400">Secure your account with 2FA.</p>
                                        </div>
                                    </div>
                                    <Switch color="primary" size="sm" aria-label="2FA" />
                                </div>
                            </CardBody>
                        </Card>

                        <div className="flex justify-end">
                            <Button color="primary" startContent={<Save size={16} />} className="font-semibold shadow-lg shadow-blue-900/20">
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </Tab>
                <Tab key="security" title="Security">
                    <Card className="bg-[#18181b] border border-[#27272a] mt-4">
                        <CardHeader className="px-6 pt-6">
                            <h3 className="text-lg font-bold">Change Password</h3>
                        </CardHeader>
                        <CardBody className="px-6 pb-6 gap-4">
                            <Input 
                                type="password"
                                label="Current Password" 
                                variant="bordered"
                                classNames={{
                                    inputWrapper: "bg-[#27272a] border-transparent hover:border-[#3f3f46]",
                                    label: "text-gray-400",
                                    input: "text-white"
                                }}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input 
                                    type="password"
                                    label="New Password" 
                                    variant="bordered"
                                    classNames={{
                                        inputWrapper: "bg-[#27272a] border-transparent hover:border-[#3f3f46]",
                                        label: "text-gray-400",
                                        input: "text-white"
                                    }}
                                />
                                <Input 
                                    type="password"
                                    label="Confirm New Password" 
                                    variant="bordered"
                                    classNames={{
                                        inputWrapper: "bg-[#27272a] border-transparent hover:border-[#3f3f46]",
                                        label: "text-gray-400",
                                        input: "text-white"
                                    }}
                                />
                            </div>
                            <div className="flex justify-end mt-2">
                                <Button color="primary" variant="flat">Update Password</Button>
                            </div>
                        </CardBody>
                    </Card>
                </Tab>
            </Tabs>
        </div>
    );
}

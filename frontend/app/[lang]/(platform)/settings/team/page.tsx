'use client';

import { Card, CardBody, CardHeader, Button, User as UserAvatar, Chip, Input, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Select, SelectItem } from "@heroui/react";
import { Plus, Search, MoreVertical, Mail, Shield, Trash2, RotateCcw } from "lucide-react";
import { useState } from "react";

export default function TeamPage() {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    
    // Mock Data
    const [members, setMembers] = useState([
        { id: 1, name: "Carlos Admin", email: "admin@nanoflow.dev", role: "Owner", status: "active", avatar: "https://i.pravatar.cc/150?u=a042581f4e29026024d" },
        { id: 2, name: "Sarah Dev", email: "sarah@company.com", role: "Editor", status: "active", avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d" },
        { id: 3, name: "John Viewer", email: "john@partner.com", role: "Viewer", status: "invited", avatar: "" },
    ]);

    const roles = [
        { key: "admin", label: "Admin", description: "Full access to workspace and billing." },
        { key: "editor", label: "Editor", description: "Can create and modify workflows." },
        { key: "viewer", label: "Viewer", description: "Read-only access to workflows and logs." },
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 text-white min-h-screen">
            <div className="flex justify-between items-end border-b border-[#27272a] pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
                    <p className="text-gray-400 mt-2">Manage access and roles for your workspace.</p>
                </div>
                <Button color="primary" onPress={onOpen} startContent={<Plus size={18} />} className="font-semibold shadow-lg shadow-blue-900/20">
                    Invite Member
                </Button>
            </div>

            {/* Seat Usage Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-[#18181b] border border-[#27272a]">
                    <CardBody className="flex flex-row items-center gap-4 p-4">
                         <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500"><UsersIcon size={24} /></div>
                         <div>
                             <p className="text-sm text-gray-400">Total Members</p>
                             <p className="text-2xl font-bold">{members.length}</p>
                         </div>
                    </CardBody>
                </Card>
                <Card className="bg-[#18181b] border border-[#27272a]">
                    <CardBody className="flex flex-row items-center gap-4 p-4">
                         <div className="p-3 rounded-lg bg-green-500/10 text-green-500"><Shield size={24} /></div>
                         <div>
                             <p className="text-sm text-gray-400">Available Seats</p>
                             <p className="text-2xl font-bold">2 / 5</p>
                         </div>
                    </CardBody>
                </Card>
                <Card className="bg-[#18181b] border border-[#27272a]">
                     <CardBody className="flex flex-row items-center gap-4 p-4">
                         <div className="p-3 rounded-lg bg-orange-500/10 text-orange-500"><Mail size={24} /></div>
                         <div>
                             <p className="text-sm text-gray-400">Pending Invites</p>
                             <p className="text-2xl font-bold">1</p>
                         </div>
                    </CardBody>
                </Card>
            </div>

            {/* Members List */}
            <Card className="bg-[#18181b] border border-[#27272a]">
                <CardHeader className="px-6 pt-6 flex justify-between items-center">
                    <h3 className="text-lg font-bold">Member List</h3>
                    <div className="w-64">
                        <Input 
                            placeholder="Search members..." 
                            startContent={<Search size={16} className="text-gray-500"/>} 
                            variant="bordered"
                            classNames={{
                                inputWrapper: "bg-[#27272a] border-transparent hover:border-[#3f3f46]",
                                input: "text-white"
                            }}
                            size="sm"
                        />
                    </div>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                    <div className="flex flex-col gap-4">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-[#27272a]">
                            <div className="col-span-4">User</div>
                            <div className="col-span-3">Role</div>
                            <div className="col-span-3">Status</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        {/* Rows */}
                        {members.map((member) => (
                            <div key={member.id} className="grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-[#27272a]/50 rounded-lg transition-colors group">
                                <div className="col-span-4">
                                    <UserAvatar   
                                        name={member.name}
                                        description={member.email}
                                        avatarProps={{
                                            src: member.avatar,
                                            size: "sm",
                                            className: member.status === 'invited' ? 'opacity-50' : ''
                                        }}
                                        classNames={{
                                            name: "text-sm font-semibold text-white",
                                            description: "text-xs text-gray-400"
                                        }}
                                    />
                                </div>
                                <div className="col-span-3">
                                    <Chip 
                                        variant="flat" 
                                        size="sm"
                                        className={
                                            member.role === 'Owner' ? 'bg-purple-500/10 text-purple-400' :
                                            member.role === 'Admin' ? 'bg-blue-500/10 text-blue-400' :
                                            'bg-[#27272a] text-gray-400'
                                        }
                                    >
                                        {member.role}
                                    </Chip>
                                </div>
                                <div className="col-span-3">
                                     <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${member.status === 'active' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                                        <span className="text-sm capitalize text-gray-300">{member.status}</span>
                                     </div>
                                </div>
                                <div className="col-span-2 flex justify-end">
                                    <Dropdown>
                                        <DropdownTrigger>
                                            <Button isIconOnly size="sm" variant="light" className="text-gray-500 hover:text-white">
                                                <MoreVertical size={16} />
                                            </Button>
                                        </DropdownTrigger>
                                        <DropdownMenu aria-label="Member Actions" className="dark text-white">
                                            <DropdownItem key="role">Change Role</DropdownItem>
                                            <DropdownItem key="resend" startContent={<RotateCcw size={14}/>} className={member.status !== 'invited' ? 'hidden' : ''}>Resend Invite</DropdownItem>
                                            <DropdownItem key="remove" className="text-danger" color="danger" startContent={<Trash2 size={14}/>}>Remove Member</DropdownItem>
                                        </DropdownMenu>
                                    </Dropdown>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardBody>
            </Card>

            {/* Invite Modal */}
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} className="dark bg-[#18181b] text-white border border-[#27272a]">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">Invite Team Member</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-gray-400 mb-4">Send an invitation email to add a new user to your workspace.</p>
                                <Input
                                    autoFocus
                                    label="Email Address"
                                    placeholder="colleague@company.com"
                                    variant="bordered"
                                    classNames={{
                                        inputWrapper: "bg-[#27272a] border-transparent hover:border-[#3f3f46]",
                                        label: "text-gray-400",
                                        input: "text-white"
                                    }}
                                />
                                <Select 
                                    label="Role" 
                                    placeholder="Select a role" 
                                    defaultSelectedKeys={["editor"]}
                                    variant="bordered"
                                    classNames={{
                                        trigger: "bg-[#27272a] border-transparent",
                                        value: "text-white",
                                        popoverContent: "dark bg-[#18181b] border border-[#27272a]"
                                    }}
                                >
                                    {roles.map((role) => (
                                        <SelectItem key={role.key} description={role.description}>
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button color="primary" onPress={onClose} className="font-semibold">
                                    Send Invite
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}

function UsersIcon({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    );
}

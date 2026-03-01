'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Button, Switch, Input, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea, useDisclosure, Spinner } from '@heroui/react';
import { Sparkles, Upload, Plus, Search, RefreshCw, Trash2, Edit, Download, ToggleLeft, FolderOpen } from 'lucide-react';
import { apiClient } from '@/utils/api-client';

interface Skill {
    id: string;
    name: string;
    description: string;
    version: string;
    author?: string;
    category?: string;
    tags?: string[];
    prompt: string;
    rules?: string[];
    enabled: boolean;
    loadedAt: string;
}

export default function SkillsPage() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
    const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
    const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
    const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure();
    
    const [newSkill, setNewSkill] = useState({
        name: '',
        description: '',
        prompt: '',
        version: '1.0.0',
        category: '',
        tags: '',
    });

    const [importPath, setImportPath] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);

    const fetchSkills = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/skills');
            setSkills(response.data);
        } catch (error) {
            console.error('Failed to fetch skills:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSkills();
    }, [fetchSkills]);

    const toggleSkill = async (skillId: string) => {
        try {
            await apiClient.post(`/skills/${skillId}/toggle`);
            setSkills(prev => prev.map(s => 
                s.id === skillId ? { ...s, enabled: !s.enabled } : s
            ));
        } catch (error) {
            console.error('Failed to toggle skill:', error);
        }
    };

    const deleteSkill = async (skillId: string) => {
        if (!confirm('Are you sure you want to delete this skill?')) return;
        try {
            await apiClient.delete(`/skills/${skillId}`);
            setSkills(prev => prev.filter(s => s.id !== skillId));
        } catch (error) {
            console.error('Failed to delete skill:', error);
        }
    };

    const createSkill = async () => {
        try {
            const response = await apiClient.post('/skills', {
                ...newSkill,
                tags: newSkill.tags.split(',').map(t => t.trim()).filter(Boolean),
            });
            setSkills(prev => [...prev, response.data]);
            onCreateClose();
            setNewSkill({ name: '', description: '', prompt: '', version: '1.0.0', category: '', tags: '' });
        } catch (error) {
            console.error('Failed to create skill:', error);
        }
    };

    const importFromPath = async () => {
        try {
            const response = await apiClient.post('/skills/import-from-path', { sourcePath: importPath });
            setSkills(prev => [...prev, response.data]);
            onImportClose();
            setImportPath('');
        } catch (error) {
            console.error('Failed to import skill:', error);
        }
    };

    const importFromZip = async () => {
        if (!importFile) return;
        try {
            const formData = new FormData();
            formData.append('file', importFile);
            const response = await apiClient.post('/skills/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (response.data.imported?.length > 0) {
                setSkills(prev => [...prev, ...response.data.imported]);
            }
            onImportClose();
            setImportFile(null);
        } catch (error) {
            console.error('Failed to import skill:', error);
        }
    };

    const reloadSkills = async () => {
        try {
            setLoading(true);
            const response = await apiClient.post('/skills/reload');
            setSkills(response.data.skills);
        } catch (error) {
            console.error('Failed to reload skills:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSkills = skills.filter(skill =>
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const enabledCount = skills.filter(s => s.enabled).length;

    return (
        <div className="p-8">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Sparkles className="text-purple-500" />
                        AI Skills Marketplace
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Manage agent skills and prompts. {enabledCount} of {skills.length} skills enabled.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="bordered"
                        startContent={<RefreshCw size={16} />}
                        onPress={reloadSkills}
                        isLoading={loading}
                    >
                        Reload
                    </Button>
                    <Button
                        variant="bordered"
                        startContent={<Upload size={16} />}
                        onPress={onImportOpen}
                    >
                        Import
                    </Button>
                    <Button
                        color="primary"
                        startContent={<Plus size={16} />}
                        onPress={onCreateOpen}
                    >
                        New Skill
                    </Button>
                </div>
            </div>

            <div className="mb-6">
                <Input
                    placeholder="Search skills..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    startContent={<Search size={18} className="text-gray-400" />}
                    classNames={{
                        input: "bg-transparent",
                        inputWrapper: "bg-[#18181b] border-[#27272a]"
                    }}
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Spinner size="lg" />
                </div>
            ) : filteredSkills.length === 0 ? (
                <Card className="bg-[#18181b] border border-[#27272a]">
                    <CardBody className="py-12 text-center">
                        <Sparkles className="mx-auto mb-4 text-gray-500" size={48} />
                        <p className="text-gray-400">No skills found. Create or import your first skill.</p>
                    </CardBody>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredSkills.map((skill) => (
                        <Card 
                            key={skill.id} 
                            className={`bg-[#18181b] border ${skill.enabled ? 'border-purple-500/50' : 'border-[#27272a]'} hover:border-purple-500/30 transition-colors cursor-pointer`}
                            onClick={() => {
                                setSelectedSkill(skill);
                                onDetailOpen();
                            }}
                        >
                            <CardBody className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg">{skill.name}</h3>
                                        <p className="text-sm text-gray-400">v{skill.version}</p>
                                    </div>
                                    <Switch
                                        isSelected={skill.enabled}
                                        onValueChange={() => toggleSkill(skill.id)}
                                        size="sm"
                                        color="secondary"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <p className="text-sm text-gray-300 mb-3 line-clamp-2">{skill.description}</p>
                                <div className="flex flex-wrap gap-1">
                                    {skill.category && (
                                        <Chip size="sm" variant="flat" color="secondary">{skill.category}</Chip>
                                    )}
                                    {skill.tags?.slice(0, 2).map((tag, i) => (
                                        <Chip key={i} size="sm" variant="flat">{tag}</Chip>
                                    ))}
                                    {(skill.tags?.length || 0) > 2 && (
                                        <Chip size="sm" variant="flat">+{(skill.tags?.length || 0) - 2}</Chip>
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="2xl">
                <ModalContent className="bg-[#18181b] border border-[#27272a]">
                    <ModalHeader>Create New Skill</ModalHeader>
                    <ModalBody>
                        <div className="space-y-4">
                            <Input
                                label="Name"
                                placeholder="My Custom Skill"
                                value={newSkill.name}
                                onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                            />
                            <Input
                                label="Description"
                                placeholder="Brief description of what this skill does"
                                value={newSkill.description}
                                onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Version"
                                    placeholder="1.0.0"
                                    value={newSkill.version}
                                    onChange={(e) => setNewSkill({ ...newSkill, version: e.target.value })}
                                />
                                <Input
                                    label="Category"
                                    placeholder="e.g., coding, writing"
                                    value={newSkill.category}
                                    onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
                                />
                            </div>
                            <Input
                                label="Tags (comma-separated)"
                                placeholder="react, typescript, optimization"
                                value={newSkill.tags}
                                onChange={(e) => setNewSkill({ ...newSkill, tags: e.target.value })}
                            />
                            <Textarea
                                label="Prompt"
                                placeholder="Enter the skill prompt/instructions..."
                                value={newSkill.prompt}
                                onChange={(e) => setNewSkill({ ...newSkill, prompt: e.target.value })}
                                minRows={6}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onCreateClose}>Cancel</Button>
                        <Button color="primary" onPress={createSkill} isDisabled={!newSkill.name || !newSkill.prompt}>
                            Create Skill
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={isImportOpen} onClose={onImportClose} size="lg">
                <ModalContent className="bg-[#18181b] border border-[#27272a]">
                    <ModalHeader>Import Skill</ModalHeader>
                    <ModalBody>
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-gray-400 mb-3">Import from local directory path:</p>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="/path/to/skill-folder"
                                        value={importPath}
                                        onChange={(e) => setImportPath(e.target.value)}
                                        startContent={<FolderOpen size={16} />}
                                    />
                                    <Button 
                                        color="primary" 
                                        onPress={importFromPath}
                                        isDisabled={!importPath}
                                    >
                                        Import
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-[#27272a]"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-[#18181b] text-gray-400">OR</span>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-gray-400 mb-3">Upload a ZIP file:</p>
                                <div className="border-2 border-dashed border-[#27272a] rounded-lg p-6 text-center">
                                    <input
                                        type="file"
                                        accept=".zip"
                                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                        id="skill-zip-upload"
                                    />
                                    <label htmlFor="skill-zip-upload" className="cursor-pointer">
                                        <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                                        <p className="text-sm text-gray-400">
                                            {importFile ? importFile.name : 'Click to select ZIP file'}
                                        </p>
                                    </label>
                                </div>
                                {importFile && (
                                    <Button 
                                        color="primary" 
                                        className="w-full mt-3"
                                        onPress={importFromZip}
                                    >
                                        Upload & Import
                                    </Button>
                                )}
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onImportClose}>Cancel</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={isDetailOpen} onClose={onDetailClose} size="3xl" scrollBehavior="inside">
                <ModalContent className="bg-[#18181b] border border-[#27272a]">
                    {selectedSkill && (
                        <>
                            <ModalHeader className="flex items-center justify-between">
                                <div>
                                    <span className="font-bold">{selectedSkill.name}</span>
                                    <span className="text-gray-400 ml-2">v{selectedSkill.version}</span>
                                </div>
                                <Switch
                                    isSelected={selectedSkill.enabled}
                                    onValueChange={() => {
                                        toggleSkill(selectedSkill.id);
                                        setSelectedSkill({ ...selectedSkill, enabled: !selectedSkill.enabled });
                                    }}
                                    color="secondary"
                                />
                            </ModalHeader>
                            <ModalBody>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Description</h4>
                                        <p>{selectedSkill.description}</p>
                                    </div>
                                    
                                    {selectedSkill.author && (
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-400 mb-1">Author</h4>
                                            <p>{selectedSkill.author}</p>
                                        </div>
                                    )}

                                    {selectedSkill.category && (
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-400 mb-1">Category</h4>
                                            <Chip size="sm" variant="flat" color="secondary">{selectedSkill.category}</Chip>
                                        </div>
                                    )}

                                    {selectedSkill.tags && selectedSkill.tags.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-400 mb-1">Tags</h4>
                                            <div className="flex flex-wrap gap-1">
                                                {selectedSkill.tags.map((tag, i) => (
                                                    <Chip key={i} size="sm" variant="flat">{tag}</Chip>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Prompt</h4>
                                        <pre className="bg-black/50 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap max-h-64">
                                            {selectedSkill.prompt}
                                        </pre>
                                    </div>

                                    {selectedSkill.rules && selectedSkill.rules.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-400 mb-1">Rules ({selectedSkill.rules.length})</h4>
                                            <p className="text-sm text-gray-500">This skill includes {selectedSkill.rules.length} rule definitions.</p>
                                        </div>
                                    )}
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button
                                    color="danger"
                                    variant="light"
                                    startContent={<Trash2 size={16} />}
                                    onPress={() => {
                                        deleteSkill(selectedSkill.id);
                                        onDetailClose();
                                    }}
                                >
                                    Delete
                                </Button>
                                <Button variant="light" onPress={onDetailClose}>Close</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}

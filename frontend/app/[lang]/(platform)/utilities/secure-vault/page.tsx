'use client';

import { CredentialsManager } from "@/components/Credentials/CredentialsManager";
import { Lock, ShieldCheck, Info } from "lucide-react";
import { Card, CardBody } from "@heroui/react";

export default function SecureVaultPage() {
    return (
        <div className="p-8 space-y-6 max-w-[1200px] mx-auto h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Lock className="text-blue-500" /> Secure Vault
                    </h1>
                    <p className="text-default-500 mt-1">Gestión centralizada de secretos y claves de API con encriptación de grado bancario.</p>
                </div>
            </div>

            <Card className="border border-blue-500/20 bg-blue-500/5">
                <CardBody className="flex flex-row items-center gap-4 p-4 text-sm text-blue-200">
                    <ShieldCheck className="text-blue-400 shrink-0" size={24} />
                    <p>
                        Todos los datos guardados aquí se encriptan usando <strong>AES-256-GCM</strong> antes de ser almacenados. 
                        Solo son accesibles durante la ejecución de los flujos autorizados.
                    </p>
                </CardBody>
            </Card>

            <div className="flex-1 min-h-0 bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                <CredentialsManager />
            </div>
            
            <div className="flex gap-4 mt-4">
                <Card className="flex-1 border border-white/5 bg-white/5">
                    <CardBody className="p-4 flex flex-row gap-3 items-start">
                        <Info size={18} className="text-default-400 mt-0.5" />
                        <div>
                            <h4 className="text-xs font-bold text-default-300 uppercase mb-1">Rotación de Claves</h4>
                            <p className="text-xs text-default-500 italic">Próximamente: Alertas automáticas para rotar secretos que superen los 90 días.</p>
                        </div>
                    </CardBody>
                </Card>
                <Card className="flex-1 border border-white/5 bg-white/5">
                    <CardBody className="p-4 flex flex-row gap-3 items-start">
                        <ShieldCheck size={18} className="text-default-400 mt-0.5" />
                        <div>
                            <h4 className="text-xs font-bold text-default-300 uppercase mb-1">Auditoría de Acceso</h4>
                            <p className="text-xs text-default-500 italic">Consulta quién y cuándo accedió a cada secreto en la sección de Logs.</p>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}

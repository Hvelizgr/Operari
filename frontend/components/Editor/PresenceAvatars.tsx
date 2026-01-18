import { Tooltip, Avatar, AvatarGroup } from "@heroui/react";
import { RemoteUser } from "../../hooks/useCollaboration";

interface PresenceAvatarsProps {
    users: RemoteUser[];
}

export default function PresenceAvatars({ users }: PresenceAvatarsProps) {
    if (users.length === 0) return null;

    return (
        <div className="absolute top-16 right-4 z-50 flex items-center gap-2 pointer-events-auto">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-2 py-1 rounded-md border border-slate-200/50 dark:border-slate-700/50">
                Live {users.length + 1}
            </span>
            <AvatarGroup isBordered max={3} size="sm">
                {users.map((remote) => (
                    <Tooltip 
                        key={remote.socketId} 
                        content={remote.user?.name || remote.user?.email || 'Anonymous'}
                        placement="bottom"
                    >
                        <Avatar
                            name={remote.user?.name || remote.user?.email}
                            src={remote.user?.avatar}
                            className="w-7 h-7 text-tiny"
                        />
                    </Tooltip>
                ))}
            </AvatarGroup>
        </div>
    );
}

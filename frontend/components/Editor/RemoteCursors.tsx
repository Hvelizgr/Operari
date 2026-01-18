import { RemoteUser } from "../../hooks/useCollaboration";
import { MousePointer2 } from "lucide-react";

interface RemoteCursorsProps {
    users: RemoteUser[];
    viewport: { x: number, y: number, zoom: number };
}

export default function RemoteCursors({ users, viewport }: RemoteCursorsProps) {
    return (
        <>
            {users.map((remote) => {
                if (!remote.cursor) return null;

                // Project world coordinates back to screen for rendering overlay
                const screenX = remote.cursor.x * viewport.zoom + viewport.x;
                const screenY = remote.cursor.y * viewport.zoom + viewport.y;

                return (
                    <div
                        key={remote.socketId}
                        className="fixed pointer-events-none z-[100] transition-all duration-75"
                        style={{
                            left: screenX,
                            top: screenY,
                        }}
                    >
                        <div className="relative">
                            <MousePointer2 
                                size={18} 
                                className="text-blue-500 fill-blue-500 stroke-white stroke-2 drop-shadow-md" 
                            />
                            <div className="absolute left-4 top-4 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap shadow-sm border border-white/20">
                                {remote.user?.name || 'Anonymous'}
                            </div>
                        </div>
                    </div>
                );
            })}
        </>
    );
}

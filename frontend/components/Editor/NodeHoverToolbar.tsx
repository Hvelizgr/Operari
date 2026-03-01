'use client';

import { memo, useState, useEffect } from 'react';
import { Play, Pause, Trash2, Copy, Focus, MoreHorizontal, Power } from 'lucide-react';

export interface NodeHoverToolbarProps {
    nodeId: string;
    nodeTitle: string;
    isVisible: boolean;
    isDisabled?: boolean;
    isRunning?: boolean;
    position: { x: number; y: number };
    zoom: number;
    onRun?: (nodeId: string) => void;
    onToggleDisable?: (nodeId: string) => void;
    onDelete?: (nodeId: string) => void;
    onDuplicate?: (nodeId: string) => void;
    onFocus?: (nodeId: string) => void;
}

function NodeHoverToolbarComponent({
    nodeId,
    nodeTitle,
    isVisible,
    isDisabled = false,
    isRunning = false,
    position,
    zoom,
    onRun,
    onToggleDisable,
    onDelete,
    onDuplicate,
    onFocus,
}: NodeHoverToolbarProps) {
    const [showMenu, setShowMenu] = useState(false);

    // Reset menu when toolbar hides
    useEffect(() => {
        if (!isVisible) {
            setShowMenu(false);
        }
    }, [isVisible]);

    if (!isVisible) return null;

    // Calculate zoom compensation to keep toolbar readable at any zoom level
    const zoomCompensation = Math.max(1, 1 / zoom);
    const minScale = 0.75;
    const maxScale = 1.5;
    const scale = Math.min(maxScale, Math.max(minScale, zoomCompensation));

    const buttonClass = `
        p-1.5 rounded-md transition-all duration-150
        hover:bg-white/20 hover:scale-110
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const tooltipClass = `
        absolute bottom-full mb-2 left-1/2 -translate-x-1/2
        px-2 py-1 text-[10px] font-medium
        bg-slate-900 text-white rounded
        opacity-0 group-hover:opacity-100
        transition-opacity pointer-events-none
        whitespace-nowrap z-50
    `;

    return (
        <div
            className="node-hover-toolbar absolute z-50 pointer-events-auto"
            style={{
                left: position.x,
                top: position.y - 40 * scale,
                transform: `translateX(-50%) scale(${scale})`,
                transformOrigin: 'bottom center',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div
                className="
                    flex items-center gap-1 px-2 py-1.5
                    bg-slate-800/95 backdrop-blur-sm
                    border border-slate-600/50
                    rounded-lg shadow-xl
                    text-white text-sm
                    animate-in fade-in slide-in-from-bottom-2 duration-200
                "
            >
                {/* Run/Stop Button */}
                <div className="relative group">
                    <button
                        className={buttonClass}
                        onClick={() => onRun?.(nodeId)}
                        disabled={isDisabled}
                        title={isRunning ? 'Stop' : 'Run from here'}
                    >
                        {isRunning ? (
                            <Pause size={16} className="text-orange-400" />
                        ) : (
                            <Play size={16} className="text-green-400" />
                        )}
                    </button>
                    <span className={tooltipClass}>
                        {isRunning ? 'Stop' : 'Test'}
                    </span>
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-slate-600/50 mx-0.5" />

                {/* Toggle Disable */}
                <div className="relative group">
                    <button
                        className={buttonClass}
                        onClick={() => onToggleDisable?.(nodeId)}
                        title={isDisabled ? 'Enable' : 'Disable'}
                    >
                        <Power
                            size={16}
                            className={isDisabled ? 'text-red-400' : 'text-slate-300'}
                        />
                    </button>
                    <span className={tooltipClass}>
                        {isDisabled ? 'Enable' : 'Disable'}
                    </span>
                </div>

                {/* Duplicate */}
                <div className="relative group">
                    <button
                        className={buttonClass}
                        onClick={() => onDuplicate?.(nodeId)}
                        title="Duplicate"
                    >
                        <Copy size={16} className="text-slate-300" />
                    </button>
                    <span className={tooltipClass}>Duplicate</span>
                </div>

                {/* Delete */}
                <div className="relative group">
                    <button
                        className={`${buttonClass} hover:bg-red-500/30`}
                        onClick={() => onDelete?.(nodeId)}
                        title="Delete"
                    >
                        <Trash2 size={16} className="text-red-400" />
                    </button>
                    <span className={tooltipClass}>Delete</span>
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-slate-600/50 mx-0.5" />

                {/* Focus */}
                <div className="relative group">
                    <button
                        className={buttonClass}
                        onClick={() => onFocus?.(nodeId)}
                        title="Focus"
                    >
                        <Focus size={16} className="text-blue-400" />
                    </button>
                    <span className={tooltipClass}>Focus</span>
                </div>
            </div>

            {/* Arrow pointer */}
            <div
                className="
                    absolute left-1/2 -translate-x-1/2 -bottom-1.5
                    w-3 h-3 rotate-45
                    bg-slate-800/95 border-r border-b border-slate-600/50
                "
            />
        </div>
    );
}

export const NodeHoverToolbar = memo(NodeHoverToolbarComponent);
export default NodeHoverToolbar;
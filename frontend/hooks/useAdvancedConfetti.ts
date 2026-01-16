// frontend/hooks/useAdvancedConfetti.ts
import { useCallback } from 'react';
import confetti from 'canvas-confetti';

interface UseAdvancedConfettiProps {
    confettiCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

interface NodeLike {
    id: string;
    type?: string;
    position: { x: number; y: number };
    data?: {
        width?: number;
        height?: number;
    };
}

export function useAdvancedConfetti({ confettiCanvasRef }: UseAdvancedConfettiProps) {
    const fire = useCallback((particleRatio: number, opts: confetti.Options) => {
        const instance = confetti.create(confettiCanvasRef.current || undefined, { resize: true });
        instance({ ...opts, particleCount: Math.floor(200 * particleRatio) });
    }, [confettiCanvasRef]);

    const addSolderSparks = useCallback((x: number, y: number, color: string = '#3b82f6') => {
        const rect = confettiCanvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const origin = {
            x: (x - rect.left) / rect.width,
            y: (y - rect.top) / rect.height
        };

        fire(0.25, {
            spread: 26,
            startVelocity: 55,
            origin,
            colors: ['#ffffff', color],
            shapes: ['star'],
        });
    }, [fire, confettiCanvasRef]);

    // Function to trigger solder sparks effect at a node's port
    const triggerSolderSparks = useCallback((
        node: NodeLike,
        element: HTMLElement,
        _containerWidth: number,
        _containerHeight: number,
        _zoom: number,
        portType: 'input' | 'output'
    ) => {
        const rect = confettiCanvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Get the element's bounding rect for positioning
        const elementRect = element.getBoundingClientRect();

        let portX: number;
        let portY: number;

        if (portType === 'input') {
            // Input port is on the left side of the node
            portX = elementRect.left;
            portY = elementRect.top + elementRect.height / 2;
        } else {
            // Output port is on the right side of the node
            portX = elementRect.right;
            portY = elementRect.top + elementRect.height / 2;
        }

        const origin = {
            x: (portX - rect.left) / rect.width,
            y: (portY - rect.top) / rect.height
        };

        // Get node color based on type
        const color = getNodeColor(node.type);

        fire(0.15, {
            spread: 40,
            startVelocity: 25,
            origin,
            colors: ['#ffffff', color, '#fbbf24'],
            shapes: ['star'],
            scalar: 0.8,
            gravity: 0.8,
            drift: 0,
            ticks: 50,
        });
    }, [fire, confettiCanvasRef]);

    return { addSolderSparks, triggerSolderSparks };
}

// Helper function to get color based on node type
function getNodeColor(nodeType?: string): string {
    const colorMap: Record<string, string> = {
        'trigger': '#22c55e',      // green
        'webhook': '#22c55e',      // green
        'schedule': '#22c55e',     // green
        'action': '#3b82f6',       // blue
        'http': '#3b82f6',         // blue
        'transform': '#8b5cf6',    // purple
        'condition': '#f59e0b',    // amber
        'logic': '#f59e0b',        // amber
        'output': '#ef4444',       // red
        'email': '#ef4444',        // red
    };

    return colorMap[nodeType || ''] || '#3b82f6'; // default blue
}

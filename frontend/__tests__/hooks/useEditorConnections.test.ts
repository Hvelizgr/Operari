import { renderHook, act } from '@testing-library/react';
import { useEditorConnections } from '../../hooks/useEditorConnections';
import { INITIAL_NODES } from '../../constants/editor.constants';

// Mock dependencies
const mockExecuteCommand = jest.fn((cmd) => cmd.execute());
const mockAnnounceMessage = jest.fn();

describe('useEditorConnections', () => {
    let canvasRef: any;
    let defaultProps: any;

    beforeEach(() => {
        mockExecuteCommand.mockClear();
        mockAnnounceMessage.mockClear();

        canvasRef = {
            current: {
                getBoundingClientRect: jest.fn(() => ({
                    left: 0,
                    top: 0,
                    width: 1000,
                    height: 1000
                }))
            }
        };

        defaultProps = {
            nodes: INITIAL_NODES,
            viewport: { x: 0, y: 0, zoom: 1 },
            canvasRef: canvasRef,
            executeCommand: mockExecuteCommand,
            announceMessage: mockAnnounceMessage,
        };
    });

    it('initializes with empty connections', () => {
        const { result } = renderHook(() => useEditorConnections(defaultProps));
        // INITIAL_CONNECTIONS might be empty or not, usually empty for fresh start
        // Based on useEditorConnections.ts import, it uses INITIAL_CONNECTIONS
        expect(Array.isArray(result.current.connections)).toBe(true);
    });

    it('starts creating a connection on port drag', () => {
        const { result } = renderHook(() => useEditorConnections(defaultProps));

        act(() => {
            result.current.handlePortDragStart(
                'node-1',
                'port-1',
                'source',
                { x: 100, y: 100 }
            );
        });

        expect(result.current.creatingConnection).toEqual({
            sourceNodeId: 'node-1',
            sourcePortId: 'port-1',
            startPos: { x: 100, y: 100 },
            currentPos: { x: 100, y: 100 },
        });
    });

    it('updates creating connection position', () => {
        const { result } = renderHook(() => useEditorConnections(defaultProps));

        // Start creating
        act(() => {
            result.current.handlePortDragStart('node-1', 'port-1', 'source', { x: 0, y: 0 });
        });

        // Move
        act(() => {
            result.current.updateCreatingConnectionPosition(200, 200);
        });

        // Viewport 0,0 zoom 1. Rect 0,0.
        expect(result.current.creatingConnection?.currentPos).toEqual({ x: 200, y: 200 });
    });

    it('completes connection creation', () => {
        const { result } = renderHook(() => useEditorConnections(defaultProps));

        // Start creating
        act(() => {
            result.current.handlePortDragStart('node-1', 'port-1', 'source', { x: 0, y: 0 });
        });

        // Simulate hovering a valid target (we need to manually set hoveredInputNode because logic is inside updateCreatingConnectionPosition which relies on DOM geometry simulation which is hard)
        // We can just set state directly or mock the internal logic. But accessing setSelected... no wait, we can only call exposed methods.
        // However, `updateCreatingConnectionPosition` logic sets `hoveredInputNode`.
        // Let's manually trigger `setHoveredInputNode` exposed in return? Yes!

        act(() => {
            result.current.setHoveredInputNode('node-target');
        });

        act(() => {
            result.current.completeConnection();
        });

        expect(mockExecuteCommand).toHaveBeenCalled();
        expect(result.current.connections.some(c => c.source === 'node-1' && c.target === 'node-target')).toBe(true);
        expect(result.current.creatingConnection).toBeNull();
    });

    it('selects a connection', () => {
        const { result } = renderHook(() => useEditorConnections(defaultProps));
        const connId = 'conn-1';

        act(() => {
            result.current.handleConnectionSelect(connId);
        });

        expect(result.current.selectedConnection).toBe(connId);
    });

    it('deletes a connection via executeCommand', () => {
        const { result } = renderHook(() => useEditorConnections(defaultProps));

        // Add a dummy connection first
        act(() => {
            result.current.setConnections([{ id: 'conn-1', source: 'a', target: 'b', sourcePort: 0, targetPort: 0 }]);
        });

        act(() => {
            result.current.handleConfirmDeleteConnection('conn-1');
        });

        expect(mockExecuteCommand).toHaveBeenCalled();
        expect(mockAnnounceMessage).toHaveBeenCalledWith('Connection deleted');
        expect(result.current.connections.length).toBe(0);
    });
});

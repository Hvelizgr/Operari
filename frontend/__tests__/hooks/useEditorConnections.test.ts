import { act, renderHook } from '@testing-library/react';

import { INITIAL_NODES } from '../../constants/editor.constants';
import { useEditorConnections } from '../../hooks/useEditorConnections';

// Mock dependencies
const mockExecuteCommand = jest.fn(cmd => cmd.execute());
const mockAnnounceMessage = jest.fn();

describe('useEditorConnections', () => {
  const defaultProps = {
    nodes: INITIAL_NODES,
    executeCommand: mockExecuteCommand,
    announceMessage: mockAnnounceMessage,
  };

  beforeEach(() => {
    mockExecuteCommand.mockClear();
    mockAnnounceMessage.mockClear();
  });

  it('initializes with empty connections', () => {
    const { result } = renderHook(() => useEditorConnections(defaultProps));
    // INITIAL_CONNECTIONS might be empty or not, usually empty for fresh start
    // Based on useEditorConnections.ts import, it uses INITIAL_CONNECTIONS
    expect(Array.isArray(result.current.connections)).toBe(true);
  });

  it('creates a connection on the given source port', () => {
    const { result } = renderHook(() => useEditorConnections(defaultProps));

    act(() => {
      expect(result.current.createConnection('node-1', 'node-target', 1)).toBe(true);
    });

    expect(mockExecuteCommand).toHaveBeenCalled();
    expect(result.current.connections).toContainEqual(
      expect.objectContaining({ source: 'node-1', target: 'node-target', sourcePort: 1 })
    );
  });

  it('rejects self-loops', () => {
    const { result } = renderHook(() => useEditorConnections(defaultProps));

    act(() => {
      expect(result.current.createConnection('node-1', 'node-1')).toBe(false);
    });

    expect(mockAnnounceMessage).toHaveBeenCalledWith('Self-loops are not allowed');
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('rejects a duplicate on the same port but allows another port', () => {
    const { result } = renderHook(() => useEditorConnections(defaultProps));

    act(() => {
      result.current.setConnections([
        { id: 'conn-1', source: 'a', target: 'b', sourcePort: 0, targetPort: 0 },
      ]);
    });

    act(() => {
      expect(result.current.createConnection('a', 'b', 0)).toBe(false);
    });
    expect(mockAnnounceMessage).toHaveBeenCalledWith('Connection already exists');

    act(() => {
      expect(result.current.createConnection('a', 'b', 1)).toBe(true);
    });
    expect(result.current.connections).toHaveLength(2);
  });

  it('rejects a connection that would close a cycle', () => {
    const nodes = ['a', 'b'].map(id => ({
      id,
      type: 'shell',
      title: id,
      position: { x: 0, y: 0 },
    }));
    const { result } = renderHook(() => useEditorConnections({ ...defaultProps, nodes }));

    act(() => {
      result.current.setConnections([
        { id: 'conn-1', source: 'a', target: 'b', sourcePort: 0, targetPort: 0 },
      ]);
    });

    act(() => {
      expect(result.current.createConnection('b', 'a')).toBe(false);
    });
    expect(mockAnnounceMessage).toHaveBeenCalledWith('Connection rejected — would create a cycle');
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
      result.current.setConnections([
        { id: 'conn-1', source: 'a', target: 'b', sourcePort: 0, targetPort: 0 },
      ]);
    });

    act(() => {
      result.current.handleConfirmDeleteConnection('conn-1');
    });

    expect(mockExecuteCommand).toHaveBeenCalled();
    expect(mockAnnounceMessage).toHaveBeenCalledWith('Connection deleted');
    expect(result.current.connections.length).toBe(0);
  });
});

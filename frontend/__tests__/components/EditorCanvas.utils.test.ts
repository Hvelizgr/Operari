import {
  createNewNode,
  portLabel,
  switchOutputs,
} from '../../components/Editor/EditorCanvas.utils';

describe('createNewNode with seeded port objects', () => {
  it('turns { name, type } ports into string labels', () => {
    const node = createNewNode(
      {
        type: 'operari.if',
        label: { en: 'If', es: 'Si' },
        icon: null,
        color: '',
        category: 'core',
        // What /api/node-types actually returns, despite the string[] type.
        outputs: [
          { name: 'true', type: 'main' },
          { name: 'false', type: 'main' },
        ] as unknown as string[],
      },
      { x: 0, y: 0, zoom: 1 },
      { width: 800, height: 600 },
      'en'
    );
    expect(node.outputs?.map(o => o.label)).toEqual(['true', 'false']);
  });

  it('falls back when a stored label is not renderable', () => {
    expect(portLabel({ type: 'main' }, 'out-0')).toBe('out-0');
    expect(portLabel('case 0', 'out-0')).toBe('case 0');
  });
});

describe('switchOutputs', () => {
  it('builds one port per case plus default', () => {
    expect(
      switchOutputs('["staging", {"value": "prod", "label": "Prod"}]')?.map(o => o.label)
    ).toEqual(['staging', 'Prod', 'default']);
  });

  it('keeps the current ports while the JSON is half typed', () => {
    expect(switchOutputs('["stag')).toBeNull();
  });
});

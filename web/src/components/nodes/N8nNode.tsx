import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Globe, Code, GitBranch, Settings, ArrowRightLeft, Split, Merge } from 'lucide-react';

const n8nNodeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  'n8n-http': { label: 'HTTP Request', color: '#ff6d5a', icon: Globe },
  'n8n-code': { label: 'Code', color: '#ff9922', icon: Code },
  'n8n-function': { label: 'Function', color: '#ff9922', icon: Code },
  'n8n-set': { label: 'Set', color: '#00c8ff', icon: Settings },
  'n8n-if': { label: 'If', color: '#00d084', icon: GitBranch },
  'n8n-switch': { label: 'Switch', color: '#00d084', icon: ArrowRightLeft },
  'n8n-merge': { label: 'Merge', color: '#9b59b6', icon: Merge },
  'n8n-split': { label: 'Split', color: '#9b59b6', icon: Split },
};

interface N8nNodeData {
  label?: string;
  config?: Record<string, unknown>;
}

const N8nNode: React.FC<NodeProps<N8nNodeData>> = ({ data, type, selected }) => {
  const config = n8nNodeConfig[type] || { label: 'n8n Node', color: '#ff6d5a', icon: Globe };
  const Icon = config.icon;

  return (
    <div
      className={`relative px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-md transition-all ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
      style={{
        backgroundColor: '#1e1e1e',
        borderColor: config.color,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 rounded-full border-2"
        style={{ backgroundColor: config.color, borderColor: '#1e1e1e' }}
      />

      <div className="flex items-center gap-2 mb-2">
        <div
          className="p-1.5 rounded"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <span className="font-medium text-white text-sm">{config.label}</span>
        <span
          className="ml-auto text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: config.color, color: '#fff' }}
        >
          n8n
        </span>
      </div>

      {data?.label && (
        <p className="text-xs text-gray-400 truncate">{data.label}</p>
      )}

      {data?.config && Object.keys(data.config).length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-500">Config:</p>
          <div className="text-xs text-gray-400 mt-1 max-h-16 overflow-auto">
            {Object.entries(data.config).slice(0, 3).map(([key, value]) => (
              <div key={key} className="truncate">
                <span className="text-gray-500">{key}:</span> {String(value)}
              </div>
            ))}
          </div>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 rounded-full border-2"
        style={{ backgroundColor: config.color, borderColor: '#1e1e1e' }}
      />
    </div>
  );
};

export default memo(N8nNode);

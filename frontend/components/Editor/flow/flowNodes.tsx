'use client';

import type { WorkflowNode } from '@operari/shared';
import type { Node, NodeProps } from '@xyflow/react';
import { memo } from 'react';

import type { NodeTypeRegistry } from '../../../lib/canvas/node-type-registry';
import type { NodeType } from '../../Node';
import EditorNode from '../EditorNode';
import FrameNode from '../FrameNode';
import NoteNode from '../NoteNode';

export type StepStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED';

export type StepFlowNode = Node<
  {
    node: WorkflowNode;
    typeDefinition?: NodeType;
    registry?: NodeTypeRegistry;
    isConnected: boolean;
    isHighlighted: boolean;
    status?: StepStatus;
    durationMs: number | null;
    isNextInPath: boolean;
    upstreamStatus: StepStatus | null;
  },
  'step'
>;

export type FrameFlowNode = Node<
  {
    node: WorkflowNode;
    containedCount: number;
    onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  },
  'frame'
>;

export type NoteFlowNode = Node<
  {
    node: WorkflowNode;
    onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  },
  'note'
>;

export type OperariFlowNode = StepFlowNode | FrameFlowNode | NoteFlowNode;

const StepNode = memo(function StepNode({ data, selected, dragging }: NodeProps<StepFlowNode>) {
  return (
    <EditorNode
      node={data.node}
      typeDefinition={data.typeDefinition}
      registry={data.registry}
      isConnected={data.isConnected}
      isSelected={selected}
      isDragging={dragging}
      isHighlighted={data.isHighlighted}
      status={data.status}
      durationMs={data.durationMs}
      isNextInPath={data.isNextInPath}
      upstreamStatus={data.upstreamStatus}
    />
  );
});

const FrameFlowNodeView = memo(function FrameFlowNodeView({
  data,
  selected,
}: NodeProps<FrameFlowNode>) {
  return (
    <FrameNode
      node={data.node}
      isSelected={selected}
      onUpdate={data.onUpdate}
      containedCount={data.containedCount}
    />
  );
});

const NoteFlowNodeView = memo(function NoteFlowNodeView({
  data,
  selected,
}: NodeProps<NoteFlowNode>) {
  return <NoteNode node={data.node} isSelected={selected} onUpdate={data.onUpdate} />;
});

export const flowNodeTypes = {
  step: StepNode,
  frame: FrameFlowNodeView,
  note: NoteFlowNodeView,
};

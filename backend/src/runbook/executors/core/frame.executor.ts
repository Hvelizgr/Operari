import type { ExecutionInput, NodeExecutionResult } from '../../../types/runbook.types';
import { FlatInputStep } from './_flat-input';
import type { NodeErrorContext } from './_shared';

/**
 * Frame node — pure passthrough. The editor uses `custom.frame` for
 * visual section grouping on the canvas; like `custom.note`, frames
 * have no side effects and forward whatever input they receive so a
 * frame between two functional nodes does not break the flow.
 *
 * Mirrors NoteNodeExecutor. Without this, dragging a Section onto the
 * canvas and running the runbook throws "Unknown node type: custom.frame"
 * because the palette exposes the type but no executor handled it.
 */
export class FrameNodeExecutor extends FlatInputStep<Record<string, unknown>> {
  readonly type = 'custom.frame';

  async run(
    _config: Record<string, unknown>,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<NodeExecutionResult> {
    return input as NodeExecutionResult;
  }
}

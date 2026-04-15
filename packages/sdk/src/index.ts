export { Cairn } from './client';
export {
    CairnError,
    CairnAuthError,
    CairnNotFoundError,
    CairnTimeoutError,
    // deprecated aliases — use Cairn* instead
    NanoRunError,
    NanoRunAuthError,
    NanoRunNotFoundError,
    NanoRunTimeoutError,
} from './errors';
export type {
    CairnConfig,
    NanoRunConfig,
    RunbookSummary,
    TriggerOptions,
    TriggerResponse,
    Run,
    RunStatus,
    StepLog,
    AuditVerifyOptions,
    AuditVerifyResult,
    ApprovalStatus,
    ResolveApprovalOptions,
    ResolvedApproval,
} from './types';

import { Cairn } from './client';
/** @deprecated use {@link Cairn} */
export const NanoRun = Cairn;

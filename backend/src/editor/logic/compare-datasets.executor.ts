import {
  CompareDatasetsNodeConfig,
  CompareDatasetsResult,
  ExecutionInput,
} from '../../types/workflow.types';

export class CompareDatasetsExecutor {
  execute(config: CompareDatasetsNodeConfig, input: ExecutionInput): CompareDatasetsResult {
    const input1Field = config.inputField1 || 'input1';
    const input2Field = config.inputField2 || 'input2';
    const compareFields = config.compareFields || ['id'];
    const mergeBy = compareFields[0] || 'id';

    const input1 = (input as any)[input1Field] || [];
    const input2 = (input as any)[input2Field] || (Array.isArray(input) ? input : []);

    const oldItems = Array.isArray(input1) ? input1 : [input1];
    const newItems = Array.isArray(input2) ? input2 : [input2];

    const added: any[] = [];
    const kept: any[] = [];
    const removed: any[] = [];
    const updated: any[] = [];

    const oldMap = new Map();
    oldItems.forEach((item: any) => {
      if (item && typeof item === 'object') {
        const key = item[mergeBy];
        if (key !== undefined) oldMap.set(String(key), item);
      }
    });

    const newMap = new Map();
    newItems.forEach((item: any) => {
      if (item && typeof item === 'object') {
        const key = item[mergeBy];
        if (key !== undefined) {
          newMap.set(String(key), item);

          if (oldMap.has(String(key))) {
            const oldItem = oldMap.get(String(key));
            if (JSON.stringify(oldItem) === JSON.stringify(item)) {
              kept.push(item);
            } else {
              updated.push(item);
            }
          } else {
            added.push(item);
          }
        } else {
          added.push(item);
        }
      }
    });

    oldMap.forEach((item, key) => {
      if (!newMap.has(key)) {
        removed.push(item);
      }
    });

    return {
      ...input,
      matches: kept,
      differences: [...added, ...removed, ...updated],
      merged: [...kept, ...updated, ...added],
      count: kept.length + updated.length + added.length + removed.length,
    };
  }
}


import { createHash, createHmac, BinaryToTextEncoding, randomBytes } from 'crypto';
import { CryptoNodeConfig, CryptoResult, ExecutionInput } from '../../types/workflow.types';

export class CryptoNodeExecutor {
    execute(config: CryptoNodeConfig, input: ExecutionInput): CryptoResult {
        const operation = config.operation || 'hash';
        const algo = config.algorithm || 'sha256';
        const inputField = config.inputField || 'data';
        const value = (input as any)[inputField] || '';
        const key = config.key || '';
        const encoding = (config.encoding || 'hex') as BinaryToTextEncoding;

        let result = '';

        try {
            if (operation === 'hash') {
                result = createHash(algo).update(String(value)).digest(encoding);
            } else if (operation === 'sign') {
                if (!key) throw new Error('Key is required for signing');
                result = createHmac(algo, key).update(String(value)).digest(encoding);
            } else if (operation === 'random') {
                const bytes = parseInt(String(value)) || 32;
                result = randomBytes(bytes).toString(encoding);
            } else {
                throw new Error(`Unknown operation: ${operation}`);
            }
        } catch (error: any) {
            throw new Error(`Crypto operation failed: ${error.message}`);
        }

        return {
            ...input,
            result,
            algorithm: algo,
            encoding
        };
    }
}

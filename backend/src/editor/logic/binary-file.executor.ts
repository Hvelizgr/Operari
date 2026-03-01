
import * as fs from 'fs';
import * as path from 'path';
import { BinaryNodeConfig, BinaryResult, ExecutionInput } from '../../types/workflow.types';

export class BinaryFileExecutor {
    execute(config: BinaryNodeConfig, input: ExecutionInput): BinaryResult {
        const operation = config.operation || 'read';
        const filePath = config.filePath || '';
        const encoding = config.encoding || 'utf8';
        const content = config.content || '';
        
        // Basic security check: For this demo/MVP, we allow /tmp usage mostly.
        // In production, this should be sandboxed to a specific DATA directory.
        // We will assume the user knows what they are doing in this self-hosted environment.
        
        try {
            if (operation === 'read') {
                if (!fs.existsSync(filePath)) {
                    // Try relative to CWD if absolute fails? No, enforce absolute for clarity or safety.
                    throw new Error(`File not found: ${filePath}`);
                }
                const data = fs.readFileSync(filePath, { encoding: encoding as BufferEncoding });
                return {
                    ...input,
                    read: true,
                    filePath,
                    size: data.length,
                    data: String(data)
                };
            } else if (operation === 'write') {
                // Ensure dir exists
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, content, { encoding: encoding as BufferEncoding });
                return {
                    ...input,
                    written: true,
                    filePath,
                    size: content.length
                };
            } else {
                throw new Error(`Unknown operation: ${operation}`);
            }
        } catch (err: any) {
            throw new Error(`Binary operation failed: ${err.message}`);
        }
    }
}

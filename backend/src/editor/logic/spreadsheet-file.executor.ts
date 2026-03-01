
import { SpreadsheetNodeConfig, SpreadsheetResult, ExecutionInput } from '../../types/workflow.types';

export class SpreadsheetFileExecutor {
    execute(config: SpreadsheetNodeConfig, input: ExecutionInput): SpreadsheetResult {
        const operation = config.operation || 'read';
        const headerRow = config.headers !== false;
        const _filePath = config.filePath || '';

        let data: any[][] = [];

        if (operation === 'read') {
            const content = (input as any).content || '';
            data = this.parseCSV(content, headerRow);
        } else if (operation === 'write' || operation === 'append') {
            data = config.data || [];
        }

        return {
            ...input,
            data,
            rows: data.length,
            columns: data[0]?.length || 0,
            success: true
        };
    }

    private parseCSV(content: string, headerRow: boolean): any[][] {
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const result: any[][] = [];
        const startIndex = headerRow ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const values = this.parseLine(lines[i]);
            if (values.length === 1 && values[0] === '') continue;
            result.push(values);
        }
        return result;
    }

    private parseLine(line: string): string[] {
        const result = [];
        let current = '';
        let inQuote = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuote && line[i+1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result.map(v => v.trim());
    }
}

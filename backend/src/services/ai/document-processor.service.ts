
import * as fs from 'fs';
import * as path from 'path';
 
const pdf = require('pdf-parse');
import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';

export class DocumentProcessorService {
    private static instance: DocumentProcessorService;

    public static getInstance(): DocumentProcessorService {
        if (!DocumentProcessorService.instance) {
            DocumentProcessorService.instance = new DocumentProcessorService();
        }
        return DocumentProcessorService.instance;
    }

    async processFile(filePath: string, mimeType?: string): Promise<string> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        // PDF
        if (mimeType === 'application/pdf' || ext === '.pdf') {
            try {
                const data = await pdf(buffer);
                return data.text;
            } catch (e: any) {
                console.error('PDF parsing error', e);
                // Return empty or partial? Throwing is better.
                throw new Error(`Failed to parse PDF: ${e.message}`);
            }
        }
        
        // DOCX
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
             try {
                const result = await mammoth.extractRawText({ buffer });
                return result.value;
            } catch (e: any) {
                throw new Error(`Failed to parse DOCX: ${e.message}`);
            }
        }
        
        // HTML
        if (mimeType === 'text/html' || ext === '.html') {
             const $ = cheerio.load(buffer.toString());
             return $('body').text().replace(/\s+/g, ' ').trim();
        }
        
        // Text / Default
        // Try UTF-8 first
        return buffer.toString('utf-8');
    }
}

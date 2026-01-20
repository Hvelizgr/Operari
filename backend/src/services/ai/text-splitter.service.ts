
export class TextSplitterService {
    // Recursive character text splitter logic simplified
    static split(text: string, chunkSize: number = 1000, chunkOverlap: number = 200): string[] {
        if (!text) return [];
        
        const chunks: string[] = [];
        let cursor = 0;
        
        while (cursor < text.length) {
            // Find end of chunk
            let end = Math.min(cursor + chunkSize, text.length);
            
            // Try to break at a space/newline if possible to avoid splitting words
            if (end < text.length) {
                const spaceIndex = text.lastIndexOf(' ', end);
                const newlineIndex = text.lastIndexOf('\n', end);
                const breakPoint = Math.max(spaceIndex, newlineIndex);
                
                if (breakPoint > cursor) {
                    end = breakPoint;
                }
            }
            
            chunks.push(text.slice(cursor, end));
            
            // Move cursor respecting overlap
            cursor = end - (end < text.length ? chunkOverlap : 0);
            if (cursor >= text.length) break;
            
            // Avoid infinite loops if chunk is too small
            if (cursor <= end - chunkSize) cursor = end; 
        }
        
        return chunks;
    }
}

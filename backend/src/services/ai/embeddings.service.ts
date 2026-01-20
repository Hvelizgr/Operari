
export class EmbeddingsService {
    private static instance: EmbeddingsService;

    public static getInstance(): EmbeddingsService {
        if (!EmbeddingsService.instance) {
            EmbeddingsService.instance = new EmbeddingsService();
        }
        return EmbeddingsService.instance;
    }

    async embed(text: string, provider: string = 'openai', apiKey?: string): Promise<number[]> {
        // En un caso real, aquí llamaríamos a la API de OpenAI o HuggingFace.
        // Simularemos un vector de 1536 dimensiones (estándar de OpenAI ada-002)
        
        if (provider === 'local_mock' || !apiKey) {
            console.warn('Using mock embeddings (random noise). Results will not be semantic.');
            return Array.from({ length: 1536 }, () => Math.random());
        }

        // TODO: Implement actual API calls via fetch/axios
        // const response = await fetch('https://api.openai.com/v1/embeddings', ...);
        
        return Array.from({ length: 1536 }, () => Math.random());
    }
}

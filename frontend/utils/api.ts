const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export class ApiError extends Error {
    code?: string;
    status: number;
    requestId?: string;
    response?: {
        data: any;
        status: number;
    };

    constructor(message: string, status: number, data?: any, code?: string, requestId?: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.requestId = requestId;
        this.response = {
            data,
            status
        };
    }
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nanoflow_token') : null;
    
    const existingHeaders = options.headers as Record<string, string> | undefined;
    const headers: Record<string, string> = {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...existingHeaders,
    };

    // Only set Content-Type to application/json if not already set and not FormData
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // If it's multipart/form-data, let the browser set it (including boundary)
    if (headers['Content-Type'] === 'multipart/form-data') {
        delete headers['Content-Type'];
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const requestId = response.headers.get('x-request-id') || undefined;
        throw new ApiError(
            errorData.message || errorData.error || 'Request failed',
            response.status,
            errorData,
            errorData.code,
            requestId
        );
    }

    return response.json();
}

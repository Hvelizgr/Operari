/**
 * CDN and Multi-Region Configuration
 * Used for geographic distribution and asset caching
 */

export interface CDNConfig {
    enabled: boolean;
    provider: 'cloudflare' | 'aws-cloudfront' | 'gcp-cdn' | 'custom';
    baseUrl: string;
    regions: RegionConfig[];
}

export interface RegionConfig {
    id: string;
    name: string;
    endpoint: string;
    isPrimary: boolean;
    healthCheck: string;
}

// Default multi-region configuration
export const DEFAULT_CDN_CONFIG: CDNConfig = {
    enabled: false,
    provider: 'cloudflare',
    baseUrl: process.env.CDN_BASE_URL || '',
    regions: [
        {
            id: 'us-east',
            name: 'US East (Virginia)',
            endpoint: 'https://us-east.nanoflow.io',
            isPrimary: true,
            healthCheck: '/health'
        },
        {
            id: 'eu-west',
            name: 'EU West (Ireland)',
            endpoint: 'https://eu-west.nanoflow.io',
            isPrimary: false,
            healthCheck: '/health'
        },
        {
            id: 'ap-southeast',
            name: 'Asia Pacific (Singapore)',
            endpoint: 'https://ap-southeast.nanoflow.io',
            isPrimary: false,
            healthCheck: '/health'
        }
    ]
};

export class CDNService {
    private static instance: CDNService;
    private config: CDNConfig;

    private constructor() {
        this.config = DEFAULT_CDN_CONFIG;
    }

    public static getInstance(): CDNService {
        if (!CDNService.instance) {
            CDNService.instance = new CDNService();
        }
        return CDNService.instance;
    }

    /**
     * Get the best region for a given client location
     */
    public getBestRegion(clientCountry?: string): RegionConfig {
        if (!this.config.enabled || !clientCountry) {
            return this.config.regions.find(r => r.isPrimary) || this.config.regions[0];
        }

        // Simple geo-routing logic
        const countryToRegion: Record<string, string> = {
            // North America
            'US': 'us-east', 'CA': 'us-east', 'MX': 'us-east',
            // Europe
            'GB': 'eu-west', 'DE': 'eu-west', 'FR': 'eu-west', 'ES': 'eu-west', 'IT': 'eu-west',
            // Asia Pacific
            'SG': 'ap-southeast', 'AU': 'ap-southeast', 'JP': 'ap-southeast', 'KR': 'ap-southeast'
        };

        const regionId = countryToRegion[clientCountry] || 'us-east';
        return this.config.regions.find(r => r.id === regionId) || this.config.regions[0];
    }

    /**
     * Get CDN URL for an asset
     */
    public getAssetUrl(path: string): string {
        if (!this.config.enabled || !this.config.baseUrl) {
            return path;
        }
        return `${this.config.baseUrl}${path}`;
    }

    /**
     * Health check all regions
     */
    public async healthCheckAllRegions(): Promise<Record<string, boolean>> {
        const axios = require('axios');
        const results: Record<string, boolean> = {};

        for (const region of this.config.regions) {
            try {
                const response = await axios.get(`${region.endpoint}${region.healthCheck}`, {
                    timeout: 5000
                });
                results[region.id] = response.status === 200;
            } catch {
                results[region.id] = false;
            }
        }

        return results;
    }

    /**
     * Get configuration
     */
    public getConfig(): CDNConfig {
        return this.config;
    }

    /**
     * Update configuration
     */
    public updateConfig(config: Partial<CDNConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

export const cdnService = CDNService.getInstance();

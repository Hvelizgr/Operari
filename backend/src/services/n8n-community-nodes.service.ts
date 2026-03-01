import axios from 'axios';

export type NodeSource = 'github' | 'ncnodes' | 'npm';

export interface CommunityNode {
    name: string;
    description: string;
    version: string;
    author: string;
    downloads?: number;
    stars?: number;
    keywords: string[];
    repository?: string;
    homepage?: string;
    source: NodeSource;
    category?: string;
    lastUpdated?: string;
}

export interface SearchResult {
    nodes: CommunityNode[];
    sources: {
        github: number;
        ncnodes: number;
        npm: number;
    };
    total: number;
}

export class N8nCommunityNodesService {
    private static instance: N8nCommunityNodesService;
    private readonly NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search';
    private readonly KEYWORD = 'n8n-community-node-package';
    private readonly AWESOME_N8N_RAW = 'https://raw.githubusercontent.com/restyler/awesome-n8n/main/README.md';
    private readonly NCNODES_API = 'https://ncnodes.com/api/nodes';
    
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 3600000;

    public static getInstance(): N8nCommunityNodesService {
        if (!N8nCommunityNodesService.instance) {
            N8nCommunityNodesService.instance = new N8nCommunityNodesService();
        }
        return N8nCommunityNodesService.instance;
    }

    async searchAll(query?: string, limit = 50): Promise<SearchResult> {
        const [githubNodes, ncnodesNodes, npmNodes] = await Promise.allSettled([
            this.searchGitHub(query, limit),
            this.searchNCNodes(query, limit),
            this.searchNpm(query, Math.floor(limit / 2)),
        ]);

        const allNodes: CommunityNode[] = [];
        const sources = { github: 0, ncnodes: 0, npm: 0 };

        if (githubNodes.status === 'fulfilled') {
            allNodes.push(...githubNodes.value);
            sources.github = githubNodes.value.length;
        }

        if (ncnodesNodes.status === 'fulfilled') {
            allNodes.push(...ncnodesNodes.value);
            sources.ncnodes = ncnodesNodes.value.length;
        }

        if (npmNodes.status === 'fulfilled') {
            const uniqueNpm = npmNodes.value.filter(
                npm => !allNodes.some(n => n.name === npm.name || n.repository === npm.repository)
            );
            allNodes.push(...uniqueNpm);
            sources.npm = uniqueNpm.length;
        }

        const sorted = this.sortByPopularity(allNodes);
        
        return {
            nodes: query ? this.filterByQuery(sorted, query).slice(0, limit) : sorted.slice(0, limit),
            sources,
            total: allNodes.length,
        };
    }

    async searchGitHub(query?: string, limit = 50): Promise<CommunityNode[]> {
        const cacheKey = `github_${query || 'all'}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached.slice(0, limit);

        try {
            const response = await axios.get(this.AWESOME_N8N_RAW, { timeout: 10000 });
            const readme = response.data;
            const nodes = this.parseAwesomeN8nReadme(readme);
            
            this.setCache(cacheKey, nodes);
            return query ? this.filterByQuery(nodes, query).slice(0, limit) : nodes.slice(0, limit);
        } catch (error) {
            console.error('Error fetching GitHub awesome-n8n:', error);
            return [];
        }
    }

    async searchNCNodes(query?: string, limit = 50): Promise<CommunityNode[]> {
        const cacheKey = `ncnodes_${query || 'all'}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached.slice(0, limit);

        try {
            const params: Record<string, any> = { limit, offset: 0 };
            if (query) params.q = query;

            const response = await axios.get(this.NCNODES_API, { 
                params, 
                timeout: 10000,
                headers: { 'Accept': 'application/json' }
            });

            const nodes: CommunityNode[] = (response.data.nodes || response.data || []).map((node: any) => ({
                name: node.name || node.title,
                description: node.description || node.summary || '',
                version: node.version || 'latest',
                author: node.author || node.maintainer || 'Community',
                downloads: node.downloads || node.installs || 0,
                stars: node.stars || 0,
                keywords: node.tags || node.keywords || [],
                repository: node.repository || node.github || node.url,
                homepage: node.homepage || node.website || `https://ncnodes.com/nodes/${node.slug || node.name}`,
                source: 'ncnodes' as NodeSource,
                category: node.category,
                lastUpdated: node.updatedAt || node.lastUpdate,
            }));

            this.setCache(cacheKey, nodes);
            return nodes.slice(0, limit);
        } catch (error) {
            console.error('Error fetching NCNodes:', error);
            return [];
        }
    }

    async searchNpm(query?: string, limit = 50): Promise<CommunityNode[]> {
        const searchQuery = query 
            ? `keywords:${this.KEYWORD} ${query}`
            : `keywords:${this.KEYWORD}`;

        try {
            const response = await axios.get(this.NPM_SEARCH_URL, {
                params: { text: searchQuery, size: limit },
                timeout: 10000,
            });

            return response.data.objects.map((obj: any) => ({
                name: obj.package.name,
                description: obj.package.description || '',
                version: obj.package.version,
                author: obj.package.author?.name || obj.package.publisher?.username || 'Unknown',
                downloads: obj.downloads?.weekly || 0,
                keywords: obj.package.keywords || [],
                repository: obj.package.links?.repository,
                homepage: obj.package.links?.homepage || obj.package.links?.npm,
                source: 'npm' as NodeSource,
                lastUpdated: obj.package.date,
            }));
        } catch (error) {
            console.error('Error fetching npm:', error);
            return [];
        }
    }

    async getPopularNodes(limit = 20): Promise<SearchResult> {
        return this.searchAll(undefined, limit);
    }

    async getNodeDetails(packageName: string): Promise<any> {
        const response = await axios.get(`https://registry.npmjs.org/${packageName}`);
        const pkg = response.data;
        const latestVersion = pkg['dist-tags']?.latest;
        const versionData = pkg.versions?.[latestVersion] || {};

        return {
            name: pkg.name,
            description: pkg.description,
            version: latestVersion,
            author: pkg.author?.name || 'Unknown',
            license: pkg.license,
            repository: pkg.repository?.url,
            homepage: pkg.homepage,
            readme: pkg.readme,
            n8nConfig: versionData.n8n || {},
            credentials: versionData.n8n?.credentials || [],
            nodes: versionData.n8n?.nodes || [],
            dependencies: versionData.dependencies || {},
            peerDependencies: versionData.peerDependencies || {},
        };
    }

    async checkCompatibility(packageName: string): Promise<{ compatible: boolean; issues: string[] }> {
        const details = await this.getNodeDetails(packageName);
        const issues: string[] = [];

        if (!details.n8nConfig || Object.keys(details.n8nConfig).length === 0) {
            issues.push('Missing n8n configuration in package.json');
        }

        if (!details.nodes || details.nodes.length === 0) {
            issues.push('No nodes defined in package');
        }

        const runtimeDeps = Object.keys(details.dependencies || {});
        if (runtimeDeps.length > 5) {
            issues.push(`High dependency count (${runtimeDeps.length}), may affect performance`);
        }

        return { compatible: issues.length === 0, issues };
    }

    private parseAwesomeN8nReadme(readme: string): CommunityNode[] {
        const nodes: CommunityNode[] = [];
        const lines = readme.split('\n');
        let currentCategory = '';

        for (const line of lines) {
            if (line.startsWith('## ') || line.startsWith('### ')) {
                currentCategory = line.replace(/^#+\s*/, '').trim();
                continue;
            }

            const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)\s*[-–]\s*(.+)/);
            if (linkMatch) {
                const [, name, url, description] = linkMatch;
                
                if (url.includes('github.com') || url.includes('npmjs.com') || url.includes('n8n')) {
                    const starsMatch = description.match(/(\d+\.?\d*k?)\s*(?:stars?|⭐)/i);
                    let stars = 0;
                    if (starsMatch) {
                        const starStr = starsMatch[1].toLowerCase();
                        stars = starStr.includes('k') 
                            ? parseFloat(starStr.replace('k', '')) * 1000 
                            : parseInt(starStr, 10);
                    }

                    nodes.push({
                        name: name.trim(),
                        description: description.replace(/\s*\d+\.?\d*k?\s*(?:stars?|⭐)/gi, '').trim(),
                        version: 'latest',
                        author: this.extractAuthorFromUrl(url),
                        stars,
                        downloads: 0,
                        keywords: currentCategory ? [currentCategory.toLowerCase()] : [],
                        repository: url.includes('github.com') ? url : undefined,
                        homepage: url,
                        source: 'github',
                        category: currentCategory,
                    });
                }
            }
        }

        return nodes;
    }

    private extractAuthorFromUrl(url: string): string {
        const githubMatch = url.match(/github\.com\/([^/]+)/);
        if (githubMatch) return githubMatch[1];
        
        const npmMatch = url.match(/npmjs\.com\/~([^/]+)/);
        if (npmMatch) return npmMatch[1];
        
        return 'Community';
    }

    private filterByQuery(nodes: CommunityNode[], query: string): CommunityNode[] {
        const q = query.toLowerCase();
        return nodes.filter(n => 
            n.name.toLowerCase().includes(q) ||
            n.description.toLowerCase().includes(q) ||
            n.keywords.some(k => k.toLowerCase().includes(q)) ||
            n.category?.toLowerCase().includes(q)
        );
    }

    private sortByPopularity(nodes: CommunityNode[]): CommunityNode[] {
        return nodes.sort((a, b) => {
            const scoreA = (a.stars || 0) * 10 + (a.downloads || 0);
            const scoreB = (b.stars || 0) * 10 + (b.downloads || 0);
            return scoreB - scoreA;
        });
    }

    private getFromCache(key: string): any | null {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    private setCache(key: string, data: any): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
}

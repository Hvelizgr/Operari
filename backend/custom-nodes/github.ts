
export const id = 'github-node';
export const name = 'GitHub';
export const description = 'Interact with GitHub API';
export const version = '1.0.0';

export class GitHubNode {
    meta = {
        name: 'GitHub',
        version: '1.0.0',
        description: 'Interact with GitHub API',
        author: 'NanoFlow',
        category: 'Developer',
        icon: 'github'
    };

    async execute(input: any, context: any) {
        context.log('Executing GitHub Node...');
        
        const { operation, owner, repo, token, issueTitle, issueBody } = input;
        
        if (!owner || !repo) {
            throw new Error('Owner and Repo are required');
        }

        const axios = require('axios');
        const headers: any = {
            'Accept': 'application/vnd.github.v3+json',
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        try {
            if (operation === 'createIssue') {
                if (!token) throw new Error('Token is required to create issues');
                context.log(`Creating issue in ${owner}/${repo}`);
                const response = await axios.post(`https://api.github.com/repos/${owner}/${repo}/issues`, {
                    title: issueTitle,
                    body: issueBody
                }, { headers });
                return response.data;
            }

            // Default: Get Repo Info
            context.log(`Fetching repo info for ${owner}/${repo}`);
            const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
            return response.data;
        } catch (error: any) {
            context.log(`GitHub node error: ${error.message}`);
            throw new Error(`GitHub API request failed: ${error.message}`);
        }
    }
}

export const executor = new GitHubNode();

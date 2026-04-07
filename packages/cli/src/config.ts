import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CliConfig {
    apiKey: string;
    baseURL: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.nanorun');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigPath(): string {
    return CONFIG_FILE;
}

export function loadConfig(): CliConfig | null {
    try {
        if (!fs.existsSync(CONFIG_FILE)) return null;
        const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(content) as CliConfig;
    } catch {
        return null;
    }
}

export function saveConfig(config: CliConfig): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearConfig(): boolean {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            fs.unlinkSync(CONFIG_FILE);
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export function requireConfig(): CliConfig {
    const config = loadConfig();
    if (!config) {
        console.error('Not logged in. Run `nanorun login` first.');
        process.exit(1);
    }
    return config;
}

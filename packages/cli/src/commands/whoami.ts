import { loadConfig } from '../config';
import { colors, symbols } from '../colors';

export function whoamiCommand() {
    const config = loadConfig();
    if (!config) {
        console.log(colors.dim('Not logged in. Run `cairn login`.'));
        process.exit(1);
    }
    console.log(`${colors.bold('Cairn CLI')}`);
    console.log(`  ${colors.dim('Server:')}  ${config.baseURL}`);
    console.log(`  ${colors.dim('API Key:')} ${colors.cyan(config.apiKey.substring(0, 12))}${colors.dim('...')}`);
}

import * as readline from 'readline';
import { NanoRun } from '@nanorun/sdk';
import { saveConfig } from '../config';
import { colors, symbols } from '../colors';

interface LoginOptions {
    apiKey?: string;
    baseUrl?: string;
}

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

export async function loginCommand(options: LoginOptions = {}) {
    console.log(colors.bold(`${symbols.dot} NanoRun login`));
    console.log(colors.dim('  Get your API key from your NanoRun dashboard.\n'));

    let baseURL = options.baseUrl;
    if (!baseURL) {
        const input = await prompt(`  API URL ${colors.dim('(default: http://localhost:4000)')}: `);
        baseURL = input.trim() || 'http://localhost:4000';
    }

    let apiKey = options.apiKey;
    if (!apiKey) {
        apiKey = (await prompt('  API Key: ')).trim();
    }

    if (!apiKey || !apiKey.startsWith('nr_')) {
        console.error(colors.red(`${symbols.cross} Invalid API key. Must start with "nr_".`));
        process.exit(1);
    }

    // Verify the key works
    process.stdout.write(colors.dim('  Verifying...'));
    try {
        const client = new NanoRun({ apiKey, baseURL });
        await client.listRunbooks();
        process.stdout.write('\r' + ' '.repeat(20) + '\r');
    } catch (err) {
        process.stdout.write('\r' + ' '.repeat(20) + '\r');
        const msg = err instanceof Error ? err.message : String(err);
        console.error(colors.red(`${symbols.cross} Verification failed: ${msg}`));
        process.exit(1);
    }

    saveConfig({ apiKey, baseURL });
    console.log(colors.green(`${symbols.check} Logged in successfully`));
    console.log(colors.dim(`  Connected to ${baseURL}`));
}

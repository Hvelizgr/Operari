const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '../messages');
const DEFAULT_LOCALE = 'en';

function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(getKeys(obj[key], `${prefix}${key}.`));
        } else {
            keys.push(`${prefix}${key}`);
        }
    }
    return keys;
}

function checkMissingTranslations() {
    const defaultMessagesPath = path.join(MESSAGES_DIR, `${DEFAULT_LOCALE}.json`);

    if (!fs.existsSync(defaultMessagesPath)) {
        console.error(`Default locale file not found: ${defaultMessagesPath}`);
        process.exit(1);
    }

    const defaultMessages = JSON.parse(fs.readFileSync(defaultMessagesPath, 'utf8'));
    const defaultKeys = getKeys(defaultMessages);

    const files = fs.readdirSync(MESSAGES_DIR);
    let hasError = false;

    files.forEach(file => {
        if (file === `${DEFAULT_LOCALE}.json` || !file.endsWith('.json')) return;

        const locale = file.replace('.json', '');
        const messages = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf8'));
        const keys = getKeys(messages);

        const missingKeys = defaultKeys.filter(key => !keys.includes(key));

        if (missingKeys.length > 0) {
            hasError = true;
            console.error(`\nMissing translations for locale '${locale}':`);
            missingKeys.forEach(key => console.error(`  - ${key}`));
        } else {
            console.log(`\nLocale '${locale}' is complete.`);
        }
    });

    if (hasError) {
        process.exit(1);
    } else {
        console.log('\nAll translations are complete!');
    }
}

checkMissingTranslations();

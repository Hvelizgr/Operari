import { clearConfig } from '../config';
import { colors, symbols } from '../colors';

export function logoutCommand() {
    const cleared = clearConfig();
    if (cleared) {
        console.log(colors.green(`${symbols.check} Logged out`));
    } else {
        console.log(colors.dim('Not logged in.'));
    }
}

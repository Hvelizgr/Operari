import { parse } from 'url';

function isIPv4(str: string): boolean {
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;
  return ipv4Regex.test(str);
}

function isIPv6(str: string): boolean {
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  return ipv6Regex.test(str);
}

function isIP(str: string): boolean {
  return isIPv4(str) || isIPv6(str);
}

export class SecurityService {
  static isSafeUrl(urlString: string): boolean {
    try {
      const parsed = parse(urlString);
      if (!parsed.hostname) return false;

      const privateRanges = [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^::1$/,
        /^fc00:/,
        /^fe80:/,
        /^localhost$/i
      ];

      if (isIP(parsed.hostname)) {
        return !privateRanges.some(regex => regex.test(parsed.hostname!));
      }

      if (/^localhost$/i.test(parsed.hostname)) {
        return false;
      }

      return true; 
    } catch {
      return false;
    }
  }

  static redactPII(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
        .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CARD_REDACTED]')
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactPII(item));
    }

    if (typeof data === 'object' && data !== null) {
      const redacted: any = {};
      for (const key in data) {
        if (['password', 'secret', 'token', 'apiKey', 'key'].some(k => key.toLowerCase().includes(k))) {
          redacted[key] = '[SENSITIVE_REDACTED]';
        } else {
          redacted[key] = this.redactPII(data[key]);
        }
      }
      return redacted;
    }

    return data;
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
      .replace(/on\w+="[^"]*"/gim, '')
      .replace(/javascript:/gim, '');
  }
}

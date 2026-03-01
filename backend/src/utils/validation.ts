/**
 * Safe parseInt that handles NaN cases
 * @param value - The value to parse
 * @param defaultValue - Default value if parsing fails
 * @param radix - The radix (default: 10)
 */
export function safeParseInt(value: string | undefined | null, defaultValue: number, radix = 10): number {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    const parsed = parseInt(value, radix);
    return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safe parseFloat that handles NaN cases
 */
export function safeParseFloat(value: string | undefined | null, defaultValue: number): number {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validate and parse pagination parameters
 */
export function parsePagination(query: { page?: string; limit?: string }, defaults = { page: 1, limit: 20 }) {
    const page = safeParseInt(query.page, defaults.page);
    const limit = safeParseInt(query.limit, defaults.limit);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

/**
 * Validate and parse days parameter for date ranges
 */
export function parseDays(days: string | undefined, defaultDays = 30): number {
    return safeParseInt(days, defaultDays);
}

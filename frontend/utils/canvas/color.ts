/**
 * Color-string manipulation helpers used across the canvas renderer.
 * Kept in a leaf module with no imports so both `drawing.ts` and
 * `prefs.ts` can pull from here without creating a cycle.
 */

/**
 * Parse an RGB-ish color string and return it with the provided alpha.
 * Handles `#rgb` / `#rrggbb` / existing `rgb()` / `rgba()`. Used so the
 * canvas shadow color tracks the stroke color even when the user picks
 * a custom status hex. Falls back to a sensible blue-gray if the input
 * is unparseable — never throws.
 */
export function colorWithAlpha(color: string, alpha: number): string {
  if (!color) return `rgba(96, 165, 250, ${alpha})`;
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    const h = trimmed.slice(1);
    const full =
      h.length === 3
        ? h
            .split('')
            .map(c => c + c)
            .join('')
        : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(150, 150, 160, ${alpha})`;
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (trimmed.startsWith('rgba')) {
    return trimmed.replace(/rgba\(([^)]+)\)/, (_, rest: string) => {
      const parts = rest.split(',').map((p: string) => p.trim());
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    });
  }
  if (trimmed.startsWith('rgb')) {
    return trimmed.replace(/rgb\(([^)]+)\)/, (_, rest: string) => `rgba(${rest}, ${alpha})`);
  }
  return trimmed;
}

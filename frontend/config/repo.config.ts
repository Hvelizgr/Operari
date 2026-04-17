/**
 * Single source of truth for the public GitHub repo URL the marketing
 * landing links to. When the repo is published (or renamed from the
 * legacy `NanoFlow` slug to `nanorun`), this is the only file that
 * needs to change.
 *
 * The owner/slug split lets the clone snippet stay in sync with the
 * URLs without duplicating the literal anywhere else.
 *
 * Override at build time with the `NEXT_PUBLIC_REPO_OWNER` /
 * `NEXT_PUBLIC_REPO_SLUG` env vars if you fork or rename.
 */
const owner = process.env.NEXT_PUBLIC_REPO_OWNER ?? 'Hvelizgr';
const slug = process.env.NEXT_PUBLIC_REPO_SLUG ?? 'NanoRun';

const base = `https://github.com/${owner}/${slug}`;

export const repo = {
    owner,
    slug,
    base,
    readme: `${base}#readme`,
    status: `${base}#status`,
    notWorkingYet: `${base}#what-does-not-work-yet`,
    roadmap: `${base}#roadmap`,
    issues: `${base}/issues`,
    discussions: `${base}/discussions`,
    license: `${base}/blob/main/LICENSE`,
    contributing: `${base}/blob/main/CONTRIBUTING.md`,
    templatesTree: `${base}/tree/main/templates`,
    templateFile: (templateSlug: string) =>
        `${base}/blob/main/templates/${templateSlug}.yaml`,
    /** Display label without the protocol — used in the footer. */
    displayHost: `github.com/${owner}/${slug}`,
    /** Two-line clone+up snippet rendered in the CTA code block. */
    cloneSnippet: `git clone ${base}\ncd ${slug} && docker compose up`,
} as const;

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Copy, GitBranch, Loader2, RefreshCw, Shield, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

// commit-graph uses browser APIs, so we load it client-only
const CommitGraph = dynamic(
  () => import('commit-graph').then(mod => mod.CommitGraph ?? mod.default),
  { ssr: false }
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/* ------------------------------------------------------------------ */
/*  Types matching our backend                                         */
/* ------------------------------------------------------------------ */

interface BackendBranch {
  name: string;
  sha: string;
  protected: boolean;
}

interface BackendCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
}

interface GraphData {
  branches: BackendBranch[];
  commits: BackendCommit[];
  defaultBranch: string;
}

/* ------------------------------------------------------------------ */
/*  i18n                                                               */
/* ------------------------------------------------------------------ */

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
  en: {
    title: 'GitHub Branches',
    subtitle: 'Visualize repository branches like GitKraken.',
    repoLabel: 'Repository',
    repoPlaceholder: 'owner/repo',
    load: 'Load',
    loading: 'Loading branch graph...',
    loadFailed: 'Failed to load graph',
    empty: 'No branches found. Check the repo name and your GitHub token.',
    branches: 'Branches',
    protected: 'Protected',
    copied: 'Copied!',
    runFrom: 'Run from this branch',
    noToken: 'Connect a GitHub account in Settings to use this feature.',
  },
  es: {
    title: 'Ramas de GitHub',
    subtitle: 'Visualiza ramas del repositorio como GitKraken.',
    repoLabel: 'Repositorio',
    repoPlaceholder: 'owner/repo',
    load: 'Cargar',
    loading: 'Cargando grafo de ramas...',
    loadFailed: 'Error al cargar el grafo',
    empty: 'No se encontraron ramas. Verifica el nombre del repo y tu token de GitHub.',
    branches: 'Ramas',
    protected: 'Protegida',
    copied: 'Copiado!',
    runFrom: 'Ejecutar desde esta rama',
    noToken: 'Conecta una cuenta de GitHub en Configuracion para usar esta funcionalidad.',
  },
};

/* ------------------------------------------------------------------ */
/*  Graph color palette (GitKraken-inspired)                           */
/* ------------------------------------------------------------------ */

const BRANCH_COLORS = [
  '#2dd4bf', // teal
  '#818cf8', // indigo
  '#f472b6', // pink
  '#fb923c', // orange
  '#a3e635', // lime
  '#38bdf8', // sky
  '#e879f9', // fuchsia
  '#fbbf24', // amber
  '#34d399', // emerald
  '#f87171', // red
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface GitHubBranchPanelProps {
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GitHubBranchPanel({ open, onClose, lang }: GitHubBranchPanelProps) {
  const t = STRINGS[lang];

  const [repoInput, setRepoInput] = useState('');
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedBranch, setCopiedBranch] = useState<string | null>(null);

  const fetchGraph = useCallback(
    async (ownerRepo: string) => {
      const parts = ownerRepo.replace('https://github.com/', '').split('/');
      if (parts.length < 2) return;
      const [owner, repo] = parts;

      setLoading(true);
      setError(null);
      setGraph(null);

      try {
        const res = await fetch(`${API_BASE}/api/github/${owner}/${repo}/graph`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        setGraph(json.data);
      } catch (err) {
        setError(`${t.loadFailed}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    },
    [t.loadFailed]
  );

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBranch(text);
    setTimeout(() => setCopiedBranch(null), 1500);
  };

  const handleSubmit = () => {
    if (repoInput.trim()) fetchGraph(repoInput.trim());
  };

  // Reset state when panel closes
  useEffect(() => {
    if (!open) {
      setError(null);
    }
  }, [open]);

  /* -- Transform backend data → commit-graph props -- */

  const commitGraphData = graph
    ? graph.commits.map(c => ({
        sha: c.sha,
        commit: {
          author: {
            name: c.author,
            date: c.date,
          },
          message: c.message,
        },
        parents: c.parents.map(p => ({ sha: p })),
      }))
    : [];

  const branchHeads = graph
    ? graph.branches.map(b => ({
        name: b.name,
        commit: { sha: b.sha },
      }))
    : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute bottom-0 right-0 top-0 z-40 flex w-[520px] flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
          initial={{ x: '100%', opacity: 1 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          onWheel={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {/* ---- Header ---- */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800/50 px-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <GitBranch size={16} className="text-teal-400" />
              {t.title}
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* ---- Repo input ---- */}
          <div className="shrink-0 border-b border-slate-700/50 px-4 py-3">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {t.repoLabel}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={repoInput}
                onChange={e => setRepoInput(e.target.value)}
                placeholder={t.repoPlaceholder}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSubmit();
                }}
                className="flex-1 rounded border border-slate-700 bg-black/20 px-3 py-1.5 text-sm text-slate-200 transition-colors placeholder:text-slate-600 focus:border-teal-500 focus:outline-none"
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !repoInput.trim()}
                className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-40"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : t.load}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">{t.subtitle}</p>
          </div>

          {/* ---- Content ---- */}
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                {t.loading}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-4 mt-4 flex items-start gap-2 rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-[11px] text-red-300">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && graph && graph.branches.length === 0 && (
              <div className="mx-4 mt-4 rounded border border-slate-700 bg-black/20 px-3 py-3 text-[11px] text-slate-400">
                {t.empty}
              </div>
            )}

            {/* ---- Git Graph (GitKraken-style) ---- */}
            {!loading && graph && graph.commits.length > 0 && (
              <div className="commit-graph-wrapper">
                <CommitGraph
                  commits={commitGraphData}
                  branchHeads={branchHeads}
                  currentBranch={graph.defaultBranch}
                  graphStyle={{
                    commitSpacing: 50,
                    branchSpacing: 25,
                    branchColors: BRANCH_COLORS,
                    nodeRadius: 5,
                  }}
                />
              </div>
            )}

            {/* ---- Branch list ---- */}
            {!loading && graph && graph.branches.length > 0 && (
              <div className="border-t border-slate-700/50 px-4 py-3">
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t.branches} ({graph.branches.length})
                </h3>
                <ul className="space-y-1.5">
                  {graph.branches.map(branch => (
                    <li
                      key={branch.name}
                      className="group flex items-center gap-2 rounded border border-slate-700/50 bg-black/20 px-3 py-2 transition-colors hover:border-slate-600"
                    >
                      <GitBranch
                        size={13}
                        className={
                          branch.name === graph.defaultBranch ? 'text-teal-400' : 'text-slate-500'
                        }
                      />
                      <span className="flex-1 truncate font-mono text-[11px] text-slate-200">
                        {branch.name}
                      </span>

                      {branch.protected && <Shield size={11} className="shrink-0 text-amber-400" />}

                      <code className="shrink-0 font-mono text-[10px] text-slate-500">
                        {branch.sha.slice(0, 7)}
                      </code>

                      {/* Copy */}
                      <button
                        onClick={() => handleCopy(branch.name)}
                        className="p-0.5 text-slate-400 opacity-0 transition-all hover:text-white group-hover:opacity-100"
                        title="Copy branch name"
                      >
                        {copiedBranch === branch.name ? (
                          <Check size={12} className="text-green-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Initial empty state (no search yet) */}
            {!loading && !error && !graph && (
              <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
                <GitBranch size={40} className="mb-4 text-slate-700" />
                <p className="mb-1 text-sm text-slate-400">
                  {lang === 'en'
                    ? 'Enter a repository to visualize its branches'
                    : 'Ingresa un repositorio para visualizar sus ramas'}
                </p>
                <p className="text-[11px] text-slate-600">
                  {lang === 'en' ? 'e.g. vercel/next.js' : 'ej. vercel/next.js'}
                </p>
              </div>
            )}
          </div>

          {/* ---- Footer: refresh button ---- */}
          {graph && (
            <div className="flex shrink-0 items-center justify-between border-t border-slate-700 bg-slate-800/30 px-4 py-2">
              <span className="text-[10px] text-slate-500">
                {graph.commits.length} commits / {graph.branches.length} branches
              </span>
              <button
                onClick={() => fetchGraph(repoInput.trim())}
                disabled={loading}
                className="flex items-center gap-1 text-[10px] text-slate-400 transition-colors hover:text-white disabled:opacity-40"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

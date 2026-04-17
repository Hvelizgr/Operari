export const templateStrings = {
    en: {
        list: {
            eyebrow: 'Runbook library',
            title: 'Start from a working runbook.',
            subtitle:
                'Every template is a real, committable YAML — drop one into your workspace, edit the variables, trigger it. Zero blank canvas.',
            stepsLabel: 'steps',
            viewCta: 'View runbook',
            empty: 'No templates available yet.',
            backToHome: 'Back to home',
            categoryAll: 'All',
        },
        detail: {
            eyebrow: 'Runbook template',
            stepsLabel: 'steps',
            useCta: 'Use this runbook',
            useCtaSignup: 'Sign up to use this',
            copyCta: 'Copy YAML',
            copiedCta: 'Copied',
            yamlHeader: 'YAML source',
            graphHeader: 'Graph preview',
            graphHint: 'Auto-laid-out preview of the runbook DAG. The editor renders the same graph when you click "Use this runbook".',
            backToList: 'All templates',
            notFoundTitle: 'Template not found.',
            notFoundBody:
                'The slug in the URL does not match any runbook in our curated library. Go back and pick another.',
            creatingCta: 'Creating…',
            createError: 'Could not create the runbook. Try again in a moment.',
        },
    },
    es: {
        list: {
            eyebrow: 'Biblioteca de runbooks',
            title: 'Arrancá con un runbook que ya funciona.',
            subtitle:
                'Cada template es un YAML real, commiteable — lo dropeás en tu workspace, cambiás las variables, lo disparás. Cero canvas en blanco.',
            stepsLabel: 'steps',
            viewCta: 'Ver runbook',
            empty: 'Sin templates disponibles todavía.',
            backToHome: 'Volver al inicio',
            categoryAll: 'Todos',
        },
        detail: {
            eyebrow: 'Template de runbook',
            stepsLabel: 'steps',
            useCta: 'Usar este runbook',
            useCtaSignup: 'Registrate para usarlo',
            copyCta: 'Copiar YAML',
            copiedCta: 'Copiado',
            yamlHeader: 'Código YAML',
            graphHeader: 'Vista previa del grafo',
            graphHint: 'Vista auto-acomodada del DAG del runbook. El editor muestra el mismo grafo cuando hacés clic en "Usar este runbook".',
            backToList: 'Todos los templates',
            notFoundTitle: 'Template no encontrado.',
            notFoundBody:
                'El slug de la URL no coincide con ningún runbook de la biblioteca. Volvé y elegí otro.',
            creatingCta: 'Creando…',
            createError: 'No se pudo crear el runbook. Probá de nuevo en un momento.',
        },
    },
} as const;

export type TemplateLang = keyof typeof templateStrings;

export interface TemplateMeta {
    file: string;
    slug: string;
    name: string;
    description: string | null;
    category: string | null;
    stepCount: number;
    yaml: string;
}

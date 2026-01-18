export const content = {
  seo: {
    title: "NanoFlow - Plataforma de Gobernanza y Educación n8n",
    description: "La capa que le falta a n8n. Autocorrección para escuelas, políticas para empresas y chequeos de salud para desarrolladores.",
    openGraph: {
      title: "NanoFlow - Controla tu Automatización",
      description: "Asegura tus instancias n8n. Gestiona estudiantes, impón políticas y audita logs.",
    }
  },
  navigation: {
    product: "Producto",
    solutions: "Soluciones",
    pricing: "Precios",
    docs: "Docs",
    login: "Ingresar",
    getStarted: "Comenzar"
  },
  hero: {
    badge: "Nuevo: Workflow Doctor 1.0",
    title: "La Capa de Gobernanza\npara Automatización n8n.",
    subtitle: "Detén el caos. Gestiona estudiantes, impón políticas de seguridad y califica tareas automáticamente en tu n8n existente.",
    ctaPrimary: "Diagnosticar Flujos",
    ctaSecondary: "Para Escuelas y Equipos"
  },
  editor: {
    title: "Visualiza y Audita",
    description: "NanoFlow no solo construye; verifica. Nuestro motor escanea tus JSONs de n8n buscando riesgos de seguridad, malas prácticas y criterios de calificación.",
    nodes: {
      webhook: "Chequeo Política",
      transform: "Escáner Secretos",
      api: "Auto-Calificador",
      db: "Log Auditoría"
    }
  },
  useCases: {
    title: "¿Quién usa NanoFlow?",
    items: [
      {
        title: "Educación (Escuelas)",
        description: "Califica automáticamente 30 tareas. Dale a cada alumno un espacio seguro y privado."
      },
      {
        title: "Empresas (DevOps)",
        description: "Evita el 'Shadow IT'. Impón reglas como 'No llamadas HTTP a IPs desconocidas' antes de ejecutar."
      },
      {
        title: "Freelancers",
        description: "El 'Workflow Doctor' analiza tus flujos buscando cuellos de botella y fugas de seguridad."
      }
    ]
  },
  howItWorks: {
    title: "Cómo funciona",
    steps: [
      {
        title: "Conectar",
        description: "Vincula tu URL y API Key de n8n. Nosotros no lo alojamos; lo gestionamos."
      },
      {
        title: "Gobernar",
        description: "Define reglas: 'Estudiantes no pueden usar nodos de Consola' o 'Requerir Auth para Webhooks'."
      },
      {
        title: "Ejecutar",
        description: "Los usuarios corren flujos en NanoFlow. Interceptamos, validamos y enviamos a n8n de forma segura."
      }
    ]
  },
  features: {
    headline: "Funciones de Gobernanza",
    subheadline: "Las herramientas que le faltan a n8n Community Edition.",
    items: [
      { title: "Workflow Doctor", description: "Análisis estático para detectar secretos expuestos y bucles.", icon: "🩺" },
      { title: "Modo Aula", description: "Login multi-usuario y calificación automática para tareas.", icon: "🎓" },
      { title: "Firewall de Políticas", description: "Bloquea nodos o dominios específicos a nivel de gateway.", icon: "🛡️" },
      { title: "Logs de Auditoría", description: "Rastrea exactamente quién ejecutó qué y cuándo.", icon: "📜" },
      { title: "Snapshots Locales", description: "Historial local para deshacer errores instantáneamente.", icon: "⏪" },
      { title: "Gateway SSO", description: "Login con Google/Microsoft antes de acceder a n8n.", icon: "🔑" }
    ]
  },
  integrations: {
    title: "Funciona con tu Stack",
    subtitle: "Compatible con instancias n8n self-hosted y cloud.",
    items: ["n8n", "Docker", "Kubernetes", "Postgres", "Auth0", "Google Workspace", "GitHub", "GitLab"]
  },
  testimonials: {
    title: "Confiado por Educadores y CTOs",
    items: [
      { quote: "NanoFlow me permitió enseñar n8n a 50 alumnos sin que se borraran el trabajo entre ellos.", author: "Prof. Sarah Jenkins", role: "Instructor Habilidades Digitales" },
      { quote: "Finalmente puedo ver los logs de auditoría y saber qué dev rompió producción.", author: "Mike Chen", role: "CTO @ TechFlow" },
      { quote: "El Workflow Doctor encontró una API Key expuesta en un repo público. Me salvó la vida.", author: "Elena Rodriguez", role: "Automator Freelance" }
    ]
  },
  footer: {
    rights: "Todos los derechos reservados.",
    links: {
      product: "Producto",
      company: "Compañía",
      legal: "Legal"
    }
  },
  cta: {
    title: "Asegura tu Automatización",
    subtitle: "Únete a escuelas y empresas que añaden una capa de gobernanza a sus flujos.",
    button: "Iniciar Auditoría Gratis"
  },
  modal: {
    title: "Obtén Acceso de Gobernanza",
    subtitle: "Únete a la lista de espera para la nube de gobernanza gestionada.",
    placeholder: "trabajo@escuela.edu",
    button: "Solicitar Acceso",
    processing: "Procesando...",
    successTitle: "¡Estás en la lista!",
    successDesc: "Estaremos en contacto pronto.",
    successButton: "Cerrar"
  }
};

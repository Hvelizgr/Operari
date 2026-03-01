'use client';

import { content } from '@/app/[lang]/content/en';
import { Github, Twitter, Linkedin } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface FooterProps {
    content: typeof content.footer;
}

export default function Footer({ content }: FooterProps) {
    const params = useParams();
    const lang = params.lang || 'en';
    const isEs = lang === 'es';

    const text = {
        tagline: isEs ? "Automatización empresarial para equipos técnicos." : "Enterprise automation for technical teams.",
        productLinks: [
            { label: isEs ? "Precios" : "Pricing", href: `/${lang}/pricing` },
            { label: isEs ? "Características" : "Features", href: `/${lang}/automation` },
            { label: isEs ? "Seguridad" : "Security", href: `/${lang}/security` },
            { label: isEs ? "Comparación" : "Comparison", href: `/${lang}/compare` },
        ],
        companyLinks: [
            { label: isEs ? "Acerca de" : "About", href: "#" },
            { label: "Blog", href: "#" },
            { label: isEs ? "Empleos" : "Careers", href: "#" },
        ],
        legalLinks: [
            { label: isEs ? "Términos de Servicio" : "Terms of Service", href: `/${lang}/legal/terms` },
            { label: isEs ? "Política de Privacidad" : "Privacy Policy", href: "#" },
        ],
    };

    return (
        <footer className="pt-16 pb-8 bg-black/40 border-t border-border/40 backdrop-blur-xl">
            <div className="container px-4 md:px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2 mb-4 font-bold text-xl text-primary">
                            NanoFlow
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            {text.tagline}
                        </p>
                        <div className="flex gap-6 text-muted-foreground mt-6">
                            <Github className="w-6 h-6 hover:text-foreground cursor-pointer transition-colors" />
                            <Twitter className="w-6 h-6 hover:text-foreground cursor-pointer transition-colors" />
                            <Linkedin className="w-6 h-6 hover:text-foreground cursor-pointer transition-colors" />
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-foreground">{content.links.product}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            {text.productLinks.map((link, idx) => (
                                <li key={idx} className="hover:text-foreground cursor-pointer">
                                    <Link href={link.href}>{link.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-foreground">{content.links.company}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            {text.companyLinks.map((link, idx) => (
                                <li key={idx} className="hover:text-foreground cursor-pointer">
                                    <Link href={link.href}>{link.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-foreground">{content.links.legal}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            {text.legalLinks.map((link, idx) => (
                                <li key={idx} className="hover:text-foreground cursor-pointer">
                                    <Link href={link.href}>{link.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-border/10 text-center text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4">
                    <p>© 2026 NanoFlow. {content.rights}</p>
                    <div className="flex gap-6">
                        <Link href="/en" className="hover:text-primary transition-colors">English</Link>
                        <Link href="/es" className="hover:text-primary transition-colors">Español</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

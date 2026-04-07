'use client';

import { content } from '@/app/[lang]/content/en';
import { Github, Twitter, Linkedin } from 'lucide-react';
import Link from 'next/link';

interface FooterProps {
    content: typeof content.footer;
}

export default function Footer({ content }: FooterProps) {
    return (
        <footer className="pt-16 pb-8 bg-black/40 border-t border-border/40 backdrop-blur-xl">
            <div className="container px-4 md:px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2 mb-4 font-bold text-xl text-primary">
                            NanoRun
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            Enterprise automation for technical teams.
                        </p>
                        <div className="flex gap-4 text-muted-foreground">
                            <Github className="w-5 h-5 hover:text-foreground cursor-pointer transition-colors" />
                            <Twitter className="w-5 h-5 hover:text-foreground cursor-pointer transition-colors" />
                            <Linkedin className="w-5 h-5 hover:text-foreground cursor-pointer transition-colors" />
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-foreground">{content.links.product}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="hover:text-foreground cursor-pointer">Features</li>
                            <li className="hover:text-foreground cursor-pointer">Integrations</li>
                            <li className="hover:text-foreground cursor-pointer">Security</li>
                            <li className="hover:text-foreground cursor-pointer">Changelog</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-foreground">{content.links.company}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="hover:text-foreground cursor-pointer">About</li>
                            <li className="hover:text-foreground cursor-pointer">Blog</li>
                            <li className="hover:text-foreground cursor-pointer">Careers</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-foreground">{content.links.legal}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="hover:text-foreground cursor-pointer">Privacy</li>
                            <li className="hover:text-foreground cursor-pointer">Terms</li>
                            <li className="hover:text-foreground cursor-pointer">Cookie Policy</li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-border/10 text-center text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4">
                    <p>© 2024 NanoRun. {content.rights}</p>
                    <div className="flex gap-6">
                        <Link href="/en" className="hover:text-primary transition-colors">English</Link>
                        <Link href="/es" className="hover:text-primary transition-colors">Español</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

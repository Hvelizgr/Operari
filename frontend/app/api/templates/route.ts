
import { NextResponse } from 'next/server';

const TEMPLATES = [
    {
        id: 'webhook-slack',
        category: 'webhooks',
        name: {
            en: 'Webhook to Slack Notification',
            es: 'Notificación de Webhook a Slack'
        },
        description: {
            en: 'Receive data via a webhook request and post a formatted message to a Slack channel.',
            es: 'Recibe datos mediante una petición webhook y publica un mensaje formateado en un canal de Slack.'
        },
        nodes: [
            {
                id: 'webhook-1',
                type: 'webhook',
                position: { x: 100, y: 100 },
                data: { path: '/notify', method: 'POST' },
                title: 'Receive Data'
            },
            {
                id: 'slack-1',
                type: 'slack',
                position: { x: 400, y: 100 },
                data: { channel: '#general', message: 'New data received!' },
                title: 'Send to Slack'
            }
        ],
        connections: [
            {
                id: 'c1',
                source: 'webhook-1',
                target: 'slack-1',
                sourceHandle: 'output',
                targetHandle: 'input'
            }
        ]
    },
    {
        id: 'cron-db-cleanup',
        category: 'automation',
        name: {
            en: 'Daily Database Cleanup',
            es: 'Limpieza Diaria de Base de Datos'
        },
        description: {
            en: 'Runs every night at midnight to delete old records from the database.',
            es: 'Se ejecuta cada noche a medianoche para eliminar registros antiguos de la base de datos.'
        },
        nodes: [
            {
                id: 'schedule-1',
                type: 'schedule',
                position: { x: 100, y: 100 },
                data: { cron: '0 0 * * *' },
                title: 'Every Midnight'
            },
            {
                id: 'postgres-1',
                type: 'postgres',
                position: { x: 400, y: 100 },
                data: { query: 'DELETE FROM logs WHERE created_at < NOW() - INTERVAL \'30 days\'' },
                title: 'Delete Old Logs'
            }
        ],
        connections: [
            {
                id: 'c2',
                source: 'schedule-1',
                target: 'postgres-1',
                sourceHandle: 'output',
                targetHandle: 'input'
            }
        ]
    },
    {
        id: 'form-email-confirm',
        category: 'email',
        name: {
            en: 'Form Submission Auto-Reply',
            es: 'Auto-respuesta de Formulario'
        },
        description: {
            en: 'Send an automatic "Thank You" email when a user submits a contact form.',
            es: 'Envía un correo automático de "Gracias" cuando un usuario envía un formulario de contacto.'
        },
        nodes: [
            {
                id: 'webhook-form',
                type: 'webhook',
                position: { x: 100, y: 100 },
                data: { path: '/contact-form', method: 'POST' },
                title: 'Form Submit'
            },
            {
                id: 'email-1',
                type: 'email',
                position: { x: 400, y: 100 },
                data: { subject: 'We received your message', body: 'Thanks for contacting us!' },
                title: 'Send Reply'
            }
        ],
        connections: [
            {
                id: 'c3',
                source: 'webhook-form',
                target: 'email-1',
                sourceHandle: 'output',
                targetHandle: 'input'
            }
        ]
    }
];

export async function GET() {
    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 500));
    return NextResponse.json(TEMPLATES);
}

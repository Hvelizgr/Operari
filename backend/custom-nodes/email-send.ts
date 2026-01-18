
export const id = 'email-send-node';
export const name = 'Send Email (SMTP)';
export const description = 'Send emails via SMTP';
export const version = '1.0.0';

export class EmailSendNode {
    meta = {
        name: 'Send Email',
        version: '1.0.0',
        description: 'Send emails via SMTP',
        author: 'NanoFlow',
        category: 'Communication',
        icon: 'mail'
    };

    async execute(input: any, context: any) {
        context.log('Executing Email Send Node...');
        
        const { to, subject, body, host, port, user, pass, from } = input;
        
        if (!to || !subject || !body) {
            throw new Error('Email destination, subject and body are required');
        }

        try {
            const nodemailer = require('nodemailer');
            
            // If credentials are provided, try real SMTP, otherwise mock
            if (host && user && pass) {
                context.log(`Attempting to send real email to ${to} via ${host}`);
                const transporter = nodemailer.createTransport({
                    host,
                    port: port || 587,
                    secure: port === 465,
                    auth: { user, pass }
                });

                const info = await transporter.sendMail({
                    from: from || user,
                    to,
                    subject,
                    text: body,
                    html: body.includes('<') ? body : undefined
                });

                context.log(`Email sent: ${info.messageId}`);
                return { success: true, messageId: info.messageId };
            } else {
                context.log(`MOCK: Sending email to ${to}...`);
                context.log(`Subject: ${subject}`);
                await new Promise(resolve => setTimeout(resolve, 300));
                return { 
                    success: true, 
                    mock: true, 
                    message: 'Email simulated (provide SMTP settings for real sending)' 
                };
            }
        } catch (error: any) {
            context.log(`Email error: ${error.message}`);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }
}

export const executor = new EmailSendNode();

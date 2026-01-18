import Stripe from 'stripe';
import { prisma } from '../server';
import { notificationService, NotificationChannel, NotificationPriority } from './notification.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
});

export interface PlanConfig {
    priceId: string;
    name: string;
    features: string[];
    limits: {
        maxWorkflows: number;
        maxExecutions: number;
        maxUsers: number;
    };
}

const PLANS: Record<string, PlanConfig> = {
    FREE: {
        priceId: 'price_free',
        name: 'Free',
        features: ['5 workflows', '1,000 executions/month', '1 user'],
        limits: { maxWorkflows: 5, maxExecutions: 1000, maxUsers: 1 }
    },
    PRO: {
        priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
        name: 'Pro',
        features: ['50 workflows', '50,000 executions/month', '10 users', 'Priority support'],
        limits: { maxWorkflows: 50, maxExecutions: 50000, maxUsers: 10 }
    },
    ENTERPRISE: {
        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
        name: 'Enterprise',
        features: ['Unlimited workflows', 'Unlimited executions', 'Unlimited users', 'SSO', '2FA', 'Dedicated support'],
        limits: { maxWorkflows: Infinity, maxExecutions: Infinity, maxUsers: Infinity }
    }
};

export class BillingService {
    private static instance: BillingService;

    private constructor() {}

    public static getInstance(): BillingService {
        if (!BillingService.instance) {
            BillingService.instance = new BillingService();
        }
        return BillingService.instance;
    }

    /**
     * Create or get Stripe customer for tenant
     */
    public async getOrCreateCustomer(tenantId: string): Promise<string> {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { users: { where: { role: 'ADMIN' }, take: 1 } }
        });

        if (!tenant) throw new Error('Tenant not found');

        // Check if tenant already has a Stripe customer ID
        const billingInfo = tenant.billingInfo as any;
        if (billingInfo?.stripeCustomerId) {
            return billingInfo.stripeCustomerId;
        }

        // Create new Stripe customer
        const adminEmail = tenant.users[0]?.email || 'unknown@nanoflow.io';
        const customer = await stripe.customers.create({
            email: adminEmail,
            name: tenant.name,
            metadata: {
                tenantId: tenant.id,
                tenantSlug: tenant.slug
            }
        });

        // Save customer ID
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                billingInfo: {
                    stripeCustomerId: customer.id,
                    plan: tenant.plan,
                    billingEmail: adminEmail
                }
            }
        });

        return customer.id;
    }

    /**
     * Create checkout session for plan upgrade
     */
    public async createCheckoutSession(tenantId: string, plan: 'PRO' | 'ENTERPRISE'): Promise<string> {
        const customerId = await this.getOrCreateCustomer(tenantId);
        const planConfig = PLANS[plan];

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: planConfig.priceId,
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
            metadata: {
                tenantId,
                plan
            }
        });

        return session.url || '';
    }

    /**
     * Create billing portal session
     */
    public async createPortalSession(tenantId: string): Promise<string> {
        const customerId = await this.getOrCreateCustomer(tenantId);

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.FRONTEND_URL}/settings/billing`
        });

        return session.url;
    }

    /**
     * Handle Stripe webhook events
     */
    public async handleWebhook(event: Stripe.Event): Promise<void> {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await this.handleCheckoutComplete(session);
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await this.handleSubscriptionUpdate(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await this.handleSubscriptionCanceled(subscription);
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await this.handlePaymentFailed(invoice);
                break;
            }
        }
    }

    private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
        const tenantId = session.metadata?.tenantId;
        const plan = session.metadata?.plan as 'PRO' | 'ENTERPRISE';

        if (!tenantId || !plan) return;

        await prisma.tenant.update({
            where: { id: tenantId },
            data: { plan }
        });

        console.log(`[Billing] Upgraded tenant ${tenantId} to ${plan}`);
    }

    private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
        const customerId = subscription.customer as string;
        
        const tenant = await prisma.tenant.findFirst({
            where: {
                billingInfo: {
                    path: ['stripeCustomerId'],
                    equals: customerId
                }
            }
        });

        if (tenant) {
            console.log(`[Billing] Subscription updated for tenant ${tenant.id}`);
        }
    }

    private async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
        const customerId = subscription.customer as string;
        
        const tenant = await prisma.tenant.findFirst({
            where: {
                billingInfo: {
                    path: ['stripeCustomerId'],
                    equals: customerId
                }
            }
        });

        if (tenant) {
            await prisma.tenant.update({
                where: { id: tenant.id },
                data: { plan: 'FREE' }
            });

            // Notify admin
            const admin = await prisma.user.findFirst({
                where: { tenantId: tenant.id, role: 'ADMIN' }
            });

            if (admin) {
                await notificationService.send({
                    tenantId: tenant.id,
                    userId: admin.id,
                    title: 'Subscription Canceled',
                    message: 'Your subscription has been canceled. Your account has been downgraded to the Free plan.',
                    priority: NotificationPriority.HIGH,
                    channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
                });
            }

            console.log(`[Billing] Downgraded tenant ${tenant.id} to FREE`);
        }
    }

    private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
        const customerId = invoice.customer as string;
        
        const tenant = await prisma.tenant.findFirst({
            where: {
                billingInfo: {
                    path: ['stripeCustomerId'],
                    equals: customerId
                }
            }
        });

        if (tenant) {
            const admin = await prisma.user.findFirst({
                where: { tenantId: tenant.id, role: 'ADMIN' }
            });

            if (admin) {
                await notificationService.send({
                    tenantId: tenant.id,
                    userId: admin.id,
                    title: 'Payment Failed',
                    message: 'Your payment has failed. Please update your payment method to avoid service interruption.',
                    priority: NotificationPriority.CRITICAL,
                    channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
                    actionUrl: `${process.env.FRONTEND_URL}/settings/billing`
                });
            }

            console.log(`[Billing] Payment failed for tenant ${tenant.id}`);
        }
    }

    /**
     * Get current subscription info
     */
    public async getSubscriptionInfo(tenantId: string): Promise<any> {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant) throw new Error('Tenant not found');

        const billingInfo = tenant.billingInfo as any;
        const planConfig = PLANS[tenant.plan];

        return {
            plan: tenant.plan,
            planName: planConfig.name,
            features: planConfig.features,
            limits: planConfig.limits,
            stripeCustomerId: billingInfo?.stripeCustomerId || null,
            billingEmail: billingInfo?.billingEmail || null
        };
    }
}

export const billingService = BillingService.getInstance();

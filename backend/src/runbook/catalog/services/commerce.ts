import type { CatalogNode } from '../define';
import { crud, f, r, service } from '../service';

const limit = f('limit', 'Limit', { type: 'number', in: 'query' });

export const COMMERCE_NODES: CatalogNode[] = [
  service({
    type: 'stripe',
    category: 'commerce',
    icon: 'CreditCard',
    color: 'bg-indigo-600',
    label: ['Stripe', 'Stripe'],
    description: [
      'Customers, payments, invoices, refunds, products and subscriptions',
      'Clientes, pagos, facturas, reembolsos, productos y suscripciones',
    ],
    auth: { kind: 'bearer', provider: 'stripe', label: 'Secret key (sk_…)' },
    base: 'https://api.stripe.com/v1',
    bodyType: 'form',
    paginate: {
      ops: ['charge.list', 'invoice.list', 'product.list', 'subscription.list'],
      strategy: {
        kind: 'lastId',
        items: 'data',
        hasMore: 'has_more',
        param: 'starting_after',
        pageSize: { param: 'limit', value: 100 },
      },
    },
    operations: [
      ...crud(
        'customer',
        { one: ['customer', 'cliente'], many: ['customers', 'clientes'] },
        '/customers',
        r('customerId', 'Customer id'),
        [
          f('email', 'Email'),
          f('name', 'Name'),
          f('phone', 'Phone'),
          f('description', 'Description'),
        ],
        { updateMethod: 'POST', listQuery: [limit, f('email', 'Email', { in: 'query' })] }
      ),
      {
        value: 'customer.search',
        label: ['Search customers', 'Buscar clientes'],
        method: 'GET',
        path: '/customers/search',
        fields: [
          r('query', 'Query', { description: "Stripe search syntax, e.g. email:'a@b.com'" }),
        ],
      },
      {
        value: 'paymentIntent.create',
        label: ['Create payment intent', 'Crear intento de pago'],
        method: 'POST',
        path: '/payment_intents',
        fields: [
          r('amount', 'Amount (smallest unit)', { type: 'number' }),
          r('currency', 'Currency', { default: 'usd' }),
          f('customer', 'Customer id'),
          f('description', 'Description'),
        ],
      },
      {
        value: 'paymentIntent.get',
        label: ['Get payment intent', 'Obtener intento de pago'],
        method: 'GET',
        path: '/payment_intents/{paymentIntentId}',
        fields: [r('paymentIntentId', 'Payment intent id')],
        extra: false,
      },
      {
        value: 'charge.list',
        label: ['List charges', 'Listar cobros'],
        method: 'GET',
        path: '/charges',
        fields: [limit, f('customer', 'Customer id')],
      },
      {
        value: 'refund.create',
        label: ['Refund a payment', 'Reembolsar un pago'],
        method: 'POST',
        path: '/refunds',
        fields: [
          f('payment_intent', 'Payment intent id'),
          f('charge', 'Charge id'),
          f('amount', 'Amount (empty = full)', { type: 'number' }),
          f('reason', 'Reason', {
            type: 'options',
            options: [
              { name: 'Requested by customer', value: 'requested_by_customer' },
              { name: 'Duplicate', value: 'duplicate' },
              { name: 'Fraudulent', value: 'fraudulent' },
            ],
          }),
        ],
      },
      {
        value: 'invoice.create',
        label: ['Create invoice', 'Crear factura'],
        method: 'POST',
        path: '/invoices',
        fields: [r('customer', 'Customer id'), f('description', 'Description')],
      },
      {
        value: 'invoice.list',
        label: ['List invoices', 'Listar facturas'],
        method: 'GET',
        path: '/invoices',
        fields: [limit, f('customer', 'Customer id'), f('status', 'Status')],
      },
      {
        value: 'invoice.finalize',
        label: ['Finalize invoice', 'Finalizar factura'],
        method: 'POST',
        path: '/invoices/{invoiceId}/finalize',
        fields: [r('invoiceId', 'Invoice id')],
      },
      {
        value: 'invoice.send',
        label: ['Send invoice', 'Enviar factura'],
        method: 'POST',
        path: '/invoices/{invoiceId}/send',
        fields: [r('invoiceId', 'Invoice id')],
      },
      {
        value: 'product.create',
        label: ['Create product', 'Crear producto'],
        method: 'POST',
        path: '/products',
        fields: [r('name', 'Name'), f('description', 'Description')],
      },
      {
        value: 'product.list',
        label: ['List products', 'Listar productos'],
        method: 'GET',
        path: '/products',
        fields: [limit],
      },
      {
        value: 'price.create',
        label: ['Create price', 'Crear precio'],
        method: 'POST',
        path: '/prices',
        fields: [
          r('product', 'Product id'),
          r('unit_amount', 'Unit amount (smallest unit)', { type: 'number' }),
          r('currency', 'Currency', { default: 'usd' }),
          f('interval', 'Recurring interval', {
            key: 'recurring.interval',
            description: 'day, week, month or year; empty for one-time',
          }),
        ],
      },
      {
        value: 'subscription.list',
        label: ['List subscriptions', 'Listar suscripciones'],
        method: 'GET',
        path: '/subscriptions',
        fields: [limit, f('customer', 'Customer id'), f('status', 'Status')],
      },
      {
        value: 'subscription.cancel',
        label: ['Cancel subscription', 'Cancelar suscripción'],
        method: 'DELETE',
        path: '/subscriptions/{subscriptionId}',
        fields: [r('subscriptionId', 'Subscription id')],
        extra: false,
      },
      {
        value: 'balance.get',
        label: ['Get balance', 'Obtener saldo'],
        method: 'GET',
        path: '/balance',
        extra: false,
      },
    ],
  }),

  service({
    type: 'shopify',
    category: 'commerce',
    icon: 'ShoppingBag',
    color: 'bg-green-600',
    label: ['Shopify', 'Shopify'],
    description: [
      'Products, orders and customers of a store',
      'Productos, pedidos y clientes de una tienda',
    ],
    auth: {
      kind: 'header',
      provider: 'shopify',
      header: 'X-Shopify-Access-Token',
      label: 'Admin API access token',
    },
    base: {
      field: r('shop', 'Shop', { description: 'mystore (for mystore.myshopify.com)' }),
      build: v => `https://${v.replace(/\.myshopify\.com.*$/, '')}.myshopify.com/admin/api/2024-07`,
    },
    operations: [
      ...crud(
        'product',
        { one: ['product', 'producto'], many: ['products', 'productos'] },
        '/products.json',
        r('productId', 'Product id'),
        [
          f('title', 'Title', { key: 'product.title' }),
          f('body_html', 'Description (HTML)', { key: 'product.body_html' }),
          f('vendor', 'Vendor', { key: 'product.vendor' }),
          f('status', 'Status', { key: 'product.status' }),
        ],
        { updateMethod: 'PUT', idPath: '/products/{productId}.json', listQuery: [limit] }
      ),
      ...crud(
        'order',
        { one: ['order', 'pedido'], many: ['orders', 'pedidos'] },
        '/orders.json',
        r('orderId', 'Order id'),
        [f('note', 'Note', { key: 'order.note' }), f('tags', 'Tags', { key: 'order.tags' })],
        {
          updateMethod: 'PUT',
          idPath: '/orders/{orderId}.json',
          listQuery: [limit, f('status', 'Status', { in: 'query', default: 'any' })],
          skip: ['create'],
        }
      ),
      ...crud(
        'customer',
        { one: ['customer', 'cliente'], many: ['customers', 'clientes'] },
        '/customers.json',
        r('customerId', 'Customer id'),
        [
          f('email', 'Email', { key: 'customer.email' }),
          f('first_name', 'First name', { key: 'customer.first_name' }),
          f('last_name', 'Last name', { key: 'customer.last_name' }),
        ],
        { updateMethod: 'PUT', idPath: '/customers/{customerId}.json', listQuery: [limit] }
      ),
    ],
  }),

  service({
    type: 'woocommerce',
    category: 'commerce',
    icon: 'Store',
    color: 'bg-purple-700',
    label: ['WooCommerce', 'WooCommerce'],
    description: [
      'Products, orders and customers of a WordPress store',
      'Productos, pedidos y clientes de una tienda WordPress',
    ],
    auth: { kind: 'basicSecret', provider: 'woocommerce', label: 'consumer_key:consumer_secret' },
    base: {
      field: r('siteUrl', 'Store URL', { description: 'https://shop.example.com' }),
      build: v => `${v.replace(/\/+$/, '')}/wp-json/wc/v3`,
    },
    operations: [
      ...crud(
        'product',
        { one: ['product', 'producto'], many: ['products', 'productos'] },
        '/products',
        r('productId', 'Product id'),
        [
          f('name', 'Name'),
          f('regular_price', 'Regular price'),
          f('sku', 'SKU'),
          f('stock_quantity', 'Stock', { type: 'number' }),
        ],
        {
          updateMethod: 'PUT',
          listQuery: [f('per_page', 'Per page', { type: 'number', in: 'query' })],
        }
      ),
      ...crud(
        'order',
        { one: ['order', 'pedido'], many: ['orders', 'pedidos'] },
        '/orders',
        r('orderId', 'Order id'),
        [f('status', 'Status'), f('customer_note', 'Customer note')],
        { updateMethod: 'PUT', listQuery: [f('status', 'Status', { in: 'query' })] }
      ),
      ...crud(
        'customer',
        { one: ['customer', 'cliente'], many: ['customers', 'clientes'] },
        '/customers',
        r('customerId', 'Customer id'),
        [f('email', 'Email'), f('first_name', 'First name'), f('last_name', 'Last name')],
        { updateMethod: 'PUT' }
      ),
    ],
  }),

  service({
    type: 'square',
    category: 'commerce',
    icon: 'SquareStack',
    color: 'bg-neutral-800',
    label: ['Square', 'Square'],
    description: ['Customers, payments and orders', 'Clientes, pagos y pedidos'],
    auth: { kind: 'bearer', provider: 'square', label: 'Access token' },
    base: 'https://connect.squareup.com/v2',
    headers: { 'Square-Version': '2024-07-17' },
    operations: [
      ...crud(
        'customer',
        { one: ['customer', 'cliente'], many: ['customers', 'clientes'] },
        '/customers',
        r('customerId', 'Customer id'),
        [
          f('email_address', 'Email'),
          f('given_name', 'First name'),
          f('family_name', 'Last name'),
          f('phone_number', 'Phone'),
        ],
        { updateMethod: 'PUT' }
      ),
      {
        value: 'payment.list',
        label: ['List payments', 'Listar pagos'],
        method: 'GET',
        path: '/payments',
        fields: [f('begin_time', 'From (RFC 3339)'), limit],
      },
      {
        value: 'payment.get',
        label: ['Get payment', 'Obtener pago'],
        method: 'GET',
        path: '/payments/{paymentId}',
        fields: [r('paymentId', 'Payment id')],
        extra: false,
      },
      {
        value: 'refund.create',
        label: ['Refund payment', 'Reembolsar pago'],
        method: 'POST',
        path: '/refunds',
        fields: [
          r('payment_id', 'Payment id'),
          r('amount', 'Amount (cents)', { type: 'number', key: 'amount_money.amount' }),
          r('currency', 'Currency', { key: 'amount_money.currency', default: 'USD' }),
          r('idempotency_key', 'Idempotency key', {
            description: 'Unique per refund, e.g. a UUID',
          }),
        ],
      },
      {
        value: 'location.list',
        label: ['List locations', 'Listar sucursales'],
        method: 'GET',
        path: '/locations',
        extra: false,
      },
    ],
  }),

  service({
    type: 'paddle',
    category: 'commerce',
    icon: 'Receipt',
    color: 'bg-yellow-600',
    label: ['Paddle', 'Paddle'],
    description: [
      'Customers, products, subscriptions and transactions (Paddle Billing)',
      'Clientes, productos, suscripciones y transacciones (Paddle Billing)',
    ],
    auth: { kind: 'bearer', provider: 'paddle', label: 'API key' },
    base: 'https://api.paddle.com',
    operations: [
      ...crud(
        'customer',
        { one: ['customer', 'cliente'], many: ['customers', 'clientes'] },
        '/customers',
        r('customerId', 'Customer id'),
        [f('email', 'Email'), f('name', 'Name')],
        { skip: ['delete'] }
      ),
      ...crud(
        'product',
        { one: ['product', 'producto'], many: ['products', 'productos'] },
        '/products',
        r('productId', 'Product id'),
        [f('name', 'Name'), f('tax_category', 'Tax category', { default: 'standard' })],
        { skip: ['delete'] }
      ),
      {
        value: 'subscription.list',
        label: ['List subscriptions', 'Listar suscripciones'],
        method: 'GET',
        path: '/subscriptions',
        fields: [f('status', 'Status')],
      },
      {
        value: 'subscription.cancel',
        label: ['Cancel subscription', 'Cancelar suscripción'],
        method: 'POST',
        path: '/subscriptions/{subscriptionId}/cancel',
        fields: [
          r('subscriptionId', 'Subscription id'),
          f('effective_from', 'Effective from', { default: 'next_billing_period' }),
        ],
      },
      {
        value: 'transaction.list',
        label: ['List transactions', 'Listar transacciones'],
        method: 'GET',
        path: '/transactions',
        fields: [f('status', 'Status')],
      },
    ],
  }),

  service({
    type: 'lemonsqueezy',
    category: 'commerce',
    icon: 'Citrus',
    color: 'bg-yellow-500',
    label: ['Lemon Squeezy', 'Lemon Squeezy'],
    description: ['Orders, customers and subscriptions', 'Pedidos, clientes y suscripciones'],
    auth: { kind: 'bearer', provider: 'lemonsqueezy', label: 'API key' },
    base: 'https://api.lemonsqueezy.com/v1',
    headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
    operations: [
      {
        value: 'order.list',
        label: ['List orders', 'Listar pedidos'],
        method: 'GET',
        path: '/orders',
        fields: [f('storeId', 'Store id', { key: 'filter[store_id]' })],
      },
      {
        value: 'order.get',
        label: ['Get order', 'Obtener pedido'],
        method: 'GET',
        path: '/orders/{orderId}',
        fields: [r('orderId', 'Order id')],
        extra: false,
      },
      {
        value: 'customer.list',
        label: ['List customers', 'Listar clientes'],
        method: 'GET',
        path: '/customers',
        fields: [f('email', 'Email', { key: 'filter[email]' })],
      },
      {
        value: 'subscription.list',
        label: ['List subscriptions', 'Listar suscripciones'],
        method: 'GET',
        path: '/subscriptions',
        fields: [f('status', 'Status', { key: 'filter[status]' })],
      },
      {
        value: 'subscription.cancel',
        label: ['Cancel subscription', 'Cancelar suscripción'],
        method: 'DELETE',
        path: '/subscriptions/{subscriptionId}',
        fields: [r('subscriptionId', 'Subscription id')],
        extra: false,
      },
    ],
  }),

  service({
    type: 'gumroad',
    category: 'commerce',
    icon: 'Package',
    color: 'bg-pink-500',
    label: ['Gumroad', 'Gumroad'],
    description: ['Products and sales', 'Productos y ventas'],
    auth: { kind: 'query', provider: 'gumroad', param: 'access_token', label: 'Access token' },
    base: 'https://api.gumroad.com/v2',
    operations: [
      {
        value: 'product.list',
        label: ['List products', 'Listar productos'],
        method: 'GET',
        path: '/products',
        extra: false,
      },
      {
        value: 'product.get',
        label: ['Get product', 'Obtener producto'],
        method: 'GET',
        path: '/products/{productId}',
        fields: [r('productId', 'Product id')],
        extra: false,
      },
      {
        value: 'sale.list',
        label: ['List sales', 'Listar ventas'],
        method: 'GET',
        path: '/sales',
        fields: [f('after', 'After (YYYY-MM-DD)'), f('email', 'Buyer email')],
      },
    ],
    bodyError: b =>
      (b as { success?: boolean })?.success === false
        ? String((b as { message?: string }).message ?? 'Gumroad error')
        : null,
  }),

  service({
    type: 'chargebee',
    category: 'commerce',
    icon: 'Repeat',
    color: 'bg-orange-600',
    label: ['Chargebee', 'Chargebee'],
    description: ['Customers, subscriptions and invoices', 'Clientes, suscripciones y facturas'],
    auth: { kind: 'basicSecret', provider: 'chargebee', password: '', label: 'API key' },
    base: {
      field: r('site', 'Site', { description: 'acme for acme.chargebee.com' }),
      build: v => `https://${v}.chargebee.com/api/v2`,
    },
    bodyType: 'form',
    operations: [
      {
        value: 'customer.list',
        label: ['List customers', 'Listar clientes'],
        method: 'GET',
        path: '/customers',
        fields: [limit],
      },
      {
        value: 'customer.create',
        label: ['Create customer', 'Crear cliente'],
        method: 'POST',
        path: '/customers',
        fields: [f('email', 'Email'), f('first_name', 'First name'), f('last_name', 'Last name')],
      },
      {
        value: 'subscription.list',
        label: ['List subscriptions', 'Listar suscripciones'],
        method: 'GET',
        path: '/subscriptions',
        fields: [limit],
      },
      {
        value: 'subscription.cancel',
        label: ['Cancel subscription', 'Cancelar suscripción'],
        method: 'POST',
        path: '/subscriptions/{subscriptionId}/cancel_for_items',
        fields: [
          r('subscriptionId', 'Subscription id'),
          f('end_of_term', 'At end of term', { type: 'boolean' }),
        ],
      },
      {
        value: 'invoice.list',
        label: ['List invoices', 'Listar facturas'],
        method: 'GET',
        path: '/invoices',
        fields: [limit],
      },
    ],
  }),
];

# Operari on Railway

Two services + Postgres + Redis add-ons. Each service is a separate
Railway "service" wired to this repo's two Dockerfiles.

## Step-by-step

1. **Create project + add data stores:**
   - `railway init` → create `operari` project.
   - `railway add` → select Postgres. Railway provisions `DATABASE_URL`.
   - `railway add` → select Redis. Railway provisions `REDIS_URL`.

2. **Create the backend service:**
   - `railway up --dockerfile backend/Dockerfile --service operari-backend`
   - In Railway's UI, set the following variables (these are required):

     ```
     NODE_ENV=production
     PORT=4000
     OPERARI_ANONYMOUS_MODE=false
     COOKIE_SECURE=true
     OPERARI_RUNNER=local         # or "docker" once runner isolation lands
     OPERARI_DURABLE_ENGINE=true
     OPERARI_BILLING_PROVIDER=stripe
     JWT_SECRET=<48 hex bytes, generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
     ENCRYPTION_KEY=<32 hex bytes, node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
     ```

   - Plus the optional-but-likely block from the main `DEPLOYMENT.md`
     (Stripe, Resend, OAuth).

3. **Create the frontend service:**
   - `railway up --dockerfile frontend/Dockerfile --service operari-frontend`
   - Variables:

     ```
     NODE_ENV=production
     API_URL=http://${{operari-backend.RAILWAY_PRIVATE_DOMAIN}}:4000
     NEXT_PUBLIC_API_URL=https://${{operari-backend.RAILWAY_PUBLIC_DOMAIN}}
     NEXT_PUBLIC_SITE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
     NEXT_PUBLIC_OPERARI_ANONYMOUS_MODE=false
     ```

   Railway's `${{service.VAR}}` syntax resolves cross-service — keeps
   both apps pointing at each other without a hardcoded domain.

4. **Attach a custom domain** (optional): Railway → service → Settings →
   Domains → add `app.yourdomain.dev` + CNAME per the prompt.

5. **Configure Stripe webhook**: in the Stripe dashboard add
   `https://<your-backend-domain>/api/billing/webhook` as an endpoint
   and subscribe to `customer.subscription.*` + `checkout.session.completed`.
   Paste the `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

6. **Run migrations once** from a local shell:

   ```bash
   railway run --service operari-backend npx prisma db push
   railway run --service operari-backend node prisma/seed-nodes.js
   ```

## Known limitations on Railway

- Railway free tier idles services after inactivity — the first
  request after a cold start takes a few seconds. Fine for demos,
  not fine for a production webhook ingest.
- No built-in object storage. If/when the runbook engine grows a
  large-artifact store, move to a provider with S3-compatible storage.

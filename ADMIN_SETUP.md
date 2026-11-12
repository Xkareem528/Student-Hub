# EDU SOLVER Admin setup

The admin dashboard uses Cloudflare D1 for order records. Receipt images continue to be delivered to the existing Telegram chat; no R2 bucket is required.

## 1. Run the D1 migration

In Cloudflare Dashboard:
1. Open **Workers & Pages → D1 SQL Database**.
2. Open the database you created for EDU SOLVER.
3. Open its SQL console.
4. Run the complete contents of `migrations/0001_create_orders.sql`.

The migration creates the `orders` table and indexes. It stores order details and receipt metadata, but not receipt images or student passwords.

## 2. Add the D1 binding

Open the Worker that serves `student-hub.kareemahmedhussein4.workers.dev`, then **Settings → Bindings**:
- D1 database binding: variable name `DB`, select the database you created.

No R2 binding or bucket is needed.

## 3. Add Worker secrets

Under **Settings → Variables and Secrets**, add:
- `ADMIN_PASSWORD`: a new, unique, long password used only for the admin dashboard.
- `ADMIN_SESSION_SECRET`: a separate random secret, at least 32 random characters.

Keep both values private. Do not put them in GitHub, HTML, JavaScript, Telegram, or share them in chat. Existing Telegram secrets remain configured as they are.

## 4. Deploy and test

After the branch is reviewed and merged/deployed:
- Open `https://edusolver.pages.dev/admin.html`.
- Sign in using `ADMIN_PASSWORD`.
- Confirm that a test order appears and that its receipt arrives in the existing Telegram chat.
- Change the order status and confirm a Telegram status notification arrives.

The dashboard API accepts requests only from `https://edusolver.pages.dev` and requires a short-lived signed admin token. The token stays in page memory and is cleared on logout or refresh.

## Important notes

- New order notifications continue to include the receipt image in Telegram.
- Receipt images are not stored in D1; Telegram remains the place to review them.
- Passwords entered by students are not stored in D1, displayed in the dashboard, or included in Telegram messages.
- D1 contains student contact/code details and payment metadata. Keep dashboard access restricted to the authorized administrator.
- Do not merge/deploy this branch until the D1 binding and secrets are configured.

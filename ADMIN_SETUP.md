# EDU SOLVER Admin setup

This branch adds a protected admin dashboard backed by Cloudflare D1 and R2. It is intentionally isolated from the production branch until the Cloudflare bindings are configured and tested.

## 1. Create the D1 database

In Cloudflare Dashboard:
1. Open **Workers & Pages → D1 SQL Database**.
2. Create a database named `edu-solver-db`.
3. Open its SQL console and run the complete contents of `migrations/0001_create_orders.sql`.

The migration creates the `orders` table and indexes. It stores order details and receipt metadata, but does not store student passwords.

## 2. Create the R2 bucket

1. Open **R2 Object Storage**.
2. Create a private bucket named `edu-solver-receipts`.
3. Do not enable public access.

## 3. Add bindings to the Worker

Open the Worker that serves `student-hub.kareemahmedhussein4.workers.dev`, then **Settings → Bindings**:
- D1 database binding: variable name `DB`, select `edu-solver-db`.
- R2 bucket binding: variable name `RECEIPTS`, select `edu-solver-receipts`.

## 4. Add Worker secrets

Under **Settings → Variables and Secrets**, add:
- `ADMIN_PASSWORD`: a new, unique, long password used only for the admin dashboard.
- `ADMIN_SESSION_SECRET`: a separate random secret, at least 32 random characters.

Keep both values private. Do not put them in GitHub, HTML, JavaScript, Telegram, or share them in chat. Existing Telegram secrets remain configured as they are.

## 5. Deploy and test

After the branch is reviewed and merged/deployed:
- Open `https://edusolver.pages.dev/admin.html`.
- Sign in using `ADMIN_PASSWORD`.
- Confirm that a test order appears, its receipt opens, and changing its status produces a Telegram status notification.
- Confirm a new test order still sends the usual Telegram receipt notification.

The dashboard API accepts requests only from `https://edusolver.pages.dev` and requires a short-lived signed admin token. The admin token stays in page memory and is cleared on logout or refresh.

## Important operational notes

- The existing Telegram notification for new orders remains enabled.
- Telegram order notifications intentionally omit student passwords. Passwords are not saved in D1, shown in the dashboard, or placed in Telegram messages.
- Order records contain student contact/code details and payment receipt metadata. Keep the D1 database and R2 bucket private and limit dashboard access to the authorized administrator.
- Do not merge/deploy this branch until D1 and R2 are configured. Without these bindings, the updated order endpoint intentionally refuses new submissions rather than silently losing orders.

# EDU SOLVER Admin setup

The admin dashboard is being tested on a separate Worker named `edu-solver`. The live `student-hub` Worker and the public Pages site are not changed by this setup. D1 stores order records; receipt images continue to be sent to Telegram, so no R2 bucket is required.

## 1. D1 database

The Wrangler configuration binds the existing database `edu-solver-db` as `DB`. The migration in `migrations/0001_create_orders.sql` must be applied to that database once. It creates the `orders` table and indexes; it does not store student passwords or receipt image files.

## 2. Deploy the isolated test Worker

Deploy this branch using the repository's Cloudflare Workers deployment process. The Worker name in `wrangler.jsonc` is `edu-solver`, so its test URL is:

`https://edu-solver.kareemahmedhussein4.workers.dev`

The admin page for this isolated test is:

`https://edu-solver.kareemahmedhussein4.workers.dev/admin.html`

Do not change the production `student-hub` Worker or merge this branch to `main` as part of the test.

## 3. Configure secrets on the test Worker

Worker secrets are separate for each Worker. In the **edu-solver** test Worker, open **Settings → Variables and Secrets** and add:

- `ADMIN_PASSWORD`: a strong password used only for admin access.
- `ADMIN_SESSION_SECRET`: a separate random secret of at least 32 random characters.
- `TELEGRAM_BOT_TOKEN`: copy the existing bot token from the production Worker settings.
- `TELEGRAM_CHAT_ID`: copy the existing chat ID from the production Worker settings.

Enter the values directly in Cloudflare. Do not put them in GitHub or send them in chat. The existing production Worker's secrets are not automatically shared with this test Worker. Keep the current Telegram configuration on the production Worker unchanged.

## 4. Test

- Open the test admin URL above and sign in.
- Check that the dashboard can load D1 orders.
- Submit a clearly marked test order only when ready; it will be written to the D1 database and its receipt will be sent to the configured Telegram chat.
- Change a test order's status and confirm that the Telegram status notification arrives.

The test Worker uses the same D1 database specified above. Test records will therefore be in that database; distinguish them from real orders. The live `student-hub` Worker is not changed.

## Important notes

- Receipt images are not stored in D1; Telegram remains the place to review them.
- Student passwords are accepted by the submit endpoint but are not stored in D1, displayed in the dashboard, or included in Telegram messages.
- D1 contains student contact/code details and payment metadata. Restrict admin access and avoid using real student information for test orders.
- No R2 bucket is required.

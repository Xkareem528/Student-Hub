# EDU SOLVER

واجهة تعليمية تجريبية باللغة العربية، مستضافة باستخدام Cloudflare Workers وStatic Assets.

## الوظائف

- عرض واجهة الموقع من مجلد `public/`.
- استقبال طلبات النموذج عبر `POST /api/submit`.
- التحقق من الاختيارات والموافقة والحقول.
- إرسال إشعار إلى Telegram باستخدام أسرار Cloudflare.
- نقطة فحص `GET /health`.

> هذا المشروع نموذج تجريبي لإرسال طلب، وليس نظامًا يحل الأسئلة فعليًا.

## النشر على Cloudflare

1. افتح Cloudflare Dashboard ثم Workers & Pages.
2. أنشئ Worker جديدًا واختر Import a repository لربط مستودع GitHub.
3. اختر مستودع `Xkareem528/Student-Hub` والفرع `main`.
4. اجعل أمر التثبيت `npm install` وأمر النشر `npx wrangler deploy`.
5. تأكد أن ملف `wrangler.jsonc` في جذر المستودع هو إعداد النشر.
6. بعد إنشاء الخدمة، افتح Settings ثم Variables and Secrets.
7. أضف القيمتين كـ **Secrets**:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
8. أعد النشر، ثم اختبر `/health` والنموذج ببيانات وهمية.

## الخصوصية والأمان

- لا تضع Telegram Bot Token أو أي سر في GitHub أو ملفات الواجهة.
- التوكن الذي كُشف سابقًا يجب إلغاؤه من BotFather واستخدام توكن جديد.
- لا تستخدم كلمات مرور أو أكواد دخول أو بيانات سرية في حقل «الكلمة المميزة».
- لا تجمع بيانات حقيقية لطلاب آخرين إلا بموافقتهم وبما تسمح به قواعد المدرسة وولي الأمر.
- استخدم بيانات اختبار وهمية أثناء التجربة.

## التطوير محليًا

يتطلب Node.js حديثًا:

```bash
npm install
npm run dev
```

للنشر من سطر الأوامر بعد تسجيل الدخول إلى Wrangler:

```bash
npx wrangler login
npm run deploy
```

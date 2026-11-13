const recentRequests = new Map();
const loginAttempts = new Map();
const trackAttempts = new Map();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });

function isRateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const previous = recentRequests.get(ip) || 0;
  if (now - previous < 5000) return true;
  recentRequests.set(ip, now);
  if (recentRequests.size > 1000) {
    for (const [key, time] of recentRequests) {
      if (now - time > 60000) recentRequests.delete(key);
    }
  }
  return false;
}

function loginRateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, start: now };
  if (now - record.start > 60000) {
    loginAttempts.set(ip, { count: 1, start: now });
    return false;
  }
  record.count += 1;
  loginAttempts.set(ip, record);
  return record.count > 5;
}

function trackRateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const record = trackAttempts.get(ip) || { count: 0, start: now };
  if (now - record.start > 60000) {
    trackAttempts.set(ip, { count: 1, start: now });
    return false;
  }
  record.count += 1;
  trackAttempts.set(ip, record);
  if (trackAttempts.size > 1000) {
    for (const [key, value] of trackAttempts) {
      if (now - value.start > 60000) trackAttempts.delete(key);
    }
  }
  return record.count > 20;
}

async function telegramPhoto(env, photo, caption) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("Telegram is not configured");
  }
  const form = new FormData();
  form.append("chat_id", env.TELEGRAM_CHAT_ID);
  form.append("photo", photo, photo.name || "receipt.jpg");
  form.append("caption", caption.slice(0, 1024));
  const response = await fetch(
    "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendPhoto",
    { method: "POST", body: form }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error("Telegram receipt upload failed");
}

async function telegramMessage(env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("Telegram is not configured");
  }
  const response = await fetch(
    "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message.slice(0, 4000)
      })
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error("Telegram message failed");
}

const ALLOWED_ORIGIN = "https://edusolver.pages.dev";

function withCors(response, request) {
  const headers = new Headers(response.headers);
  headers.set("Vary", "Origin");
  if (request.headers.get("Origin") === ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createAdminToken(env) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    role: "admin"
  })));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(env.ADMIN_SESSION_SECRET),
    new TextEncoder().encode(payload)
  );
  return payload + "." + base64url(new Uint8Array(signature));
}

async function isAdmin(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 2 || !env.ADMIN_SESSION_SECRET) return false;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(env.ADMIN_SESSION_SECRET),
      fromBase64url(parts[1]),
      new TextEncoder().encode(parts[0])
    );
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0])));
    return payload.role === "admin" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function safeEqual(a, b) {
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

function requireStorage(env) {
  return Boolean(env.DB);
}

const STATUS_LABELS = {
  pending: "في انتظار مراجعة الدفع",
  approved: "تم قبول الدفع",
  rejected: "تم رفض الدفع",
  processing: "جاري التنفيذ",
  completed: "مكتمل"
};

async function handleAdmin(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/admin/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
      return json({ ok: false, message: "إعدادات دخول الإدارة غير مكتملة." }, 503);
    }
    if (loginRateLimited(request)) {
      return json({ ok: false, message: "محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا." }, 429);
    }
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, message: "بيانات غير صالحة." }, 400); }
    const password = typeof body.password === "string" ? body.password : "";
    if (!await safeEqual(password, env.ADMIN_PASSWORD)) {
      return json({ ok: false, message: "كلمة مرور الإدارة غير صحيحة." }, 401);
    }
    return json({ ok: true, token: await createAdminToken(env) });
  }

  if (!await isAdmin(request, env)) {
    return json({ ok: false, message: "يلزم تسجيل دخول الإدارة." }, 401);
  }
  if (!requireStorage(env)) {
    return json({ ok: false, message: "قاعدة بيانات D1 غير مربوطة بالـ Worker بعد." }, 503);
  }

  if (path === "/api/admin/settings" && request.method === "GET") {
    return json({ ok: true, settings: await readSiteSettings(env) }, 200, { "cache-control": "no-store" });
  }
  if (path === "/api/admin/settings" && request.method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, message: "بيانات الإعدادات غير صالحة." }, 400); }
    const settings = validateSiteSettings(body.settings);
    if (!settings) return json({ ok: false, message: "راجع القيم المدخلة؛ بعض الحقول غير صحيحة." }, 400);
    await saveSiteSettings(env, settings);
    return json({ ok: true, settings }, 200, { "cache-control": "no-store" });
  }

  if (path === "/api/admin/orders" && request.method === "GET") {
    const status = url.searchParams.get("status") || "";
    const query = (url.searchParams.get("q") || "").trim().slice(0, 80);
    let sql = "SELECT id, created_at, updated_at, type, grade, subject, bundle, amount, phone, student_code, payment_method, sender_phone, status, telegram_status FROM orders";
    const clauses = [];
    const values = [];
    if (status && STATUS_LABELS[status]) {
      clauses.push("status = ?");
      values.push(status);
    }
    if (query) {
      clauses.push("(id LIKE ? OR phone LIKE ? OR student_code LIKE ? OR subject LIKE ?)");
      const pattern = "%" + query + "%";
      values.push(pattern, pattern, pattern, pattern);
    }
    if (clauses.length) sql += " WHERE " + clauses.join(" AND ");
    sql += " ORDER BY created_at DESC LIMIT 200";
    const orders = await env.DB.prepare(sql).bind(...values).all();
    const stats = await env.DB.prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed, COALESCE(SUM(CASE WHEN status IN ('approved','processing','completed') THEN amount ELSE 0 END), 0) AS revenue FROM orders"
    ).first();
    return json({ ok: true, orders: orders.results || [], stats: stats || {} });
  }

  const statusMatch = path.match(/^\/api\/admin\/orders\/([a-f0-9-]+)\/status$/i);
  if (statusMatch && request.method === "PATCH") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, message: "بيانات غير صالحة." }, 400); }
    const status = body.status;
    if (!Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)) {
      return json({ ok: false, message: "حالة الطلب غير صحيحة." }, 400);
    }
    const order = await env.DB.prepare("SELECT id, phone, student_code, subject, amount FROM orders WHERE id = ?").bind(statusMatch[1]).first();
    if (!order) return json({ ok: false, message: "الطلب غير موجود." }, 404);
    await env.DB.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(status, statusMatch[1]).run();

    let telegramNotified = false;
    try {
      await telegramMessage(env,
        "تحديث طلب EDU SOLVER\nرقم الطلب: " + order.id +
        "\nالمادة: " + order.subject +
        "\nرقم الطالب: " + order.phone +
        "\nالحالة الجديدة: " + STATUS_LABELS[status]
      );
      telegramNotified = true;
    } catch (error) {
      console.error("Telegram status notification error:", error.message);
    }
    return json({ ok: true, telegramNotified });
  }

  return json({ ok: false, message: "المسار غير موجود." }, 404);
}

function normalizeEgyptPhone(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  let phone = String(value).trim()
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[\s().-]/g, "");
  if (phone.startsWith("+20")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("0020")) phone = "0" + phone.slice(4);
  else if (phone.startsWith("20") && phone.length === 12) phone = "0" + phone.slice(2);
  return /^01\d{9}$/.test(phone) ? phone : "";
}

async function handleTrack(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, message: "طريقة الطلب غير مدعومة." }, 405);
  }
  if (trackRateLimited(request)) {
    return json({ ok: false, message: "محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا." }, 429);
  }
  if (!requireStorage(env)) {
    return json({ ok: false, message: "خدمة المتابعة غير متاحة حاليًا." }, 503);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, message: "أدخل رقم الطلب ورقم الهاتف." }, 400); }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const phone = normalizeEgyptPhone(body.phone);
  if (!/^[a-f0-9-]{36}$/i.test(orderId) || !phone) {
    return json({ ok: false, message: "تأكد من كتابة رقم الطلب ورقم الهاتف بشكل صحيح." }, 400);
  }

  const order = await env.DB.prepare(
    "SELECT id, phone, created_at, updated_at, subject, grade, amount, status FROM orders WHERE id = ? LIMIT 1"
  ).bind(orderId).first();

  if (order && normalizeEgyptPhone(order.phone) !== phone) {
    return json({ ok: false, message: "لم نعثر على طلب مطابق. راجع رقم الطلب ورقم الهاتف." }, 404);
  }

  if (!order) {
    return json({ ok: false, message: "لم نعثر على طلب مطابق. راجع رقم الطلب ورقم الهاتف." }, 404);
  }

  return json({
    ok: true,
    order: {
      id: order.id,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      subject: order.subject,
      grade: order.grade,
      amount: order.amount,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status] || "قيد المراجعة"
    }
  }, 200, { "cache-control": "no-store, private" });
}

async function handleSubmit(request, env) {
  if (request.method !== "POST") return json({ ok: false, message: "طريقة الطلب غير مدعومة." }, 405);
  if (isRateLimited(request)) return json({ ok: false, message: "انتظر قليلًا قبل المحاولة مرة أخرى." }, 429);
  if (!requireStorage(env)) {
    return json({ ok: false, message: "خدمة استقبال الطلبات تحت الإعداد. حاول لاحقًا." }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 6 * 1024 * 1024) {
    return json({ ok: false, message: "حجم الطلب كبير جدًا. الحد الأقصى 5 ميجابايت للصورة." }, 413);
  }

  let data;
  try { data = await request.formData(); }
  catch { return json({ ok: false, message: "بيانات الطلب غير صالحة." }, 400); }

  const siteSettings = await readSiteSettings(env);\n  if (siteSettings.maintenance.enabled) {\n    return json({ ok: false, message: siteSettings.maintenance.message }, 503);\n  }\n\n  const type = data.get("type");
  const grade = data.get("grade");
  const subject = data.get("subject");
  const phone = data.get("phone");
  const studentCode = data.get("studentCode");
  const passwordInput = data.get("password") || "";
  const consent = data.get("consent");
  const paymentMethod = data.get("paymentMethod");
  const senderPhone = data.get("senderPhone");
  const receipt = data.get("receipt");
  const bundle = data.get("bundle") === "true";

  const allowedTypes = ["حكومي", "لغات"];
  const allowedGrades = ["أولى بكالوريا", "تانية بكالوريا"];
  const allowedSubjects = {
    "حكومي|أولى بكالوريا": ["JavaScript (QUREO)"],
    "حكومي|تانية بكالوريا": ["Python", "JavaScript", "ثقافة مالية"],
    "لغات|أولى بكالوريا": ["JavaScript (QUREO)"],
    "لغات|تانية بكالوريا": ["Python", "JavaScript", "Financial Literacy"]
  };

  if (!allowedTypes.includes(type) || !allowedGrades.includes(grade) ||
      !allowedSubjects[type + "|" + grade]?.includes(subject) ||
      (bundle && grade !== "تانية بكالوريا")) {
    return json({ ok: false, message: "اختيارات الطلب غير صحيحة." }, 400);
  }
  if (consent !== "true") return json({ ok: false, message: "يجب تأكيد صحة البيانات أولًا." }, 400);
  
  if (!phone || !studentCode || typeof phone !== "string" || typeof studentCode !== "string" || !phone.trim() || !studentCode.trim()) {
    return json({ ok: false, message: "تأكد من إدخال رقم الهاتف وكود الطالب." }, 400);
  }

  if (!["InstaPay", "Vodafone Cash", "Telda"].includes(paymentMethod)) {
    return json({ ok: false, message: "اختار وسيلة دفع صحيحة." }, 400);
  }
  if (typeof senderPhone !== "string" || !/^\d{11}$/.test(senderPhone)) {
    return json({ ok: false, message: "رقم الهاتف المُحوِّل يجب أن يتكون من 11 رقمًا." }, 400);
  }
  if (!(receipt instanceof File) ||
      !["image/jpeg", "image/png", "image/webp"].includes(receipt.type) ||
      receipt.size < 1 || receipt.size > 5 * 1024 * 1024) {
    return json({ ok: false, message: "ارفع صورة إيصال صحيحة لا تتجاوز 5 ميجابايت." }, 400);
  }

  const amount = bundle ? siteSettings.prices.bundle : siteSettings.prices[subject];
  const orderDescription = bundle
    ? "باقة المواد الثلاثة: Python + JavaScript + " + (type === "لغات" ? "Financial Literacy" : "ثقافة مالية")
    : subject;

  const id = crypto.randomUUID();
  const caption = [
    "طلب جديد من EDU SOLVER — إثبات دفع",
    "رقم الطلب: " + id,
    "النوع: " + type,
    "الصف: " + grade,
    "الطلب: " + orderDescription,
    "المادة المختارة: " + subject,
    "المبلغ المطلوب: " + amount + " جنيه",
    "رقم الطالب: " + phone,
    "كود الطالب: " + studentCode,
    "باسوورد الطالب: " + (passwordInput.trim() || "غير متوفر"),
    "وسيلة الدفع: " + paymentMethod,
    "رقم الهاتف المُحوِّل: " + senderPhone,
    "الحالة: في انتظار مراجعة الدفع"
  ].join("\n");

  try {
    await env.DB.prepare(
      "INSERT INTO orders (id, type, grade, subject, bundle, amount, phone, student_code, payment_method, sender_phone, receipt_type, receipt_size, status, telegram_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')"
    ).bind(
      id, type, grade, subject, bundle ? 1 : 0, amount, phone, studentCode,
      paymentMethod, senderPhone, receipt.type, receipt.size
    ).run();
  } catch (error) {
    console.error("Order storage error:", error.message);
    return json({ ok: false, message: "تعذر حفظ الطلب حاليًا. حاول مرة أخرى لاحقًا." }, 503);
  }

  let telegramSent = false;
  try {
    await telegramPhoto(env, receipt, caption);
    telegramSent = true;
  } catch (error) {
    console.error("Telegram notification error:", error.message);
  }
  await env.DB.prepare("UPDATE orders SET telegram_status = ? WHERE id = ?")
    .bind(telegramSent ? "sent" : "failed", id).run();

  return json({
    ok: true,
    message: telegramSent
      ? "تم استلام طلبك وإثبات الدفع بنجاح. جاري مراجعة عملية الدفع والتحويل."
      : "تم حفظ طلبك بنجاح، لكن تعذر إرسال إشعار Telegram للإدارة. سيتم مراجعته من لوحة الإدارة.",
    orderId: id,
    telegramSent
  });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return json({
      ok: true,
      service: "EDU SOLVER",
      platform: "Cloudflare Workers",
      adminStorageReady: requireStorage(env)
    });
  }

  if (url.pathname === "/api/site-settings" && request.method === "GET") {
    if (!requireStorage(env)) return json({ ok: false, message: "الإعدادات غير متاحة حاليًا." }, 503);
    const settings = await readSiteSettings(env);
    return json({
      ok: true,
      prices: settings.prices,
      offer: settings.offer,
      maintenance: settings.maintenance,
      announcement: settings.announcement
    }, 200, { "cache-control": "no-store" });
  }

  if (url.pathname === "/api/payment-info" && request.method === "GET") {
    return json({
      ok: true,
      methods: {
        "InstaPay": env.INSTAPAY_RECEIVER || "01004876339",
        "Vodafone Cash": env.VODAFONE_CASH_RECEIVER || "01063942772",
        "Telda": env.TELDA_RECEIVER || "@kareemahme675859"
      }
    });
  }

  if (url.pathname.startsWith("/api/admin/")) return handleAdmin(request, env);
  if (url.pathname === "/api/submit") return handleSubmit(request, env);
  if (url.pathname === "/api/track") return handleTrack(request, env);
  return json({ ok: false, message: "المسار غير موجود." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return withCors(new Response(null, { status: 204 }), request);
      }
      return withCors(await handleApi(request, env), request);
    }
    if (url.pathname === "/health") return handleApi(request, env);
    return env.ASSETS.fetch(request);
  }
};

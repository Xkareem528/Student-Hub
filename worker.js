const recentRequests = new Map();

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
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

const ALLOWED_ORIGIN = "https://edusolver.pages.dev";

function withCors(response, request) {
  const headers = new Headers(response.headers);
  headers.set("Vary", "Origin");

  if (request.headers.get("Origin") === ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function handleApi(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/health" && request.method === "GET") {
    return json({ ok: true, service: "EDU SOLVER", platform: "Cloudflare Workers" });
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

  if (url.pathname !== "/api/submit") {
    return json({ ok: false, message: "المسار غير موجود." }, 404);
  }
  if (request.method !== "POST") {
    return json({ ok: false, message: "طريقة الطلب غير مدعومة." }, 405);
  }
  if (isRateLimited(request)) {
    return json({ ok: false, message: "انتظر قليلًا قبل المحاولة مرة أخرى." }, 429);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 6 * 1024 * 1024) {
    return json({ ok: false, message: "حجم الطلب كبير جدًا. الحد الأقصى 5 ميجابايت للصورة." }, 413);
  }

  let data;
  try {
    data = await request.formData();
  } catch {
    return json({ ok: false, message: "بيانات الطلب غير صالحة." }, 400);
  }

  const type = data.get("type");
  const grade = data.get("grade");
  const subject = data.get("subject");
  const phone = data.get("phone");
  const studentCode = data.get("studentCode");
  const note = data.get("note");
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
  if (consent !== "true") {
    return json({ ok: false, message: "يجب تأكيد صحة البيانات أولًا." }, 400);
  }
  if ([phone, studentCode].some(value =>
    typeof value !== "string" || !value.trim() || value.length > 100
  )) {
    return json({ ok: false, message: "تأكد من بيانات الطلب الأساسية." }, 400);
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

  const paymentDetails = {
    "InstaPay": env.INSTAPAY_RECEIVER || "01004876339",
    "Vodafone Cash": env.VODAFONE_CASH_RECEIVER || "01063942772",
    "Telda": env.TELDA_RECEIVER || "@kareemahme675859"
  };
  if (!paymentDetails[paymentMethod]) {
    return json({ ok: false, message: "بيانات وسيلة الدفع لم تُضف بعد. حاول لاحقًا." }, 503);
  }

  const prices = {
    "JavaScript (QUREO)": 35,
    "JavaScript": 40,
    "Python": 40,
    "ثقافة مالية": 40,
    "Financial Literacy": 40
  };
  const amount = bundle ? 100 : prices[subject];
  const orderDescription = bundle
    ? "باقة المواد الثلاثة: Python + JavaScript + " + (type === "لغات" ? "Financial Literacy" : "ثقافة مالية")
    : subject;

  const caption = [
    "طلب جديد من EDU SOLVER — إثبات دفع",
    "النوع: " + type,
    "الصف: " + grade,
    "الطلب: " + orderDescription,
    "المادة المختارة في النموذج: " + subject,
    "المبلغ المطلوب: " + amount + " جنيه",
    "رقم الطالب: " + phone,
    "كود الطالب: " + studentCode,
    "وسيلة الدفع: " + paymentMethod,
    "رقم الهاتف المُحوِّل: " + senderPhone,
    "الحالة: في انتظار مراجعة الدفع"
  ].join("\n");

  try {
    await telegramPhoto(env, receipt, caption);
  } catch (error) {
    console.error("Telegram notification error:", error.message);
    return json({ ok: false, message: "تعذر إرسال إثبات الدفع. تأكد من الاتصال وحاول مرة أخرى." }, 502);
  }

  return json({ ok: true, message: "تم استلام طلبك وإثبات الدفع بنجاح. جاري مراجعة عملية الدفع والتحويل." });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/submit" || url.pathname === "/api/payment-info") {
      if (request.method === "OPTIONS") {
        return withCors(new Response(null, { status: 204 }), request);
      }
      const response = await handleApi(request, env);
      return withCors(response, request);
    }
    if (url.pathname === "/health") {
      return handleApi(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};

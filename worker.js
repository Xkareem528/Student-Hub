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

  // Keep the isolate's in-memory map bounded.
  if (recentRequests.size > 1000) {
    for (const [key, time] of recentRequests) {
      if (now - time > 60000) recentRequests.delete(key);
    }
  }
  return false;
}

async function notifyTelegram(data, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("Telegram is not configured");
  }

  const message = [
    "طلب جديد من EDU SOLVER",
    "النوع: " + data.type,
    "الصف: " + data.grade,
    "المادة: " + data.subject,
    "رقم الهاتف: " + data.phone,
    "كود الطالب: " + data.studentCode,
    "باسوورد الطالب: " + data.note,
    
    ...(data.note ? ["الملاحظة: " + data.note] : [])
  ].join("\n");

  const response = await fetch(
    "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message })
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error("Telegram notification failed");
  }
}

async function handleApi(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/health" && request.method === "GET") {
    return json({ ok: true, service: "EDU SOLVER", platform: "Cloudflare Workers" });
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
  if (contentLength > 10 * 1024) {
    return json({ ok: false, message: "حجم الطلب كبير جدًا." }, 413);
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 10 * 1024) {
      return json({ ok: false, message: "حجم الطلب كبير جدًا." }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, message: "بيانات الطلب غير صالحة." }, 400);
  }

  const { type, grade, subject, phone, studentCode, note = "", consent } = body || {};
  const allowedTypes = ["حكومي", "لغات"];
  const allowedGrades = ["أولى بكالوريا", "تانية بكالوريا"];
  const allowedSubjects = {
    "حكومي|أولى بكالوريا": ["JavaScript (QUREO)"],
    "حكومي|تانية بكالوريا": ["Python", "JavaScript", "ثقافة مالية"],
    "لغات|أولى بكالوريا": ["JavaScript (QUREO)"],
    "لغات|تانية بكالوريا": ["Python", "JavaScript", "Financial Literacy"]
  };

  if (
    !allowedTypes.includes(type) ||
    !allowedGrades.includes(grade) ||
    !allowedSubjects[type + "|" + grade]?.includes(subject)
  ) {
    return json({ ok: false, message: "اختيارات غير صحيحة." }, 400);
  }

  if (consent !== true) {
    return json({ ok: false, message: "يجب الموافقة على إرسال البيانات أولًا." }, 400);
  }

  if (typeof note !== "string" || note.length > 100) {
    return json({ ok: false, message: "الملاحظة يجب ألا تتجاوز 100 حرف." }, 400);
  }

  const values = [phone, studentCode];
  if (values.some(value =>
    typeof value !== "string" || !value.trim() || value.length > 100
  )) {
    return json({ ok: false, message: "تأكد من إدخال البيانات المطلوبة بشكل صحيح." }, 400);
  }

  try {
    await notifyTelegram({
      type,
      grade,
      subject,
      phone: phone.trim(),
      studentCode: studentCode.trim(),
      note: note.trim()
    }, env);
  } catch (error) {
    console.error("Telegram notification error:", error.message);
    return json({
      ok: false,
      message: "تعذر إرسال الطلب. تأكد من إعدادات الإشعارات وحاول مرة أخرى."
    }, 502);
  }

  return json({ ok: true, message: "جاري الحل انتظر رسالة علي الواتساب بتاعك" });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/submit" || url.pathname === "/health") {
      return handleApi(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};

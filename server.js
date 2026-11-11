const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(express.static(publicDir, { extensions: ["html"] }));

const allowedTypes = new Set(["حكومي", "لغات"]);
const allowedGrades = new Set(["أولى بكالوريا", "تانية بكالوريا"]);
const recentRequests = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const previous = recentRequests.get(key) || 0;
  if (now - previous < 5000) {
    return res.status(429).json({ ok: false, message: "انتظر قليلًا قبل المحاولة مرة أخرى." });
  }
  recentRequests.set(key, now);
  next();
}

async function notifyTelegram({ type, grade, phone, studentCode, specialWord }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("Telegram is not configured");
  }

  const message = [
    "طلب جديد من EDU SOLVER",
    "النوع: " + type,
    "الصف: " + grade,
    "رقم الهاتف: " + phone,
    "كود الطالب: " + studentCode,
    "الكلمة المميزة: " + specialWord
  ].join("\n");

  const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error("Telegram notification failed");
}

app.post("/api/submit", rateLimit, async (req, res) => {
  const body = req.body || {};
  const { type, grade, phone, studentCode, specialWord, consent } = body;

  if (!allowedTypes.has(type) || !allowedGrades.has(grade)) {
    return res.status(400).json({ ok: false, message: "اختيارات غير صحيحة." });
  }

  if (consent !== true) {
    return res.status(400).json({ ok: false, message: "يجب الموافقة على إرسال البيانات أولًا." });
  }

  const values = [phone, studentCode, specialWord];
  if (values.some(value => typeof value !== "string" || !value.trim() || value.length > 100)) {
    return res.status(400).json({ ok: false, message: "تأكد من إدخال البيانات المطلوبة بشكل صحيح." });
  }

  try {
    await notifyTelegram({
      type,
      grade,
      phone: phone.trim(),
      studentCode: studentCode.trim(),
      specialWord: specialWord.trim()
    });
  } catch (error) {
    console.error("Notification error:", error.message);
    return res.status(502).json({ ok: false, message: "تعذر إرسال الطلب. تأكد من إعدادات الإشعارات وحاول مرة أخرى." });
  }

  return res.json({ ok: true, message: "تم إرسال بياناتك إلى إدارة EDU SOLVER بنجاح." });
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "EDU SOLVER" }));

app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.listen(PORT, () => console.log("EDU SOLVER running on port " + PORT));

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

async function notifyTelegram(type, grade) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const message = [
    "طلب تجريبي جديد من EDU SOLVER",
    "النوع: " + type,
    "الصف: " + grade,
    "تنبيه: لم يتم إرسال أو تخزين رقم الهاتف أو كود الطالب أو الكلمة المميزة."
  ].join("\n");

  const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });
  if (!response.ok) throw new Error("Telegram notification failed");
}

app.post("/api/submit", rateLimit, async (req, res) => {
  const { type, grade } = req.body || {};
  if (!allowedTypes.has(type) || !allowedGrades.has(grade)) {
    return res.status(400).json({ ok: false, message: "اختيارات غير صحيحة." });
  }

  try {
    await notifyTelegram(type, grade);
  } catch (error) {
    console.error("Notification error:", error.message);
    return res.status(502).json({ ok: false, message: "تعذر إرسال إشعار الطلب. حاول مرة أخرى." });
  }

  return res.json({
    ok: true,
    message: "تم استلام طلبك التجريبي. لا يوجد اتصال حاليًا بنظام حل فعلي."
  });
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "EDU SOLVER" }));

app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.listen(PORT, () => console.log("EDU SOLVER running on port " + PORT));

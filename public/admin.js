const API = "";
let adminToken = "";

const $ = (selector) => document.querySelector(selector);
const statusLabels = {
  pending: "في انتظار مراجعة الدفع",
  approved: "تم قبول الدفع",
  rejected: "تم رفض الدفع",
  processing: "جاري التنفيذ",
  completed: "مكتمل"
};
const statusOptions = Object.entries(statusLabels);

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (adminToken) headers.set("Authorization", "Bearer " + adminToken);
  const response = await fetch(API + path, { ...options, headers, cache: "no-store" });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (!response.ok) throw new Error("تعذر الاتصال بالخادم (" + response.status + ")");
    return response;
  }
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.message || "حدث خطأ غير متوقع.");
  return data;
}

function showMessage(target, message, isError = false) {
  target.textContent = message;
  target.classList.toggle("error", isError);
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderOrder(order) {
  const card = make("article", "order");
  const top = make("div", "order-top");
  const identity = make("div", "order-identity");
  identity.append(
    make("strong", "", order.subject + (order.bundle ? " · باقة" : "")),
    make("small", "", "رقم الطلب: " + order.id),
    make("small", "", new Date(order.created_at.replace(" ", "T") + "Z").toLocaleString("ar-EG"))
  );
  const badge = make("span", "status-badge status-" + order.status, statusLabels[order.status] || order.status);
  top.append(identity, badge);

  const details = make("div", "order-details");
  [
    ["النوع والصف", order.type + " · " + order.grade],
    ["رقم الهاتف", order.phone],
    ["كود الطالب", order.student_code],
    ["المبلغ", order.amount + " جنيه"],
    ["وسيلة الدفع", order.payment_method],
    ["رقم المحوّل", order.sender_phone],
    ["إشعار Telegram", order.telegram_status === "sent" ? "تم الإرسال" : order.telegram_status === "failed" ? "تعذر الإرسال" : "قيد الإرسال"]
  ].forEach(([label, value]) => {
    const item = make("div", "detail");
    item.append(make("span", "", label), make("b", "", String(value ?? "—")));
    details.append(item);
  });

  const actions = make("div", "order-actions");
  const receiptNote = make("span", "receipt-note", "صورة الإيصال موجودة في رسالة Telegram الخاصة بهذا الطلب");
  const select = document.createElement("select");
  select.setAttribute("aria-label", "تغيير حالة الطلب");
  statusOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === order.status;
    select.append(option);
  });
  select.addEventListener("change", async () => {
    select.disabled = true;
    try {
      const result = await api("/api/admin/orders/" + encodeURIComponent(order.id) + "/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: select.value })
      });
      showMessage($("#dashboard-message"),
        result.telegramNotified ? "تم تحديث الحالة وإرسال إشعار Telegram." : "تم تحديث الحالة، لكن تعذر إرسال إشعار Telegram.");
      await loadOrders();
    } catch (error) {
      showMessage($("#dashboard-message"), error.message, true);
      select.value = order.status;
      select.disabled = false;
    }
  });
  actions.append(receiptNote, select);
  card.append(top, details, actions);
  return card;
}

async function loadOrders() {
  const params = new URLSearchParams();
  const query = $("#search").value.trim();
  const status = $("#status-filter").value;
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  const data = await api("/api/admin/orders?" + params.toString());
  $("#stat-total").textContent = data.stats.total ?? 0;
  $("#stat-pending").textContent = data.stats.pending ?? 0;
  $("#stat-completed").textContent = data.stats.completed ?? 0;
  $("#stat-revenue").textContent = Number(data.stats.revenue ?? 0).toLocaleString("ar-EG");
  $("#orders-count").textContent = (data.orders || []).length + " طلب";
  const container = $("#orders");
  container.replaceChildren();
  if (!data.orders?.length) {
    container.append(make("p", "empty", "لا توجد طلبات مطابقة."));
    return;
  }
  data.orders.forEach(order => container.append(renderOrder(order)));
}

async function refresh() {
  try {
    await loadOrders();
    showMessage($("#dashboard-message"), "تم تحديث البيانات.");
  } catch (error) {
    showMessage($("#dashboard-message"), error.message, true);
  }
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  showMessage($("#login-message"), "جاري التحقق...");
  try {
    const response = await fetch(API + "/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("#admin-password").value })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "تعذر تسجيل الدخول.");
    adminToken = data.token;
    $("#admin-password").value = "";
    $("#login-card").hidden = true;
    $("#dashboard").hidden = false;
    $("#logout").hidden = false;
    await loadOrders();
  } catch (error) {
    showMessage($("#login-message"), error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("#logout").addEventListener("click", () => {
  adminToken = "";
  $("#dashboard").hidden = true;
  $("#logout").hidden = true;
  $("#login-card").hidden = false;
  showMessage($("#login-message"), "تم تسجيل الخروج.");
});
$("#refresh").addEventListener("click", refresh);
$("#search-button").addEventListener("click", refresh);
$("#status-filter").addEventListener("change", refresh);
$("#search").addEventListener("keydown", event => {
  if (event.key === "Enter") refresh();
});

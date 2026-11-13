(() => {
  const API = "https://student-hub.kareemahmedhussein4.workers.dev";
  const form = document.querySelector("#tracking-form");
  const orderInput = document.querySelector("#tracking-order-id");
  const phoneInput = document.querySelector("#tracking-phone");
  const loading = document.querySelector("#tracking-loading");
  const errorBox = document.querySelector("#tracking-error");
  const content = document.querySelector("#tracking-content");
  const submitButton = document.querySelector("#tracking-submit");
  const refreshButton = document.querySelector("#tracking-refresh");
  let lastLookup = null;

  const params = new URLSearchParams(window.location.search);
  const presetOrder = params.get("order");
  if (presetOrder) orderInput.value = presetOrder;

  function normalizeEgyptPhone(value) {
    let phone = String(value || "").trim()
      .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[\\s().-]/g, "");
    if (phone.startsWith("+20")) phone = "0" + phone.slice(3);
    else if (phone.startsWith("0020")) phone = "0" + phone.slice(4);
    else if (phone.startsWith("20") && phone.length === 12) phone = "0" + phone.slice(2);
    return /^01\\d{9}$/.test(phone) ? phone : "";
  }

  function showError(message) {
    loading.hidden = true;
    content.hidden = true;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value.replace(" ", "T") + "Z");
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-EG");
  }

  async function loadOrder() {
    const orderId = orderInput.value.trim();
    const phone = normalizeEgyptPhone(phoneInput.value);
    if (!/^[a-f0-9-]{36}$/i.test(orderId)) {
      showError("أدخل رقم الطلب الصحيح.");
      orderInput.focus();
      return;
    }
    if (!phone) {
      showError("أدخل رقم هاتف مصري صحيحًا، مثل 01012345678.");
      phoneInput.focus();
      return;
    }

    phoneInput.value = phone;
    lastLookup = { orderId, phone };
    submitButton.disabled = true;
    refreshButton.disabled = true;
    loading.hidden = false;
    loading.textContent = "جاري التحقق من بيانات الطلب...";
    errorBox.hidden = true;
    content.hidden = true;

    try {
      const response = await fetch(API + "/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(lastLookup)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || "تعذر تحميل حالة الطلب.");
      const order = data.order;
      document.querySelector("#status-label").textContent = order.statusLabel || "قيد المراجعة";
      document.querySelector("#order-id").textContent = order.id;
      document.querySelector("#order-grade").textContent = order.grade;
      document.querySelector("#order-subject").textContent = order.subject;
      document.querySelector("#order-amount").textContent = Number(order.amount).toLocaleString("ar-EG") + " جنيه";
      document.querySelector("#order-created").textContent = formatDate(order.createdAt);
      document.querySelector("#order-updated").textContent = formatDate(order.updatedAt);
      loading.hidden = true;
      content.hidden = false;
    } catch (error) {
      showError(error.message || "حدث خطأ أثناء تحميل حالة الطلب.");
    } finally {
      submitButton.disabled = false;
      refreshButton.disabled = false;
      submitButton.textContent = "عرض حالة الطلب";
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    loadOrder();
  });
  refreshButton.addEventListener("click", () => {
    if (lastLookup) loadOrder();
  });
})();

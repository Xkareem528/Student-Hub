(() => {
  const API = "https://student-hub.kareemahmedhussein4.workers.dev";
  const token = window.location.hash.slice(1);
  const loading = document.querySelector("#tracking-loading");
  const errorBox = document.querySelector("#tracking-error");
  const content = document.querySelector("#tracking-content");
  const refreshButton = document.querySelector("#tracking-refresh");

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
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      showError("رابط المتابعة غير مكتمل. افتح الرابط الذي ظهر لك بعد إرسال الطلب.");
      return;
    }
    refreshButton.disabled = true;
    refreshButton.textContent = "جاري التحديث...";
    try {
      const response = await fetch(API + "/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ token })
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
      errorBox.hidden = true;
      content.hidden = false;
    } catch (error) {
      showError(error.message || "حدث خطأ أثناء تحميل حالة الطلب.");
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = "تحديث الحالة ↻";
    }
  }

  refreshButton.addEventListener("click", loadOrder);
  loadOrder();
})();


(() => {
  const list = document.querySelector("#orders");
  const filters = document.querySelector(".filters");
  if (!list || !filters) return;
  const tools = document.createElement("div");
  tools.className = "admin-tools";
  tools.innerHTML = '<button type="button" id="export-orders">تصدير الطلبات CSV ↓</button><button type="button" id="print-orders">طباعة التقرير</button>';
  filters.insertAdjacentElement("afterend", tools);
  const feedback = document.createElement("p");
  feedback.className = "export-feedback";
  feedback.setAttribute("role", "status");
  tools.insertAdjacentElement("afterend", feedback);

  function csvCell(value) {
    return '"' + String(value ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ") + '"';
  }

  document.querySelector("#export-orders").addEventListener("click", () => {
    const cards = [...list.querySelectorAll(".order")];
    if (!cards.length) {
      feedback.textContent = "لا توجد طلبات ظاهرة لتصديرها.";
      return;
    }
    const rows = [["رقم الطلب","المادة","الحالة","المبلغ","وسيلة الدفع","إشعار Telegram"]];
    cards.forEach(card => {
      const id = card.querySelector(".order-identity small")?.textContent || "";
      const subject = card.querySelector(".order-identity strong")?.textContent || "";
      const status = card.querySelector(".status-badge")?.textContent || "";
      const values = {};
      card.querySelectorAll(".detail").forEach(item => {
        const key = item.querySelector("span")?.textContent?.trim();
        const value = item.querySelector("b")?.textContent?.trim();
        if (key) values[key] = value;
      });
      rows.push([id,subject,status,values["المبلغ"],values["وسيلة الدفع"],values["إشعار Telegram"]]);
    });
    const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "edu-solver-orders-" + new Date().toISOString().slice(0,10) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    feedback.textContent = "تم تجهيز ملف الطلبات الظاهرة حاليًا.";
  });

  document.querySelector("#print-orders").addEventListener("click", () => window.print());
})();

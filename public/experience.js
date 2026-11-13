
(() => {
  const form = document.querySelector("#solver-form");
  if (!form) return;
  const panelHeading = form.closest(".panel")?.querySelector(".panel-heading");
  if (!panelHeading) return;

  const journey = document.createElement("div");
  journey.className = "journey-wrap";
  journey.innerHTML = '<div class="journey" aria-label="مراحل الطلب"><div class="journey-step active" data-step="1"><span class="journey-number">01</span><div><b>اختيار الدراسة</b><small>النوع والصف والمادة</small></div></div><div class="journey-step" data-step="2"><span class="journey-number">02</span><div><b>بيانات الطالب</b><small>معلومات الطلب</small></div></div><div class="journey-step" data-step="3"><span class="journey-number">03</span><div><b>الدفع والتأكيد</b><small>إثبات الدفع</small></div></div></div>';
  panelHeading.insertAdjacentElement("afterend", journey);

  const steps = [...journey.querySelectorAll(".journey-step")];
  const subjectField = document.querySelector("#subject-fieldset");
  const studentDetails = document.querySelector("#student-details");
  function updateJourney() {
    const paymentStep = document.querySelector("#payment-step");
    const paymentVisible = paymentStep && !paymentStep.hidden;
    const detailsVisible = studentDetails && !studentDetails.hidden;
    const subjectChosen = Boolean(form.querySelector('input[name="subject"]:checked'));
    const stage = paymentVisible ? 3 : detailsVisible ? 2 : subjectChosen ? 2 : 1;
    steps.forEach((item, index) => {
      const number = index + 1;
      item.classList.toggle("active", number === stage);
      item.classList.toggle("done", number < stage);
    });
  }

  function addOrderSummary() {
    const payment = document.querySelector("#payment-step");
    if (!payment || payment.hidden || payment.querySelector(".flow-summary")) return;
    const type = form.querySelector('input[name="type"]:checked')?.value || "—";
    const grade = form.querySelector('input[name="grade"]:checked')?.value || "—";
    const subject = form.querySelector('input[name="subject"]:checked')?.closest("label")?.querySelector(".option-copy b")?.textContent || "—";
    const phone = document.querySelector("#phone")?.value.trim() || "";
    const box = document.createElement("div");
    box.className = "flow-summary";
    box.setAttribute("aria-label", "ملخص بيانات الطلب");
    const entries = [["نوع التعليم", type], ["الصف الدراسي", grade], ["المادة المختارة", subject]];
    entries.forEach(([label, value]) => {
      const item = document.createElement("div");
      const caption = document.createElement("span");
      caption.textContent = label;
      const strong = document.createElement("b");
      strong.textContent = value;
      item.append(caption, strong);
      box.appendChild(item);
    });
    const heading = payment.querySelector(".payment-heading");
    (heading || payment.firstElementChild)?.insertAdjacentElement("afterend", box);
  }

  const observer = new MutationObserver(() => {
    updateJourney();
    addOrderSummary();
  });
  [subjectField, studentDetails, form].filter(Boolean).forEach(node => observer.observe(node, {attributes:true,childList:true,subtree:true}));
  observer.observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
  form.addEventListener("change", updateJourney);
  document.addEventListener("click", event => {
    if (event.target.closest("#payment-back,#payment-confirm,.submit-button")) {
      window.setTimeout(() => { updateJourney(); addOrderSummary(); }, 0);
    }
  });
  updateJourney();
})();

const form = document.querySelector("#solver-form");
const result = document.querySelector("#result");
const subjectFieldset = document.querySelector("#subject-fieldset");
const subjectOptions = document.querySelector("#subject-options");
const studentDetails = document.querySelector("#student-details");
let publicSettings = { prices: { "JavaScript (QUREO)": 35, JavaScript: 40, Python: 40, "ثقافة مالية": 40, "Financial Literacy": 40, bundle: 100, bundleOriginal: 120 }, offer: { enabled: true, title: "باقة تانية بكالوريا", description: "المواد الثلاثة بدلًا من 120 جنيه", price: 100, originalPrice: 120 }, maintenance: { enabled: false }, announcement: { enabled: false } };

const subjectsBySelection = {
  "حكومي|أولى بكالوريا": [
    { value: "JavaScript (QUREO)", label: "جافا سكريبت (QUREO)", icon: "💻" }
  ],
  "حكومي|تانية بكالوريا": [
    { value: "Python", label: "بايثون", icon: "🐍" },
    { value: "JavaScript", label: "جافا سكريبت", icon: "💻" },
    { value: "ثقافة مالية", label: "ثقافة مالية", icon: "💰" }
  ],
  "لغات|أولى بكالوريا": [
    { value: "JavaScript (QUREO)", label: "JavaScript (QUREO)", icon: "💻" }
  ],
  "لغات|تانية بكالوريا": [
    { value: "Python", label: "Python", icon: "🐍" },
    { value: "JavaScript", label: "JavaScript", icon: "💻" },
    { value: "Financial Literacy", label: "Financial Literacy", icon: "💰" }
  ]
};

const yearElement = document.querySelector("#year");
if (yearElement) yearElement.textContent = new Date().getFullYear();

function updateSelectedCards() {
  document.querySelectorAll(".option-card input").forEach((input) => {
    input.closest(".option-card")?.classList.toggle("selected", input.checked);
  });
}

function updateFlow() {
  const type = form.querySelector('input[name="type"]:checked')?.value;
  const grade = form.querySelector('input[name="grade"]:checked')?.value;
  const subjects = subjectsBySelection[type + "|" + grade] || [];

  subjectOptions.replaceChildren();
  studentDetails.hidden = true;
  subjectFieldset.hidden = false;

  subjects.forEach((subject) => {
    const label = document.createElement("label");
    label.className = "option-card";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "subject";
    radio.value = subject.value;

    const icon = document.createElement("span");
    icon.className = "option-icon";
    icon.textContent = subject.icon;

    const copy = document.createElement("span");
    copy.className = "option-copy";
    const title = document.createElement("b");
    title.textContent = subject.label;
    const hint = document.createElement("small");
    hint.textContent = "المادة المختارة";
    copy.append(title, hint);

    const dot = document.createElement("span");
    dot.className = "radio-dot";
    label.append(radio, icon, copy, dot);
    radio.addEventListener("change", () => {
      updateSelectedCards();
      studentDetails.hidden = false;
      result.textContent = "";
      result.classList.remove("error");
      studentDetails.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    subjectOptions.appendChild(label);
  });

  updateSelectedCards();
}

form.querySelectorAll('input[name="type"], input[name="grade"]').forEach((input) => {
  input.addEventListener("change", () => {
    updateSelectedCards();
    updateFlow();
  });
});

updateFlow();

async function loadPublicSettings() {
  try {
    const response = await fetch("https://student-hub.kareemahmedhussein4.workers.dev/api/site-settings", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) return;
    publicSettings = data;
    const cards = document.querySelectorAll(".price-card");
    const prices = document.querySelectorAll(".price-card strong");
    if (prices[0]) prices[0].textContent = data.prices["JavaScript (QUREO)"] + " جنيه";
    if (prices[1]) prices[1].textContent = data.prices.JavaScript + " جنيه";
    if (prices[2]) prices[2].textContent = data.prices.bundle + " جنيه";
    if (cards[2]) {
      cards[2].hidden = !data.offer.enabled;
      if (data.offer.enabled) {
        cards[2].querySelector("span").textContent = data.offer.title;
        cards[2].querySelector("small").textContent = data.offer.description;
      }
    }
    const banner = document.querySelector("#site-announcement");
    if (banner && (data.maintenance.enabled || data.announcement.enabled)) {
      banner.hidden = false;
      banner.textContent = data.maintenance.enabled ? data.maintenance.message : data.announcement.message;
      banner.classList.toggle("warning", data.maintenance.enabled || data.announcement.type === "warning");
    }
    if (data.maintenance.enabled) {
      document.querySelectorAll(".submit-button").forEach(button => {
        button.disabled = true;
        const label = button.querySelector("span");
        if (label) label.textContent = "الموقع تحت الصيانة";
      });
    }
  } catch {}
}
loadPublicSettings();

const submitButton = form.querySelector(".submit-button");
let pendingOrder = null;

function showError(message) {
  result.textContent = message;
  result.classList.add("error");
}

function createPaymentStep() {
  let step = document.querySelector("#payment-step");
  if (step) return step;

  step = document.createElement("section");
  step.id = "payment-step";
  step.className = "payment-step";
  step.hidden = true;
  step.innerHTML = `
    <div class="payment-heading">
      <span class="step-label">02 / PAYMENT</span>
      <h3>إتمام الدفع</h3>
      <p>اختار وسيلة الدفع وحوّل المبلغ المتفق عليه، ثم ارفع صورة الإيصال.</p>
    </div>
    <div id="payment-price" class="payment-price" aria-live="polite"></div>
    <div id="payment-plan" class="payment-plan" aria-label="اختيار الباقة" hidden></div>
    <div class="payment-methods" role="group" aria-label="وسيلة الدفع">
      <label class="payment-method"><input type="radio" name="payment-method" value="InstaPay"><span>InstaPay</span></label>
      <label class="payment-method"><input type="radio" name="payment-method" value="Vodafone Cash"><span>Vodafone Cash</span></label>
      <label class="payment-method"><input type="radio" name="payment-method" value="Telda"><span>Telda</span></label>
    </div>
    <div id="payment-instructions" class="payment-instructions" aria-live="polite">اختار وسيلة الدفع لعرض بيانات التحويل.</div>
    <label class="field payment-upload"><span>صورة إيصال التحويل</span><input id="payment-receipt" type="file" accept="image/jpeg,image/png,image/webp" required></label>
    <label class="field payment-upload"><span>رقم الهاتف الذي تم التحويل منه</span><input id="sender-phone" type="tel" inputmode="numeric" maxlength="11" placeholder="01xxxxxxxxx" required></label>
    <div class="payment-actions">
      <button id="payment-back" class="payment-back" type="button">رجوع</button>
      <button id="payment-confirm" class="submit-button" type="button"><span>إرسال الطلب وإثبات الدفع</span><b>←</b></button>
    </div>
    <p id="payment-result" class="result" role="status" aria-live="polite"></p>
  `;

  studentDetails.insertAdjacentElement("afterend", step);

  const instruction = step.querySelector("#payment-instructions");
  step.querySelectorAll('input[name="payment-method"]').forEach((radio) => {
    radio.addEventListener("change", async () => {
      step.querySelectorAll(".payment-method").forEach((label) => {
        label.classList.toggle("selected", label.querySelector("input").checked);
      });
      instruction.textContent = "جاري تحميل بيانات الدفع...";
      try {
        const response = await fetch("https://student-hub.kareemahmedhussein4.workers.dev/api/payment-info", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || "تعذر تحميل بيانات الدفع.");
        const details = data.methods[radio.value];
        if (!details) {
          instruction.textContent = "بيانات هذه الوسيلة لم تُضف بعد. تواصل مع إدارة الموقع.";
          return;
        }

        instruction.replaceChildren();
        const account = document.createElement("span");
        account.className = "payment-account";
        account.textContent = details;

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "copy-payment-button";
        copyButton.textContent = "نسخ";
        copyButton.setAttribute("aria-label", "نسخ بيانات وسيلة الدفع");
        copyButton.addEventListener("click", async () => {
          try {
            if (navigator.clipboard && window.isSecureContext) {
              await navigator.clipboard.writeText(details);
            } else {
              const temporaryInput = document.createElement("textarea");
              temporaryInput.value = details;
              temporaryInput.setAttribute("readonly", "");
              temporaryInput.style.position = "fixed";
              temporaryInput.style.opacity = "0";
              document.body.appendChild(temporaryInput);
              temporaryInput.select();
              const copied = document.execCommand("copy");
              temporaryInput.remove();
              if (!copied) throw new Error("Clipboard unavailable");
            }
            copyButton.textContent = "تم النسخ ✓";
            window.setTimeout(() => { copyButton.textContent = "نسخ"; }, 1800);
          } catch {
            copyButton.textContent = "تعذر النسخ";
            window.setTimeout(() => { copyButton.textContent = "نسخ"; }, 1800);
          }
        });

        instruction.append(account, copyButton);
      } catch (error) {
        instruction.textContent = error.message || "تعذر تحميل بيانات الدفع.";
      }
    });
  });

  step.querySelector("#payment-back").addEventListener("click", () => {
    step.hidden = true;
    studentDetails.hidden = false;
    result.textContent = "";
    studentDetails.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  step.querySelector("#payment-confirm").addEventListener("click", submitPaidOrder);
  return step;
}

function updatePaymentPrice(order) {
  const step = createPaymentStep();
  const priceBox = step.querySelector("#payment-price");
  const planBox = step.querySelector("#payment-plan");
  priceBox.replaceChildren();
  planBox.replaceChildren();

  const price = publicSettings.prices[order.subject];
  const isSecondYear = order.grade === "تانية بكالوريا";

  if (isSecondYear) {
    planBox.hidden = false;
    const plans = [
      { value: "single", title: "المادة المختارة فقط", detail: (order.subject || "المادة") + " — " + price + " جنيه" },
      ...(publicSettings.offer.enabled ? [{ value: "bundle", title: publicSettings.offer.title, detail: "Python + JavaScript + " + (order.type === "لغات" ? "Financial Literacy" : "ثقافة مالية") + " — " + publicSettings.prices.bundle + " جنيه بدلًا من " + publicSettings.prices.bundleOriginal }] : [])
    ];

    plans.forEach((plan) => {
      const label = document.createElement("label");
      label.className = "payment-plan-option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "payment-plan-choice";
      radio.value = plan.value;
      radio.checked = plan.value === (order.bundle ? "bundle" : "single");
      const copy = document.createElement("span");
      copy.className = "payment-plan-copy";
      const title = document.createElement("strong");
      title.textContent = plan.title;
      const detail = document.createElement("small");
      detail.textContent = plan.detail;
      copy.append(title, detail);
      label.append(radio, copy);
      planBox.appendChild(label);
      radio.addEventListener("change", () => {
        order.bundle = radio.value === "bundle";
        updatePaymentPrice(order);
      });
    });
  } else {
    planBox.hidden = true;
    order.bundle = false;
  }

  const title = document.createElement("div");
  title.className = "payment-price-title";
  title.textContent = "ملخص السعر";
  const selected = document.createElement("div");
  selected.className = "payment-price-line";
  selected.textContent = order.bundle
    ? publicSettings.offer.title + " — " + publicSettings.prices.bundle + " جنيه"
    : order.subject + " — " + (price ?? "غير محدد") + " جنيه";
  priceBox.append(title, selected);

  if (order.bundle) {
    const saving = document.createElement("div");
    saving.className = "payment-price-saving";
    saving.textContent = "وفّرت " + (publicSettings.prices.bundleOriginal - publicSettings.prices.bundle) + " جنيه — السعر الأصلي " + publicSettings.prices.bundleOriginal + " جنيه";
    priceBox.appendChild(saving);
  }
}

async function submitPaidOrder() {
  const step = createPaymentStep();
  const paymentResult = step.querySelector("#payment-result");
  const confirmButton = step.querySelector("#payment-confirm");
  paymentResult.textContent = "";
  paymentResult.classList.remove("error");

  const method = step.querySelector('input[name="payment-method"]:checked')?.value;
  const receipt = step.querySelector("#payment-receipt").files[0];
  const senderPhone = step.querySelector("#sender-phone").value.trim();

  if (!method) {
    paymentResult.textContent = "اختار وسيلة الدفع أولاً.";
    paymentResult.classList.add("error");
    return;
  }
  if (!receipt || !["image/jpeg", "image/png", "image/webp"].includes(receipt.type)) {
    paymentResult.textContent = "ارفع صورة إيصال بصيغة JPG أو PNG أو WEBP.";
    paymentResult.classList.add("error");
    return;
  }
  if (receipt.size > 5 * 1024 * 1024) {
    paymentResult.textContent = "حجم صورة الإيصال يجب ألا يتجاوز 5 ميجابايت.";
    paymentResult.classList.add("error");
    return;
  }
  if (!/^\d{11}$/.test(senderPhone)) {
    paymentResult.textContent = "رقم الهاتف المُحوِّل يجب أن يتكون من 11 رقمًا بالضبط.";
    paymentResult.classList.add("error");
    return;
  }

  confirmButton.disabled = true;
  confirmButton.querySelector("span").textContent = "جاري إرسال الطلب...";

  try {
    const payload = new FormData();
    payload.append("type", pendingOrder.type);
    payload.append("grade", pendingOrder.grade);
    payload.append("subject", pendingOrder.subject);
    payload.append("bundle", String(Boolean(pendingOrder.bundle)));
    payload.append("phone", pendingOrder.phone);
    payload.append("studentCode", pendingOrder.studentCode);
    payload.append("password", pendingOrder.password);
    payload.append("consent", String(pendingOrder.consent));
    payload.append("paymentMethod", method);
    payload.append("senderPhone", senderPhone);
    payload.append("receipt", receipt, receipt.name);

    const response = await fetch("https://student-hub.kareemahmedhussein4.workers.dev/api/submit", { method: "POST", body: payload });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.message || "تعذر إرسال الطلب. حاول مرة أخرى.");

    step.hidden = true;
    studentDetails.hidden = false;
    form.reset();
    pendingOrder = null;
    updateSelectedCards();
    updateFlow();
    result.replaceChildren(document.createTextNode(
      data.message || "تم استلام طلبك وإثبات الدفع بنجاح. جاري مراجعة عملية الدفع والتحويل."
    ));
    if (data.orderId) {
      const link = document.createElement("a");
      link.className = "tracking-result-link";
      link.href = "/track.html?order=" + encodeURIComponent(data.orderId);
      link.textContent = "متابعة طلبي";
      result.append(document.createElement("br"), link);
      const orderNumber = document.createElement("small");
      orderNumber.className = "tracking-order-number";
      orderNumber.textContent = "رقم الطلب: " + data.orderId;
      result.append(document.createElement("br"), orderNumber);
    }
    result.classList.remove("error");
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    paymentResult.textContent = error.message || "حدث خطأ في الاتصال. حاول مرة أخرى.";
    paymentResult.classList.add("error");
  } finally {
    confirmButton.disabled = false;
    confirmButton.querySelector("span").textContent = "إرسال الطلب وإثبات الدفع";
  }
}

async function handleSubmission(event) {
  event?.preventDefault();
  result.textContent = "";
  result.classList.remove("error");

  const type = form.querySelector('input[name="type"]:checked')?.value;
  const grade = form.querySelector('input[name="grade"]:checked')?.value;
  const subject = form.querySelector('input[name="subject"]:checked')?.value;
  const phone = document.querySelector("#phone").value.trim();
  const studentCode = document.querySelector("#student-code").value.trim();
  const password = document.querySelector("#password").value.trim();
  const consent = document.querySelector("#demo-consent").checked;

  if (!subject) {
    showError("اختر المادة الدراسية أولاً.");
    return;
  }
  if (!phone || !studentCode) {
    showError("أكمل رقم الهاتف وكود الطالب.");
    return;
  }
  if (!consent) {
    showError("من فضلك فعل زر التأكيد");
    return;
  }

  pendingOrder = { type, grade, subject, phone, studentCode, password, consent };
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "جاري تجهيز الدفع...";

  const step = createPaymentStep();
  updatePaymentPrice(pendingOrder);
  step.hidden = false;
  studentDetails.hidden = true;
  step.scrollIntoView({ behavior: "smooth", block: "start" });

  submitButton.disabled = false;
  submitButton.querySelector("span").textContent = "حل الآن";
}

submitButton.addEventListener("click", handleSubmission);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSubmission(event);
});

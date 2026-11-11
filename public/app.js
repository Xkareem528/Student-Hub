const form = document.querySelector("#solver-form");
const result = document.querySelector("#result");
const subjectFieldset = document.querySelector("#subject-fieldset");
const subjectOptions = document.querySelector("#subject-options");
const studentDetails = document.querySelector("#student-details");

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
        instruction.textContent = details || "بيانات هذه الوسيلة لم تُضف بعد. تواصل مع إدارة الموقع.";
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
    payload.append("phone", pendingOrder.phone);
    payload.append("studentCode", pendingOrder.studentCode);
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
    result.textContent = "تم استلام طلبك وإثبات الدفع بنجاح. جاري مراجعة عملية الدفع والتحويل.";
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
  const note = document.querySelector("#special-word").value.trim();
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

  pendingOrder = { type, grade, subject, phone, studentCode, note, consent };
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "جاري تجهيز الدفع...";

  const step = createPaymentStep();
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

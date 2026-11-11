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

async function handleSubmission(event) {
  event?.preventDefault();
  result.textContent = "";
  result.classList.remove("error");

  const buttonSpan = submitButton.querySelector("span");
  const type = form.querySelector('input[name="type"]:checked')?.value;
  const grade = form.querySelector('input[name="grade"]:checked')?.value;
  const subject = form.querySelector('input[name="subject"]:checked')?.value;
  const phone = document.querySelector("#phone").value.trim();
  const studentCode = document.querySelector("#student-code").value.trim();
  const note = document.querySelector("#special-word").value.trim();
  const consent = document.querySelector("#demo-consent").checked;

  if (!subject) {
    result.textContent = "اختر المادة الدراسية أولاً.";
    result.classList.add("error");
    return;
  }
  if (!phone || !studentCode) {
    result.textContent = "أكمل رقم الهاتف وكود الطالب.";
    result.classList.add("error");
    return;
  }
  if (!consent) {
    result.textContent = "من فضلك فعل زر التأكيد";
    result.classList.add("error");
    return;
  }

  submitButton.disabled = true;
  buttonSpan.textContent = "جاري الإرسال...";

  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, grade, subject, phone, studentCode, note, consent })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "تعذر إرسال الطلب. حاول مرة أخرى.");
    }

    result.textContent = data.message || "تم إرسال الطلب بنجاح.";
    result.classList.remove("error");
    form.reset();
    updateSelectedCards();
    updateFlow();
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    result.textContent = error.message || "حدث خطأ في الاتصال. حاول مرة أخرى.";
    result.classList.add("error");
  } finally {
    submitButton.disabled = false;
    buttonSpan.textContent = "حل الآن";
  }
}

submitButton.addEventListener("click", handleSubmission);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSubmission(event);
});

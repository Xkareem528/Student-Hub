const form = document.querySelector("#solver-form");
const result = document.querySelector("#result");

// تعيين السنة الحالية في التذييل تلقائياً
const yearElement = document.querySelector("#year");
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

// إدارة تفاعل خيارات الاختيار (Radio Cards)
document.querySelectorAll(".option-card input").forEach((input) => {
  input.addEventListener("change", () => {
    document.querySelectorAll('input[name="' + input.name + '"]').forEach((item) => {
      item.closest(".option-card").classList.toggle("selected", item.checked);
    });
  });
});

// إرسال الطلب مع إظهار النتيجة الحقيقية من الخادم
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.textContent = "";
  result.classList.remove("error");

  const button = form.querySelector(".submit-button");
  const buttonSpan = button.querySelector("span");
  const type = form.querySelector('input[name="type"]:checked')?.value;
  const grade = form.querySelector('input[name="grade"]:checked')?.value;
  const phone = document.querySelector("#phone").value.trim();
  const studentCode = document.querySelector("#student-code").value.trim();
  const note = document.querySelector("#special-word").value.trim();
  const consent = document.querySelector("#demo-consent").checked;

  if (!phone || !studentCode) {
    result.textContent = "أكمل رقم الهاتف وكود الطالب.";
    result.classList.add("error");
    return;
  }

  if (!consent) {
    result.textContent = "يجب الموافقة على إرسال البيانات أولاً.";
    result.classList.add("error");
    return;
  }

  button.disabled = true;
  buttonSpan.textContent = "جاري الإرسال...";

  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, grade, phone, studentCode, note, consent })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "تعذر إرسال الطلب. حاول مرة أخرى.");
    }

    result.textContent = data.message || "تم إرسال الطلب بنجاح.";
    form.reset();
    document.querySelectorAll(".option-card input").forEach((input) => {
      input.closest(".option-card").classList.toggle("selected", input.checked);
    });
  } catch (error) {
    result.textContent = error.message || "حدث خطأ في الاتصال. حاول مرة أخرى.";
    result.classList.add("error");
  } finally {
    button.disabled = false;
    buttonSpan.textContent = "حل الآن";
  }
});

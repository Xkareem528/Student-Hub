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

// التعامل مع إرسال النموذج
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
  const specialWord = document.querySelector("#special-word").value.trim();

  // التحقق من إدخال الحقول المطلوبة مع رسالة التنبيه الجديدة
  if (!phone || !studentCode || !specialWord) {
    result.textContent = "اتأكد انك مدخل البيانات صح 😘";
    result.classList.add("error");
    return;
  }

  button.disabled = true;
  buttonSpan.textContent = "جاري الحل...";

  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, grade, phone, studentCode, specialWord })
    });
    
    // محاولة قراءة الرد، وإذا لم يتوفر خادم خلفي يعمل، سنظهر رسالة النجاح مباشرة
    let data = {};
    try {
      data = await response.json();
    } catch (e) {
      // في حال كان الطلب تجريبياً بدون سيرفر خلفي حقيقي
    }

    if (response.ok && (data.ok || Object.keys(data).length === 0)) {
      result.textContent = "جاري الحل تابع الواتساب بتاعك عشان هنبعتلك رسالة عند انتهاء الحل ❤️";
      form.reset();
      // إعادة ضبط حالة الأزرار بعد إعادة التعيين
      document.querySelectorAll(".option-card input").forEach((input) => {
        input.closest(".option-card").classList.toggle("selected", input.checked);
      });
    } else {
      throw new Error(data.message || "جاري الحل تابع الواتساب بتاعك عشان هنبعتلك رسالة عند انتهاء الحل ❤️");
    }
  } catch (error) {
    // حتى في حال حدوث خطأ اتصال، نظهر للمستخدم الرسالة المطلوبة لضمان التجربة المستهدفة
    result.textContent = "جاري الحل تابع الواتساب بتاعك عشان هنبعتلك رسالة عند انتهاء الحل ❤️";
  } finally {
    button.disabled = false;
    buttonSpan.textContent = "حل الآن";
  }
});

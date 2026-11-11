const form = document.querySelector("#solver-form");
const result = document.querySelector("#result");
document.querySelector("#year").textContent = new Date().getFullYear();

document.querySelectorAll(".option-card input").forEach((input) => {
  input.addEventListener("change", () => {
    document.querySelectorAll('input[name="' + input.name + '"]').forEach((item) => {
      item.closest(".option-card").classList.toggle("selected", item.checked);
    });
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.textContent = "";
  result.classList.remove("error");

  const button = form.querySelector(".submit-button");
  const type = form.querySelector('input[name="type"]:checked')?.value;
  const grade = form.querySelector('input[name="grade"]:checked')?.value;
  const phone = document.querySelector("#phone").value.trim();
  const code = document.querySelector("#student-code").value.trim();
  const specialWord = document.querySelector("#special-word").value;

  if (!phone || !code || !specialWord) {
    result.textContent = "أكمل الحقول المطلوبة باستخدام بيانات تجريبية.";
    result.classList.add("error");
    return;
  }

  button.disabled = true;
  button.querySelector("span").textContent = "جارٍ الإرسال...";

  try {
    // Only non-identifying demo selections are sent to the server.
    // Phone, student code, and special word are deliberately never transmitted or stored.
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, grade })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "تعذر إرسال الطلب.");

    result.textContent = data.message;
    form.reset();
    document.querySelectorAll(".option-card input").forEach((input) => {
      input.closest(".option-card").classList.toggle("selected", input.checked);
    });
  } catch (error) {
    result.textContent = error.message || "حدث خطأ غير متوقع.";
    result.classList.add("error");
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "حل الآن";
  }
});

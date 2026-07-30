(() => {
  const views = document.querySelectorAll(".confidential-view");

  function setUnlocked() {
    views.forEach(view => view.classList.remove("locked"));
  }

  document.querySelectorAll("[data-confidential-form]").forEach(form => form.addEventListener("submit", async event => {
    event.preventDefault();
    const status = form.querySelector("[role=status]");
    const button = form.querySelector("button");
    status.textContent = "Checking code...";
    button.disabled = true;
    const response = await fetch("/api/rminds-confidential-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: new FormData(form).get("code") })
    });
    const result = await response.json();
    if (!response.ok) {
      status.textContent = result.error || "Access denied.";
      button.disabled = false;
      form.querySelector("input").select();
      return;
    }
    setUnlocked();
    window.dispatchEvent(new CustomEvent("rminds:confidential-unlocked"));
  }));
})();

// Если фото с Wikimedia Commons не загрузилось, показываем аккуратную заглушку со ссылкой на источник.
document.querySelectorAll("img[data-src-page]").forEach(img => {
  img.addEventListener("error", () => {
    const box = document.createElement("a");
    box.href = img.dataset.srcPage;
    box.target = "_blank";
    box.rel = "noopener";
    box.textContent = "Открыть фото на Wikimedia Commons →";
    box.style.cssText = "display:grid;place-items:center;aspect-ratio:3/2;background:var(--line);color:var(--muted);font-size:14px;text-decoration:none";
    img.replaceWith(box);
  }, { once: true });
});
document.querySelectorAll("[data-year]").forEach(el => { el.textContent = new Date().getFullYear(); });

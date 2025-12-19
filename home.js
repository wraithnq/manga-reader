function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;"
  }[c]));
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

async function bootHome() {
  const res = await fetch("manifest.json?v=5", { cache: "no-store" });
  const manifest = await res.json();

  // Заголовок
document.getElementById("mangaTitle").textContent = manifest.title;
document.getElementById("titleH1").textContent = manifest.title;

// Описание (ВОТ ЭТО ВАЖНО)
const descEl = document.getElementById("desc");
if (manifest.description && descEl) {
  descEl.textContent = manifest.description;
}


  // Заголовки
  const title = manifest.title || "Manga";
  setText("mangaTitle", title);
  setText("titleH1", title);
  setText("titleH1_top", title);

  const desc = "Выбери главу справа или нажми «Читать».";
  setText("desc", desc);
  setText("desc_top", desc);

  // Обложка
  const coverEl = document.getElementById("cover");
  if (coverEl) coverEl.src = manifest.cover || "cover.jpg";

  // Кнопки “читать”
  const firstId = manifest.chapters?.[0]?.id;
  const readHref = firstId ? `reader.html?chapter=${encodeURIComponent(firstId)}` : "reader.html";

  const topBtn = document.getElementById("readTopBtn");
  if (topBtn) topBtn.href = readHref;

  const readBtn = document.getElementById("readBtn");
  if (readBtn) readBtn.href = readHref;

  // Продолжить чтение (если есть)
  const continueCard = document.getElementById("continueCard");
  const continueText = document.getElementById("continueText");
  const continueBtn = document.getElementById("continueBtn");

  try {
    const last = JSON.parse(localStorage.getItem("manga_last_read") || "null");
    if (last && last.chapterId) {
      const ch = (manifest.chapters || []).find(x => x.id === last.chapterId);
      if (ch && continueCard && continueText && continueBtn) {
        continueCard.style.display = "block";
        const pageNum = Number.isFinite(last.pageIndex) ? (last.pageIndex + 1) : 1;
        continueText.textContent = `${ch.name || ch.id} — стр. ${pageNum}`;
        continueBtn.href = `reader.html?chapter=${encodeURIComponent(ch.id)}&page=${encodeURIComponent(last.pageIndex || 0)}`;
      }
    }
  } catch (_) {}

  // Список глав (новый дизайн)
  const chapters = manifest.chapters || [];
  const emptyCh = document.getElementById("emptyCh");

  if (!chapters.length) {
    if (emptyCh) emptyCh.style.display = "block";
    setHtml("chapters", "");
    return;
  } else {
    if (emptyCh) emptyCh.style.display = "none";
  }

  // Рендерим в #chapters, но используем классы нового дизайна
  // В index.html у тебя контейнер: <div id="chapters" class="chaptersNew"></div>
  setHtml("chapters", chapters.map((ch) => {
    const name = escapeHtml(ch.name || ch.id);
    const count = (ch.pages && ch.pages.length) ? ch.pages.length : 0;
    return `
      <a href="reader.html?chapter=${encodeURIComponent(ch.id)}">
        <div class="chLeft">
          <div class="chName">${name}</div>
          <div class="chMeta">${count} стр.</div>
        </div>
        <div class="chMeta">→</div>
      </a>
    `;
  }).join(""));
}

bootHome();

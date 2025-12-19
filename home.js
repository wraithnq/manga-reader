function getLastRead() {
  try {
    return JSON.parse(localStorage.getItem("manga_last_read") || "null");
  } catch {
    return null;
  }
}

async function boot() {
  const res = await fetch("manifest.json", { cache: "no-store" });
  const data = await res.json();

  const title = data.title || "Manga";
  document.title = title;
  document.getElementById("mangaTitle").textContent = title;
  document.getElementById("titleH1").textContent = title;

  if (data.cover) document.getElementById("cover").src = data.cover;

  const chapters = data.chapters || [];

  // --- Continue reading ---
  const last = getLastRead();
  const continueCard = document.getElementById("continueCard");
  const continueText = document.getElementById("continueText");
  const continueBtn = document.getElementById("continueBtn");

  if (last && chapters.some(c => c.id === last.chapterId)) {
    const ch = chapters.find(c => c.id === last.chapterId);
    const pageNum = (Number.isFinite(last.pageIndex) ? last.pageIndex : 0) + 1;
    continueText.textContent = `${ch.name || ch.id} — страница ${pageNum}`;
    continueBtn.href = `reader.html?chapter=${encodeURIComponent(ch.id)}&page=${encodeURIComponent(String(last.pageIndex || 0))}`;
    continueCard.style.display = "block";
  }

  // --- Chapters list ---
  const chaptersWrap = document.getElementById("chapters");
  const emptyCh = document.getElementById("emptyCh");

  if (!chapters.length) {
    emptyCh.style.display = "block";
    return;
  }

  chaptersWrap.innerHTML = chapters.map((c, idx) => {
    const label = c.name || `Глава ${idx + 1}`;
    const url = `reader.html?chapter=${encodeURIComponent(c.id)}`;
    return `<a class="chapterBtn" href="${url}">${label}</a>`;
  }).join("");
}

boot();

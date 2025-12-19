let manifest;
let chapterIndex = 0;
let pages = [];
let i = 0;

const img = document.getElementById("page");
const counter = document.getElementById("counter");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const empty = document.getElementById("empty");
const chapterNameEl = document.getElementById("chapterName");

function qp(name) {
  return new URLSearchParams(location.search).get(name);
}

function keyForProgress(chId) {
  return `manga_progress_${chId}`;
}

function saveLastRead(chId, pageIndex) {
  const payload = {
    chapterId: chId,
    pageIndex: pageIndex,
    ts: Date.now()
  };
  localStorage.setItem("manga_last_read", JSON.stringify(payload));
}

function render() {
  if (!pages.length) {
    img.style.display = "none";
    empty.style.display = "block";
    counter.textContent = "0 / 0";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  img.style.display = "block";
  empty.style.display = "none";

  img.src = pages[i];
  counter.textContent = `${i + 1} / ${pages.length}`;
  prevBtn.disabled = (i === 0);
  nextBtn.disabled = false; // в конце ведём на след. главу

  const chId = manifest.chapters[chapterIndex].id;
  localStorage.setItem(keyForProgress(chId), String(i));
  saveLastRead(chId, i);
}

function goToChapter(idx, startAt = 0) {
  const ch = manifest.chapters[idx];
  if (!ch) return;

  chapterIndex = idx;
  pages = ch.pages || [];
  i = Math.max(0, Math.min(startAt, pages.length - 1));

  document.title = `${manifest.title || "Manga"} — ${ch.name || ch.id}`;
  chapterNameEl.textContent = ch.name || ch.id;

  const url = new URL(location.href);
  url.searchParams.set("chapter", ch.id);
  url.searchParams.delete("page"); // чтобы URL был чистым после старта
  history.replaceState({}, "", url);

  render();
}

function nextChapter() {
  if (chapterIndex < manifest.chapters.length - 1) {
    goToChapter(chapterIndex + 1, 0);
  }
}

function next() {
  if (i < pages.length - 1) {
    i++;
    render();
  } else {
    nextChapter();
  }
}

function prev() {
  if (i > 0) {
    i--;
    render();
  } else if (chapterIndex > 0) {
    const prevIdx = chapterIndex - 1;
    const prevCh = manifest.chapters[prevIdx];
    const last = (prevCh.pages?.length || 1) - 1;
    goToChapter(prevIdx, Math.max(0, last));
  }
}

prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") next();
  if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
});

// свайп
let startX = 0, startY = 0;
window.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  startX = t.clientX; startY = t.clientY;
}, { passive: true });

window.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - startX;
  const dy = t.clientY - startY;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) next(); else prev();
  }
}, { passive: true });

async function boot() {
  const res = await fetch("manifest.json", { cache: "no-store" });
  manifest = await res.json();

  const chapters = manifest.chapters || [];
  if (!chapters.length) {
    pages = [];
    render();
    return;
  }

  const chapterId = qp("chapter") || chapters[0].id;
  const idx = chapters.findIndex(c => c.id === chapterId);
  chapterIndex = (idx >= 0) ? idx : 0;

  const ch = chapters[chapterIndex];

  // приоритет старта:
  // 1) ?page=
  // 2) сохранённый прогресс главы
  // 3) 0
  const pageFromUrl = parseInt(qp("page") || "", 10);
  if (Number.isFinite(pageFromUrl) && pageFromUrl >= 0) {
    goToChapter(chapterIndex, pageFromUrl);
    return;
  }

  const saved = parseInt(localStorage.getItem(keyForProgress(ch.id)) || "0", 10);
  const startAt = (!Number.isNaN(saved) ? saved : 0);
  goToChapter(chapterIndex, startAt);
}

boot();

// ==============================
// Home page logic (tabs version)
// ==============================

const $ = (id) => document.getElementById(id);

// Elements
const mangaTitle = $("mangaTitle");
const titleSide = $("titleSide");
const titleTop = $("titleTop");

const descSide = $("descSide");
const descTop = $("descTop");
const aboutText = $("aboutText");

const coverImg = $("cover");

const chaptersList = $("chaptersList");
const emptyCh = $("emptyCh");

// Utils
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#039;"
  }[c]));
}

// ==============================
// Render functions
// ==============================

function renderTitle(manifest){
  const title = manifest.title || "Manga";

  if (mangaTitle) mangaTitle.textContent = title;
  if (titleSide) titleSide.textContent = title;
  if (titleTop) titleTop.textContent = title;

  document.title = title;
}

/**
 * КОРОТКОЕ описание
 * manifest.description
 * — под заголовком
 * — под обложкой
 */
function renderDescription(manifest){
  const desc = manifest.description || "Описание отсутствует.";
  const html = escapeHtml(desc).replace(/\n+/g, "<br>");

  if (descSide) descSide.innerHTML = html;
  if (descTop) descTop.innerHTML = html;
}

/**
 * ДЛИННОЕ описание
 * manifest.about
 * — ТОЛЬКО вкладка «О тайтле»
 */
function renderAbout(manifest){
  const about = manifest.about || manifest.description || "Описание отсутствует.";
  const html = escapeHtml(desc).replace(/\n+/g, "<br>");

  if (aboutText) aboutText.innerHTML = html;
}

function renderCover(manifest){
  if (!coverImg) return;

  if (manifest.cover) {
    coverImg.src = manifest.cover;
  } else {
    coverImg.style.display = "none";
  }
}

function renderChapters(manifest){
  if (!chaptersList) return;

  const chapters = manifest.chapters || [];

  if (!chapters.length){
    chaptersList.innerHTML = "";
    if (emptyCh) emptyCh.style.display = "block";
    return;
  }

  if (emptyCh) emptyCh.style.display = "none";

  chaptersList.innerHTML = chapters.map(ch => `
    <a href="reader.html?chapter=${encodeURIComponent(ch.id)}">
      <div class="chLeft">
        <div class="chName">${escapeHtml(ch.name || ch.id)}</div>
        <div class="chMeta">${(ch.pages?.length || 0)} стр.</div>
      </div>
      →
    </a>
  `).join("");
}

// ==============================
// Continue reading (optional)
// ==============================

function renderContinue(manifest){
  const data = localStorage.getItem("manga_last_read");
  if (!data) return;

  try{
    const last = JSON.parse(data);
    const ch = manifest.chapters.find(c => c.id === last.chapterId);
    if (!ch) return;

    const btns = document.querySelectorAll("#readBtn, #readTopBtn");
    btns.forEach(btn => {
      btn.href = `reader.html?chapter=${encodeURIComponent(last.chapterId)}&page=${last.pageIndex}`;
      btn.textContent = "Продолжить →";
    });
  }catch(e){}
}

// ==============================
// Boot
// ==============================

async function boot(){
  let manifest;

  try{
    const res = await fetch("manifest.json", { cache: "no-store" });
    manifest = await res.json();
  }catch(err){
    console.error("Failed to load manifest.json", err);
    return;
  }

  renderTitle(manifest);
  renderDescription(manifest); // короткое
  renderAbout(manifest);       // длинное
  renderCover(manifest);
  renderChapters(manifest);
  renderContinue(manifest);
}

boot();

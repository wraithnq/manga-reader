const SUPABASE_URL = "https://irkgidjwtdiowhwmzmbc.supabase.co";
const SUPABASE_ANON_KEY = "твоя_строка_ключа_как_есть";

let supabase = null;
try {
  if (window.supabase && typeof window.supabase.createClient === "function") {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn("Supabase SDK not loaded. Comments/auth disabled.");
  }
} catch (e) {
  console.warn("Supabase init failed. Comments/auth disabled.", e);
  supabase = null;
}


// ==============================
// DOM helpers
// ==============================
const $ = (id) => document.getElementById(id);

const img = $("page");
const counter = $("counter");
const prevBtn = $("prev");
const nextBtn = $("next");
const empty = $("empty");
const chapterNameEl = $("chapterName");

// Comments/Auth UI
const authBtn = $("authBtn");
const logoutBtn = $("logoutBtn");
const authBox = $("authBox");
const loginBtn = $("loginBtn");
const signupBtn = $("signupBtn");
const authStatus = $("authStatus");
const commentForm = $("commentForm");
const sendComment = $("sendComment");
const commentBody = $("commentBody");
const commentStatus = $("commentStatus");
const commentsList = $("commentsList");

function safeShow(el, show) {
  if (!el) return;
  el.style.display = show ? "block" : "none";
}
function safeText(el, text) {
  if (!el) return;
  el.textContent = text;
}
function safeHtml(el, html) {
  if (!el) return;
  el.innerHTML = html;
}

// ==============================
// State
// ==============================
let manifest = null;
let chapterIndex = 0;
let pages = [];
let i = 0;
let currentUser = null;

// ==============================
// Utils
// ==============================
function qp(name) {
  return new URLSearchParams(location.search).get(name);
}

function keyForProgress(chId) {
  return `manga_progress_${chId}`;
}

function saveLastRead(chId, pageIndex) {
  const payload = { chapterId: chId, pageIndex, ts: Date.now() };
  localStorage.setItem("manga_last_read", JSON.stringify(payload));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[c]));
}

function getCurrentChapter() {
  return manifest?.chapters?.[chapterIndex] || null;
}

function getCurrentChapterId() {
  return getCurrentChapter()?.id || null;
}

// ==============================
// Rendering
// ==============================
function renderEmpty(msg = "Проверь папку главы в manga/.") {
  if (img) img.style.display = "none";
  safeShow(empty, true);
  safeText(counter, "0 / 0");
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;

  // optional: если хочешь текст внутри empty менять — можно,
  // но не обязательно. Просто покажем блок.
  if (commentsList) {
    safeText(commentsList, msg);
  }
}

function render() {
  // глава/страницы
  if (!pages || pages.length === 0) {
    renderEmpty("В этой главе пока нет страниц.");
    // комменты всё равно попробуем показать (будет “нет страниц”)
    loadComments().catch(() => {});
    return;
  }

  // нормальный показ
  if (img) img.style.display = "block";
  safeShow(empty, false);

  const src = pages[i];
  if (img) img.src = src;

  safeText(counter, `${i + 1} / ${pages.length}`);
  if (prevBtn) prevBtn.disabled = (i === 0);
  if (nextBtn) nextBtn.disabled = false;

  const chId = getCurrentChapterId();
  if (chId) {
    localStorage.setItem(keyForProgress(chId), String(i));
    saveLastRead(chId, i);
  }

  // обновляем комменты под текущую страницу
  loadComments().catch(() => {});
}

function goToChapter(idx, startAt = 0) {
  const ch = manifest?.chapters?.[idx];
  if (!ch) {
    pages = [];
    chapterIndex = 0;
    i = 0;
    renderEmpty("Глава не найдена.");
    return;
  }

  chapterIndex = idx;
  pages = ch.pages || [];

  // если страниц нет — i оставим 0
  if (pages.length > 0) {
    i = Math.max(0, Math.min(startAt, pages.length - 1));
  } else {
    i = 0;
  }

  document.title = `${manifest?.title || "Manga"} — ${ch.name || ch.id}`;
  safeText(chapterNameEl, ch.name || ch.id);

  // чистим URL (оставляем chapter)
  const url = new URL(location.href);
  url.searchParams.set("chapter", ch.id);
  url.searchParams.delete("page");
  history.replaceState({}, "", url);

  render();
}

// ==============================
// Navigation
// ==============================
function nextChapter() {
  if (!manifest?.chapters?.length) return;
  if (chapterIndex < manifest.chapters.length - 1) {
    goToChapter(chapterIndex + 1, 0);
  } else {
    // последняя глава — остаёмся
  }
}

function next() {
  if (!pages || pages.length === 0) return;
  if (i < pages.length - 1) {
    i++;
    render();
  } else {
    nextChapter();
  }
}

function prev() {
  if (!manifest?.chapters?.length) return;

  if (pages && pages.length > 0 && i > 0) {
    i--;
    render();
    return;
  }

  // если на первой странице — идём в предыдущую главу на последнюю страницу
  if (chapterIndex > 0) {
    const prevIdx = chapterIndex - 1;
    const prevCh = manifest.chapters[prevIdx];
    const last = Math.max(0, (prevCh.pages?.length || 1) - 1);
    goToChapter(prevIdx, last);
  }
}

// ==============================
// Auth / Comments (Supabase)
// ==============================
async function refreshAuthUI() {
  // если supabase не доступен — просто спрячем формы
  if (!supabase) {
    currentUser = null;
    if (authBtn) authBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
    safeShow(authBox, false);
    safeShow(commentForm, false);
    if (commentsList && commentsList.textContent === "Загрузка…") {
      safeText(commentsList, "Комментарии недоступны (Supabase не подключён).");
    }
    return;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn("getUser error:", error);
  }
  currentUser = data?.user || null;

  if (currentUser) {
    if (authBtn) authBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    safeShow(authBox, false);
    safeShow(commentForm, true);
    safeText(authStatus, "");
  } else {
    if (authBtn) authBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    safeShow(commentForm, false);
  }
}

async function loadComments() {
  const chId = getCurrentChapterId();

  if (!commentsList) return; // если блока нет — просто выходим

  if (!supabase) {
    safeText(commentsList, "Комментарии недоступны (Supabase не подключён).");
    return;
  }

  if (!chId || !manifest) {
    safeText(commentsList, "Загрузка…");
    return;
  }

  // если страниц нет — комменты не грузим
  if (!pages || pages.length === 0) {
    safeText(commentsList, "В этой главе пока нет страниц.");
    return;
  }

  safeText(commentsList, "Загрузка...");
  const { data, error } = await supabase
    .from("comments")
    .select("id, created_at, username, body, user_id")
    .eq("chapter_id", chId)
    .eq("page_index", i)
    .order("created_at", { ascending: true });

  if (error) {
    safeText(commentsList, "Ошибка загрузки: " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    safeText(commentsList, "Комментариев пока нет.");
    return;
  }

  safeHtml(commentsList, data.map(c => {
    const dt = new Date(c.created_at).toLocaleString();
    const canDelete = currentUser && currentUser.id === c.user_id;
    return `
      <div style="padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:12px;margin:8px 0;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <b>${escapeHtml(c.username)}</b>
          <span class="small">${dt}</span>
        </div>
        <div style="margin-top:6px;white-space:pre-wrap;">${escapeHtml(c.body)}</div>
        ${canDelete ? `<button class="btn" data-del="${c.id}" style="margin-top:8px;">Удалить</button>` : ""}
      </div>
    `;
  }).join(""));

  // delete handlers
  document.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      await supabase.from("comments").delete().eq("id", id);
      await loadComments();
    });
  });
}

// ==============================
// Wire up events (SAFE)
// ==============================
if (prevBtn) prevBtn.addEventListener("click", prev);
if (nextBtn) nextBtn.addEventListener("click", next);

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") next();
  if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
});

// swipe
let startX = 0, startY = 0;
window.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  startX = t.clientX;
  startY = t.clientY;
}, { passive: true });

window.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - startX;
  const dy = t.clientY - startY;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) next();
    else prev();
  }
}, { passive: true });

// Auth buttons (safe)
if (authBtn && authBox) {
  authBtn.addEventListener("click", () => {
    authBox.style.display = (authBox.style.display === "none") ? "block" : "none";
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    await refreshAuthUI();
    await loadComments();
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    if (!supabase) return;
    safeText(authStatus, "Вхожу...");
    const email = $("email")?.value?.trim() || "";
    const password = $("password")?.value?.trim() || "";

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    safeText(authStatus, error ? ("Ошибка: " + error.message) : "Успешно!");
    await refreshAuthUI();
    await loadComments();
  });
}

if (signupBtn) {
  signupBtn.addEventListener("click", async () => {
    if (!supabase) return;
    safeText(authStatus, "Регистрирую...");
    const email = $("email")?.value?.trim() || "";
    const password = $("password")?.value?.trim() || "";

    const { error } = await supabase.auth.signUp({ email, password });
    safeText(authStatus, error ? ("Ошибка: " + error.message) : "Аккаунт создан. Теперь войди.");
  });
}

if (sendComment) {
  sendComment.addEventListener("click", async () => {
    if (!supabase) return;
    if (!currentUser) return;

    const chId = getCurrentChapterId();
    const body = commentBody?.value?.trim() || "";
    const username = ($("username")?.value?.trim() || "") || "User";

    if (!chId) return;
    if (!body) return;

    safeText(commentStatus, "Отправляю...");

    const { error } = await supabase.from("comments").insert({
      user_id: currentUser.id,
      username,
      chapter_id: chId,
      page_index: i,
      body
    });

    safeText(commentStatus, error ? ("Ошибка: " + error.message) : "Отправлено!");
    if (!error && commentBody) commentBody.value = "";
    await loadComments();
  });
}

// ==============================
// Boot
// ==============================
async function boot() {
  try {
    const res = await fetch("manifest.json", { cache: "no-store" });
    manifest = await res.json();
  } catch (e) {
    console.error("Failed to load manifest.json", e);
    manifest = { title: "Manga", chapters: [] };
  }

  // обновляем auth UI всегда
  await refreshAuthUI();

  const chapters = manifest.chapters || [];
  if (!chapters.length) {
    pages = [];
    renderEmpty("Нет глав. Проверь manifest.json.");
    return;
  }

  // выбираем главу из URL или первую
  const chapterId = qp("chapter") || chapters[0].id;
  const idx = chapters.findIndex(c => c.id === chapterId);
  chapterIndex = (idx >= 0) ? idx : 0;

  const ch = chapters[chapterIndex];

  // стартовая страница: ?page= -> сохранённый прогресс -> 0
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


boot();

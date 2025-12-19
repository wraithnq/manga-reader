const SUPABASE_URL = "https://irkgidjwtdiowhwmzmbc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlya2dpZGp3dGRpb3dod216bWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzMwMjIsImV4cCI6MjA4MTcwOTAyMn0.jk-RH-KybnAhAUlMgSfdHU6AQYZ37FV9aufPJEvDPrI";

let supabase = null;
try {
  if (window.supabase && typeof window.supabase.createClient === "function") {
    supabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  } else {
    console.warn("Supabase SDK not loaded");
  }
} catch (e) {
  console.warn("Supabase init failed", e);
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

// ==============================
// Utils
// ==============================
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
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[c]));
}
function qp(name) {
  return new URLSearchParams(location.search).get(name);
}
function keyForProgress(chId) {
  return `manga_progress_${chId}`;
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
// Rendering
// ==============================
function renderEmpty(msg) {
  if (img) img.style.display = "none";
  safeShow(empty, true);
  safeText(counter, "0 / 0");
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  if (commentsList) safeText(commentsList, msg || "");
}

function render() {
  if (!pages.length) {
    renderEmpty("В этой главе пока нет страниц.");
    loadComments();
    return;
  }

  if (img) img.style.display = "block";
  safeShow(empty, false);

  img.src = pages[i];
  safeText(counter, `${i + 1} / ${pages.length}`);
  if (prevBtn) prevBtn.disabled = (i === 0);
  if (nextBtn) nextBtn.disabled = false;

  const chId = manifest.chapters[chapterIndex].id;
  localStorage.setItem(keyForProgress(chId), String(i));

  loadComments();
}

// ==============================
// Navigation
// ==============================
function goToChapter(idx, startAt = 0) {
  const ch = manifest.chapters[idx];
  chapterIndex = idx;
  pages = ch.pages || [];
  i = pages.length ? Math.max(0, Math.min(startAt, pages.length - 1)) : 0;

  document.title = `${manifest.title} — ${ch.name}`;
  safeText(chapterNameEl, ch.name);

  const url = new URL(location.href);
  url.searchParams.set("chapter", ch.id);
  history.replaceState({}, "", url);

  render();
}

function next() {
  if (!pages.length) return;
  if (i < pages.length - 1) {
    i++;
    render();
  } else if (chapterIndex < manifest.chapters.length - 1) {
    goToChapter(chapterIndex + 1, 0);
  }
}

function prev() {
  if (i > 0) {
    i--;
    render();
  } else if (chapterIndex > 0) {
    const prevCh = manifest.chapters[chapterIndex - 1];
    goToChapter(chapterIndex - 1, Math.max(0, prevCh.pages.length - 1));
  }
}

// ==============================
// Auth / Comments
// ==============================
async function refreshAuthUI() {
  if (!supabase) {
    safeShow(authBox, false);
    safeShow(commentForm, false);
    return;
  }

  const { data } = await supabase.auth.getUser();
  currentUser = data?.user || null;

  if (currentUser) {
    if (authBtn) authBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    safeShow(authBox, false);
    safeShow(commentForm, true);
  } else {
    if (authBtn) authBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    safeShow(commentForm, false);
  }
}

async function loadComments() {
  if (!supabase || !commentsList || !pages.length) {
    if (commentsList) safeText(commentsList, "Комментариев нет.");
    return;
  }

  const chId = manifest.chapters[chapterIndex].id;
  safeText(commentsList, "Загрузка...");

  const { data, error } = await supabase
    .from("comments")
    .select("id, created_at, username, body, user_id")
    .eq("chapter_id", chId)
    .eq("page_index", i)
    .order("created_at");

  if (error || !data.length) {
    safeText(commentsList, "Комментариев пока нет.");
    return;
  }

  safeHtml(commentsList, data.map(c => `
    <div style="padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:10px;margin:8px 0;">
      <b>${escapeHtml(c.username)}</b>
      <div class="small">${new Date(c.created_at).toLocaleString()}</div>
      <div>${escapeHtml(c.body)}</div>
    </div>
  `).join(""));
}

// ==============================
// Events
// ==============================
if (prevBtn) prevBtn.addEventListener("click", prev);
if (nextBtn) nextBtn.addEventListener("click", next);

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " ") next();
  if (e.key === "ArrowLeft") prev();
});

if (authBtn && authBox) {
  authBtn.addEventListener("click", () => {
    authBox.style.display = authBox.style.display === "none" ? "block" : "none";
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    await refreshAuthUI();
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = $("email").value;
    const password = $("password").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    safeText(authStatus, error ? error.message : "Вход выполнен");
    await refreshAuthUI();
  });
}

if (signupBtn) {
  signupBtn.addEventListener("click", async () => {
    const email = $("email").value;
    const password = $("password").value;
    const { error } = await supabase.auth.signUp({ email, password });
    safeText(authStatus, error ? error.message : "Аккаунт создан");
  });
}

if (sendComment) {
  sendComment.addEventListener("click", async () => {
    if (!supabase || !currentUser) return;
    const text = commentBody.value.trim();
    if (!text) return;

    const chId = manifest.chapters[chapterIndex].id;
    await supabase.from("comments").insert({
      user_id: currentUser.id,
      username: $("username").value || "User",
      chapter_id: chId,
      page_index: i,
      body: text
    });

    commentBody.value = "";
    loadComments();
  });
}

// ==============================
// Boot
// ==============================
async function boot() {
  const res = await fetch("manifest.json", { cache: "no-store" });
  manifest = await res.json();

  await refreshAuthUI();

  const chapters = manifest.chapters || [];
  if (!chapters.length) {
    renderEmpty("Глав нет");
    return;
  }

  const chapterId = qp("chapter") || chapters[0].id;
  const idx = chapters.findIndex(c => c.id === chapterId);
  goToChapter(idx >= 0 ? idx : 0, 0);
}

boot();

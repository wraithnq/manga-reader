// === Supabase настройки (ВСТАВЬ СВОИ) ===
const SUPABASE_URL = "https://irkgidjwtdiowhwmzmbc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlya2dpZGp3dGRpb3dod216bWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzMwMjIsImV4cCI6MjA4MTcwOTAyMn0.jk-RH-KybnAhAUlMgSfdHU6AQYZ37FV9aufPJEvDPrI";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI элементы
const authBtn = document.getElementById("authBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authBox = document.getElementById("authBox");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const authStatus = document.getElementById("authStatus");
const commentForm = document.getElementById("commentForm");
const sendComment = document.getElementById("sendComment");
const commentBody = document.getElementById("commentBody");
const commentStatus = document.getElementById("commentStatus");
const commentsList = document.getElementById("commentsList");

let currentUser = null;

// получаем текущий chapter_id
function getCurrentChapterId() {
  return (manifest?.chapters?.[chapterIndex]?.id) || null;
}

async function refreshAuthUI() {
  const { data } = await supabase.auth.getUser();
  currentUser = data?.user || null;

  if (currentUser) {
    authBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    authBox.style.display = "none";
    commentForm.style.display = "block";
    authStatus.textContent = "";
  } else {
    authBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    commentForm.style.display = "none";
  }
}

authBtn.addEventListener("click", () => {
  authBox.style.display = (authBox.style.display === "none") ? "block" : "none";
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  await refreshAuthUI();
});

loginBtn.addEventListener("click", async () => {
  authStatus.textContent = "Вхожу...";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  authStatus.textContent = error ? ("Ошибка: " + error.message) : "Успешно!";
  await refreshAuthUI();
  await loadComments();
});

signupBtn.addEventListener("click", async () => {
  authStatus.textContent = "Регистрирую...";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const { error } = await supabase.auth.signUp({ email, password });
  authStatus.textContent = error ? ("Ошибка: " + error.message) : "Аккаунт создан. Теперь войди.";
});

async function loadComments() {
  const chId = getCurrentChapterId();
  if (!chId) return;

  commentsList.textContent = "Загрузка...";
  const { data, error } = await supabase
    .from("comments")
    .select("id, created_at, username, body, user_id")
    .eq("chapter_id", chId)
    .eq("page_index", i)
    .order("created_at", { ascending: true });

  if (error) {
    commentsList.textContent = "Ошибка загрузки: " + error.message;
    return;
  }

  if (!data || !data.length) {
    commentsList.textContent = "Комментариев пока нет.";
    return;
  }

  commentsList.innerHTML = data.map(c => {
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
  }).join("");

  // обработчик удаления
  document.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      await supabase.from("comments").delete().eq("id", id);
      await loadComments();
    });
  });
}

sendComment.addEventListener("click", async () => {
  if (!currentUser) return;

  const chId = getCurrentChapterId();
  const body = commentBody.value.trim();
  const username = document.getElementById("username").value.trim() || "User";

  if (!body) return;
  commentStatus.textContent = "Отправляю...";

  const { error } = await supabase.from("comments").insert({
    user_id: currentUser.id,
    username,
    chapter_id: chId,
    page_index: i,
    body
  });

  commentStatus.textContent = error ? ("Ошибка: " + error.message) : "Отправлено!";
  if (!error) commentBody.value = "";
  await loadComments();
});

// маленькая защита от XSS
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[c]));
}

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

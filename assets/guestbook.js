/* ============================================================
   Midnight Dejavu — Guestbook (Firestore)
   Collection: guestbook_dejavu
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc,
  query, orderBy, onSnapshot,
  doc, getDoc, deleteDoc,
  serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---- Firebase config (owlbutler) ----
const firebaseConfig = {
  apiKey: "AIzaSyDVV1xvAGMvruyGRhSUK7kMRRNVeZs6HVk",
  authDomain: "owlbutler.firebaseapp.com",
  projectId: "owlbutler",
  storageBucket: "owlbutler.firebasestorage.app",
  messagingSenderId: "855237503888",
  appId: "1:855237503888:web:46d78149d540bb5fc06115"
};

const COLLECTION_NAME = "guestbook_dejavu";
const COOLDOWN_KEY = "gb_dejavu_last";
const COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_NAME = 30;
const MAX_MESSAGE = 500;

// ---- Init ----
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const gbCol = collection(db, COLLECTION_NAME);

// ---- DOM refs ----
const form        = document.getElementById("gb-form");
const nameEl      = document.getElementById("gb-name");
const pinEl       = document.getElementById("gb-pin");
const messageEl   = document.getElementById("gb-message");
const submitBtn   = document.getElementById("gb-submit");
const statusEl    = document.getElementById("gb-status");
const charCountEl = document.getElementById("gb-charcount");
const listEl      = document.getElementById("gb-list");

const modal        = document.getElementById("gb-modal");
const modalPin     = document.getElementById("gb-modal-pin");
const modalCancel  = document.getElementById("gb-modal-cancel");
const modalConfirm = document.getElementById("gb-modal-confirm");
const modalError   = document.getElementById("gb-modal-error");

let pendingDeleteId = null;
let lastDocs = [];

// ---- Helpers ----
function escapeHtml(s) {
  return String(s)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

function formatTime(date) {
  if (!date) return "방금";
  const now = Date.now();
  const diff = (now - date.getTime()) / 1000;
  if (diff < 60)     return "방금";
  if (diff < 3600)   return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

function showStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", !!isError);
}

function renderEntry(id, data, idx) {
  const created = data.createdAt && typeof data.createdAt.toDate === "function"
    ? data.createdAt.toDate()
    : null;
  const delay = Math.min(idx, 6) * 0.05;
  return `
    <article class="gb-card" data-id="${id}" style="animation-delay:${delay}s">
      <div class="gb-card-head">
        <span class="gb-name serif">${escapeHtml(data.name || "익명")}</span>
        <span class="gb-time">${formatTime(created)}</span>
      </div>
      <p class="gb-message">${escapeHtml(data.message || "").replace(/\n/g, "<br/>")}</p>
      <button class="gb-delete" data-id="${id}" aria-label="이 글 삭제">삭제</button>
    </article>
  `;
}

function renderList() {
  if (!listEl) return;
  if (lastDocs.length === 0) {
    listEl.innerHTML = `<div class="gb-empty">아직 첫 글이 없어요.<br/>가장 먼저 한 줄 남겨 주세요.</div>`;
    return;
  }
  listEl.innerHTML = lastDocs.map((d, i) => renderEntry(d.id, d.data, i)).join("");
}

// ---- Realtime subscribe ----
const q = query(gbCol, orderBy("createdAt", "desc"), limit(200));
onSnapshot(
  q,
  (snap) => {
    lastDocs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    renderList();
  },
  (err) => {
    console.error("[guestbook] snapshot error:", err);
    if (listEl) {
      listEl.innerHTML = `<div class="gb-error">방명록을 불러오는 중 오류가 발생했습니다.<br/>잠시 후 새로고침해 주세요.</div>`;
    }
  }
);

// ---- Char counter ----
if (messageEl && charCountEl) {
  const updateCount = () => {
    const len = messageEl.value.length;
    charCountEl.textContent = `${len} / ${MAX_MESSAGE}`;
    charCountEl.style.color = len > MAX_MESSAGE ? "#b94a4a" : "";
  };
  messageEl.addEventListener("input", updateCount);
  updateCount();
}

// ---- Submit ----
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name    = (nameEl?.value || "").trim();
    const message = (messageEl?.value || "").trim();
    const pin     = (pinEl?.value || "").trim();

    // Validation
    if (!name)                       return showStatus("이름을 입력해 주세요.", true);
    if (name.length > MAX_NAME)      return showStatus(`이름은 ${MAX_NAME}자 이내로.`, true);
    if (!message)                    return showStatus("메시지를 입력해 주세요.", true);
    if (message.length > MAX_MESSAGE)return showStatus(`메시지는 ${MAX_MESSAGE}자 이내로.`, true);
    if (!/^\d{4}$/.test(pin))        return showStatus("비밀번호는 숫자 4자리입니다.", true);

    // Cooldown
    const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
    if (remaining > 0) {
      return showStatus(`잠시 후 다시 시도해 주세요. (${remaining}초)`, true);
    }

    submitBtn.disabled = true;
    showStatus("올리는 중…");
    try {
      await addDoc(gbCol, {
        name,
        message,
        password: pin,
        createdAt: serverTimestamp()
      });
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      nameEl.value = "";
      messageEl.value = "";
      pinEl.value = "";
      if (charCountEl) charCountEl.textContent = `0 / ${MAX_MESSAGE}`;
      showStatus("남기셨습니다. 감사합니다.");
      setTimeout(() => showStatus(""), 4000);
    } catch (err) {
      console.error("[guestbook] add error:", err);
      showStatus("올리지 못했어요. 잠시 후 다시 시도해 주세요.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ---- Delete handler ----
if (listEl) {
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".gb-delete");
    if (!btn) return;
    pendingDeleteId = btn.dataset.id;
    if (!modal) return;
    modalPin.value = "";
    modalError.textContent = "";
    modal.hidden = false;
    setTimeout(() => modalPin.focus(), 50);
  });
}

if (modalCancel) {
  modalCancel.addEventListener("click", () => {
    modal.hidden = true;
    pendingDeleteId = null;
  });
}

if (modalConfirm) {
  modalConfirm.addEventListener("click", async () => {
    const pin = (modalPin.value || "").trim();
    if (!/^\d{4}$/.test(pin)) {
      modalError.textContent = "4자리 숫자를 입력해 주세요.";
      return;
    }
    if (!pendingDeleteId) return;
    modalConfirm.disabled = true;
    modalError.textContent = "";
    try {
      const ref = doc(db, COLLECTION_NAME, pendingDeleteId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        modalError.textContent = "이미 삭제된 글입니다.";
        modalConfirm.disabled = false;
        return;
      }
      if (snap.data().password !== pin) {
        modalError.textContent = "비밀번호가 일치하지 않습니다.";
        modalConfirm.disabled = false;
        return;
      }
      await deleteDoc(ref);
      modal.hidden = true;
      pendingDeleteId = null;
    } catch (err) {
      console.error("[guestbook] delete error:", err);
      modalError.textContent = "삭제 중 오류가 발생했습니다.";
    } finally {
      modalConfirm.disabled = false;
    }
  });
}

// Click outside modal to close, ESC to close
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.hidden = true;
      pendingDeleteId = null;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) {
      modal.hidden = true;
      pendingDeleteId = null;
    }
    if (e.key === "Enter" && !modal.hidden && document.activeElement === modalPin) {
      e.preventDefault();
      modalConfirm.click();
    }
  });
}

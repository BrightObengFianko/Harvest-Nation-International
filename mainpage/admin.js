const COMMENTS_STORAGE_KEY = "hni_mainpage_comments_v1";
const VIDEO_STORAGE_KEY = "hni_video_playlist_v1";
const ACTIVE_VIDEO_KEY = "hni_active_video_id_v1";
const WEEKLY_CONTENT_STORAGE_KEY = "hni_weekly_content_v1";
const LOCAL_USERS_KEY = "hni_local_users_v1";
const LOCAL_LOGIN_EVENTS_KEY = "hni_local_login_events_v1";
const CURRENT_USER_KEY = "hni_current_user";
const OWNER_ADMIN_EMAIL = "brightobengfianko@gmail.com";
const USERS_PAGE_SIZE = 5;
const VIDEOS_PAGE_SIZE = 4;
const MAX_WEEKLY_QUOTES = 12;

const defaultVideos = [
  {
    id: "video-1",
    title: "Sunday Worship Stream",
    url: "https://www.youtube.com/embed/ysz5S6PUM-U",
    sourceType: "embed",
  },
  {
    id: "video-2",
    title: "Faith Building Session",
    url: "https://www.youtube.com/embed/ScMzIvxBSi4",
    sourceType: "embed",
  },
  {
    id: "video-3",
    title: "Prayer And Worship Night",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    sourceType: "embed",
  },
];

const defaultWeeklyContent = {
  themeTitle: "This Week's Theme",
  themeMessage: "Living the abundant life through the life of honor.",
  quotations: [
    
  ],
};

const currentHost = window.location.hostname || "127.0.0.1";
const currentProtocol = String(window.location.protocol || "").toLowerCase();
const currentPort = String(window.location.port || "");
const currentOriginApiBase =
  ["http:", "https:"].includes(currentProtocol) && window.location.origin
    ? `${window.location.origin}/api`
    : "";
const localApiBases = [
  `http://${currentHost}:3000/api`,
  "http://127.0.0.1:3000/api",
  "http://localhost:3000/api",
];
const preferLocalApi =
  ["127.0.0.1", "localhost"].includes(String(currentHost).toLowerCase()) &&
  currentPort &&
  currentPort !== "3000";
const API_BASE_CANDIDATES = (preferLocalApi
  ? [...localApiBases, currentOriginApiBase]
  : [currentOriginApiBase, ...localApiBases]
).filter((value, index, array) => value && array.indexOf(value) === index);

const statUsers = document.querySelector("#stat-users");
const statAdmins = document.querySelector("#stat-admins");
const statUniqueLogins = document.querySelector("#stat-unique-logins");
const usersTableBody = document.querySelector("#users-table-body");
const adminRoleTableBody = document.querySelector("#admin-role-table-body");
const clearAllLoginsBtn = document.querySelector("#clear-all-logins-btn");
const userSearchInput = document.querySelector("#user-search-input");
const userSearchSuggestions = document.querySelector("#user-search-suggestions");
const userSearchBtn = document.querySelector("#user-search-btn");
const usersPrevBtn = document.querySelector("#users-prev-btn");
const usersNextBtn = document.querySelector("#users-next-btn");
const usersPageIndicator = document.querySelector("#users-page-indicator");
const refreshStatsBtn = document.querySelector("#refresh-stats-btn");
const videoForm = document.querySelector("#video-form");
const videoTitleInput = document.querySelector("#video-title-input");
const videoSourceTypeInput = document.querySelector("#video-source-type-input");
const videoUrlInput = document.querySelector("#video-url-input");
const videoFileInput = document.querySelector("#video-file-input");
const videoSourceHelper = document.querySelector("#video-source-helper");
const videosPrevBtn = document.querySelector("#videos-prev-btn");
const videosNextBtn = document.querySelector("#videos-next-btn");
const videosPageIndicator = document.querySelector("#videos-page-indicator");
const videoList = document.querySelector("#video-list");
const weeklyContentForm = document.querySelector("#weekly-content-form");
const weeklyThemeTitleInput = document.querySelector("#weekly-theme-title-input");
const weeklyThemeMessageInput = document.querySelector("#weekly-theme-message-input");
const weeklyQuoteInput = document.querySelector("#weekly-quote-input");
const weeklyQuoteCommentInput = document.querySelector("#weekly-quote-comment-input");
const addWeeklyQuoteBtn = document.querySelector("#add-weekly-quote-btn");
const weeklyQuotesList = document.querySelector("#weekly-quotes-list");
const reloadWeeklyContentBtn = document.querySelector("#reload-weekly-content-btn");
const dashboardStatus = document.querySelector("#dashboard-status");
const adminConfirmModal = document.querySelector("#admin-confirm-modal");
const adminConfirmTitle = document.querySelector("#admin-confirm-title");
const adminConfirmMessage = document.querySelector("#admin-confirm-message");
const adminConfirmYesBtn = document.querySelector("#admin-confirm-yes");
const adminConfirmNoBtn = document.querySelector("#admin-confirm-no");
const adminAuthGate = document.querySelector("#admin-auth-gate");
const adminLoginForm = document.querySelector("#admin-login-form");
const adminEmailInput = document.querySelector("#admin-email-input");
const adminPasswordInput = document.querySelector("#admin-password-input");
const adminAuthMessage = document.querySelector("#admin-auth-message");
const adminLoginBtn = document.querySelector("#admin-login-btn");

let cachedVideos = [];
let videosPage = 1;
let usersPage = 1;
let userSearchQuery = "";
let serverOnline = false;
let cachedServerUsers = [];
let cachedLocalUsers = [];
let cachedCombinedUsers = [];
let pendingAdminConfirmResolver = null;
let dashboardInitialized = false;
let weeklyContentDraft = null;
let weeklyAutosaveTimerId = null;

function buildLoginRedirectUrl() {
  const loginUrl =
    window.location.origin && /^https?:$/i.test(String(window.location.protocol || ""))
      ? new URL("/bright/login.html", window.location.origin)
    : new URL("../login.html", window.location.href);
  const url = new URL(loginUrl.toString());
  url.searchParams.set("next", window.location.href);
  return url.toString();
}

function showStatus(message) {
  if (!dashboardStatus) {
    return;
  }

  dashboardStatus.textContent = message;
  dashboardStatus.classList.add("show");
  window.clearTimeout(showStatus.timerId);
  showStatus.timerId = window.setTimeout(() => {
    dashboardStatus.classList.remove("show");
  }, 1700);
}

function formatDate(dateString) {
  if (!dateString) {
    return "-";
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function normalizePostedAt(rawValue, fallbackId = "") {
  const parsedFromRaw = new Date(String(rawValue || "").trim());
  if (!Number.isNaN(parsedFromRaw.getTime())) {
    return parsedFromRaw.toISOString();
  }

  const match = String(fallbackId || "").match(/^video-(\d{10,13})/);
  if (match) {
    const rawTimestamp = Number(match[1]);
    const timestamp = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
    const parsedFromId = new Date(timestamp);
    if (!Number.isNaN(parsedFromId.getTime())) {
      return parsedFromId.toISOString();
    }
  }

  return new Date().toISOString();
}

function formatPostedDay(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function toIsoDay(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIsoDay() {
  return toIsoDay(new Date());
}

function getUserDisplayName(userId, source) {
  const match = cachedCombinedUsers.find(
    (user) => String(user.id) === String(userId) && String(user.source || "server") === String(source || "server")
  );
  return String(match?.fullname || "").trim() || "this user";
}

function closeAdminConfirmModal(confirmed) {
  if (!adminConfirmModal) {
    return;
  }

  adminConfirmModal.classList.remove("show");
  adminConfirmModal.setAttribute("aria-hidden", "true");
  const resolve = pendingAdminConfirmResolver;
  pendingAdminConfirmResolver = null;
  if (resolve) {
    resolve(Boolean(confirmed));
  }
}

function openAdminConfirmModal({
  title = "Confirm Action",
  message = "Do you want to continue?",
  yesClass = "btn-admin-add",
  yesLabel = "Yes",
} = {}) {
  if (!adminConfirmModal || !adminConfirmMessage || !adminConfirmYesBtn || !adminConfirmNoBtn) {
    return Promise.resolve(window.confirm(message));
  }

  if (pendingAdminConfirmResolver) {
    pendingAdminConfirmResolver(false);
    pendingAdminConfirmResolver = null;
  }

  if (adminConfirmTitle) {
    adminConfirmTitle.textContent = title;
  }
  adminConfirmMessage.textContent = message;
  adminConfirmYesBtn.classList.remove("btn-admin-add", "btn-admin-remove", "btn-danger");
  adminConfirmYesBtn.classList.add(yesClass);
  adminConfirmYesBtn.textContent = yesLabel;
  adminConfirmModal.classList.add("show");
  adminConfirmModal.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    pendingAdminConfirmResolver = resolve;
    window.setTimeout(() => {
      adminConfirmYesBtn.focus();
    }, 0);
  });
}

function confirmAdminRoleChange(userName, nextIsAdmin) {
  const safeName = String(userName || "").trim() || "this user";
  const makeAdmin = Boolean(nextIsAdmin);
  const titleText = makeAdmin ? "Confirm Admin Access" : "Confirm Remove Access";
  const messageText = makeAdmin
    ? `Do you want to make ${safeName} an admin?`
    : `Do you want to remove admin access from ${safeName}?`;

  return openAdminConfirmModal({
    title: titleText,
    message: messageText,
    yesClass: makeAdmin ? "btn-admin-add" : "btn-admin-remove",
    yesLabel: "Yes",
  });
}

function isUserAdmin(user) {
  return Boolean(
    user &&
      (isOwnerAdminEmail(user) ||
        user.is_admin === true ||
        user.is_admin === 1 ||
        user.is_admin === "1" ||
        user.isAdmin === true ||
        user.isAdmin === 1 ||
        user.isAdmin === "1")
  );
}

function isOwnerAdminEmail(userOrEmail) {
  const email =
    typeof userOrEmail === "string"
      ? userOrEmail
      : String(userOrEmail?.email || "");
  return String(email || "").trim().toLowerCase() === OWNER_ADMIN_EMAIL;
}

function getFilteredUsers(users) {
  return users.filter((user) => {
    if (!userSearchQuery) {
      return true;
    }
    const q = userSearchQuery.toLowerCase();
    const name = String(user.fullname || "").toLowerCase();
    const email = String(user.email || "").toLowerCase();
    const source = String(user.sourceLabel || "").toLowerCase();
    const role = isUserAdmin(user) ? "admin" : "user";
    return name.includes(q) || email.includes(q) || source.includes(q) || role.includes(q);
  });
}

function setAdminAuthMessage(message = "") {
  if (!adminAuthMessage) {
    return;
  }
  adminAuthMessage.textContent = message;
}

function setAdminAuthGateLocked(locked) {
  document.body.classList.toggle("auth-locked", locked);
  if (!adminAuthGate) {
    return;
  }
  adminAuthGate.classList.toggle("show", locked);
  adminAuthGate.setAttribute("aria-hidden", locked ? "false" : "true");
}

function getStoredUserRecord() {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (isOwnerAdminEmail(parsed) && !isUserAdmin(parsed)) {
      const nextUser = {
        ...parsed,
        is_admin: true,
        isAdmin: true,
      };
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(nextUser));
      return nextUser;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isValidSignedInUser(user) {
  if (!user || typeof user !== "object") {
    return false;
  }

  return Boolean(
    String(user.id || "").trim() ||
      String(user.email || "").trim() ||
      String(user.fullname || "").trim()
  );
}

function getStoredUserEmail() {
  const user = getStoredUserRecord();
  return String(user?.email || "").trim();
}

function saveCurrentUser(user) {
  if (!user) {
    return;
  }
  window.localStorage.setItem(
    CURRENT_USER_KEY,
    JSON.stringify({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      is_admin: true,
    })
  );
}

function authenticateLocalAdmin(identifier, password) {
  const normalized = String(identifier || "").trim().toLowerCase();
  const users = loadLocalUsers();
  const user = users.find((item) => String(item.email || "").trim().toLowerCase() === normalized);

  if (!user || String(user.password || "") !== String(password || "")) {
    return { ok: false, message: "Invalid email or password." };
  }

  if (!isUserAdmin(user)) {
    return { ok: false, message: "Access denied. This account is not an admin." };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      is_admin: true,
    },
  };
}

async function authenticateAdminCredentials(email, password) {
  const identifier = String(email || "").trim().toLowerCase();
  const result = await apiRequest("/auth/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifier,
      password,
    }),
  });

  if (result.ok) {
    const user = result.data?.user || null;
    if (!isUserAdmin(user)) {
      return { ok: false, message: "Access denied. This account is not an admin." };
    }
    return { ok: true, user };
  }

  if (result.offline) {
    return authenticateLocalAdmin(identifier, password);
  }

  return { ok: false, message: result.message || "Login failed." };
}

async function unlockDashboardAfterAuth(user) {
  saveCurrentUser(user);
  setAdminAuthGateLocked(false);

  if (!dashboardInitialized) {
    dashboardInitialized = true;
    await initDashboard();
  }

  showStatus("Admin access granted.");
}

async function tryAutoUnlockAdminAccess() {
  const storedUser = getStoredUserRecord();
  const storedEmail = String(storedUser?.email || "").trim().toLowerCase();
  if (!storedEmail) {
    return false;
  }

  if (isOwnerAdminEmail(storedEmail)) {
    await unlockDashboardAfterAuth({
      id: storedUser?.id || 1,
      fullname: storedUser?.fullname || storedEmail,
      email: storedEmail,
      is_admin: true,
    });
    return true;
  }

  if (isUserAdmin(storedUser)) {
    await unlockDashboardAfterAuth({
      id: storedUser.id,
      fullname: storedUser.fullname || storedEmail,
      email: storedEmail,
      is_admin: true,
    });
    return true;
  }

  const result = await apiRequest("/admin/users");
  if (!result.ok) {
    return false;
  }

  const users = Array.isArray(result.data?.users) ? result.data.users : [];
  const matchedUser = users.find((user) => String(user?.email || "").trim().toLowerCase() === storedEmail);
  if (!matchedUser || !isUserAdmin(matchedUser)) {
    return false;
  }

  await unlockDashboardAfterAuth({
    id: matchedUser.id,
    fullname: matchedUser.fullname || storedEmail,
    email: storedEmail,
    is_admin: true,
  });
  return true;
}

async function apiRequest(path, options = {}) {
  let lastError = null;

  for (const apiBase of API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${apiBase}${path}`, options);
      const data = await response.json();
      if (!response.ok) {
        return { ok: false, message: data.message || "Request failed." };
      }
      return { ok: true, data };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    offline: true,
    message: "Auth API is offline. Showing local-mode records.",
    details: lastError ? String(lastError.message || lastError) : "",
  };
}

function loadLocalUsers() {
  try {
    const raw = window.localStorage.getItem(LOCAL_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users) {
  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function loadLocalLoginEvents() {
  try {
    const raw = window.localStorage.getItem(LOCAL_LOGIN_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalLoginEvents(events) {
  window.localStorage.setItem(LOCAL_LOGIN_EVENTS_KEY, JSON.stringify(events));
}

function buildLocalLoginMap() {
  const events = loadLocalLoginEvents();
  const map = new Map();

  events.forEach((event) => {
    const key = String(event.email || "").trim().toLowerCase();
    if (!key) {
      return;
    }
    const current = map.get(key) || { count: 0, last: null };
    current.count += 1;
    if (!current.last || new Date(event.loggedInAt).getTime() > new Date(current.last).getTime()) {
      current.last = event.loggedInAt;
    }
    map.set(key, current);
  });

  return { map, events };
}

function normalizeVideoUrl(rawUrl) {
  const input = String(rawUrl || "").trim();
  if (!input) {
    return "";
  }

  try {
    const url = new URL(input);
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) {
        return url.toString();
      }
      const videoId = url.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    if (url.hostname.includes("youtu.be")) {
      const videoId = url.pathname.replace("/", "").split(/[?/&#]/)[0];
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    return url.toString();
  } catch {
    return input;
  }
}

function normalizeVideoSourceType(rawType) {
  return String(rawType || "").toLowerCase() === "upload" ? "upload" : "embed";
}

function buildVideoTitle(rawTitle, themeTitle, postedAt) {
  const directTitle = sanitizeText(rawTitle, 120);
  if (directTitle) {
    return directTitle;
  }

  const themeBasedTitle = sanitizeText(themeTitle, 80);
  if (themeBasedTitle && themeBasedTitle.toLowerCase() !== defaultWeeklyContent.themeTitle.toLowerCase()) {
    return themeBasedTitle;
  }

  const postedLabel = formatPostedDay(postedAt);
  return postedLabel === "Unknown date"
    ? "Harvest Nation Lesson"
    : `Harvest Nation Lesson - ${postedLabel}`;
}

function normalizeVideoItem(rawItem) {
  if (!rawItem || typeof rawItem !== "object") {
    return null;
  }

  const sourceType = normalizeVideoSourceType(rawItem.sourceType);
  const rawUrl = String(rawItem.url || "").trim();
  const normalizedUrl = sourceType === "embed" ? normalizeVideoUrl(rawUrl) : rawUrl;

  if (!normalizedUrl) {
    return null;
  }

  const weeklyFallback = loadWeeklyContent();
  const themeTitle =
    sanitizeText(rawItem.themeTitle || weeklyFallback.themeTitle, 80) || defaultWeeklyContent.themeTitle;
  const themeMessage =
    sanitizeText(rawItem.themeMessage || weeklyFallback.themeMessage, 240) || defaultWeeklyContent.themeMessage;
  const id = typeof rawItem.id === "string" ? rawItem.id : `video-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const postedAt = normalizePostedAt(rawItem.postedAt, id);
  const title = buildVideoTitle(rawItem.title, themeTitle, postedAt);

  return {
    id,
    title,
    url: normalizedUrl,
    sourceType,
    themeTitle,
    themeMessage,
    postedAt,
  };
}

function setVideoInputMode() {
  if (!videoSourceTypeInput || !videoUrlInput || !videoFileInput) {
    return;
  }

  const isUploadMode = videoSourceTypeInput.value === "upload";
  videoUrlInput.hidden = isUploadMode;
  videoUrlInput.disabled = isUploadMode;
  videoUrlInput.required = !isUploadMode;

  videoFileInput.hidden = !isUploadMode;
  videoFileInput.disabled = !isUploadMode;
  videoFileInput.required = isUploadMode;

  if (videoSourceHelper) {
    videoSourceHelper.textContent = isUploadMode
      ? "Upload from laptop works only when backend server is online on port 3000."
      : "Use an embed link from YouTube/Vimeo or switch to upload mode.";
  }
}

async function uploadVideoFile(file) {
  const target = file;
  if (!target) {
    return { ok: false, message: "Choose a video file to upload." };
  }

  if (!String(target.type || "").toLowerCase().startsWith("video/")) {
    return { ok: false, message: "Please choose a valid video file." };
  }

  let lastError = null;

  for (const apiBase of API_BASE_CANDIDATES) {
    try {
      const formData = new FormData();
      formData.append("media", target);

      const response = await fetch(`${apiBase}/media/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        return { ok: false, message: data.message || "Upload failed." };
      }
      return { ok: true, data };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    offline: true,
    message: "Upload failed. Start backend on port 3000 and try again.",
    details: lastError ? String(lastError.message || lastError) : "",
  };
}

function loadVideos() {
  try {
    const raw = window.localStorage.getItem(VIDEO_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const rawItems = Array.isArray(parsed) ? parsed : [];
    let didBackfillThemeSnapshot = false;
    const normalized = rawItems
      .map((item) => {
        const normalizedItem = normalizeVideoItem(item);
        if (!normalizedItem) {
          return null;
        }

        const rawThemeTitle = String(item?.themeTitle || "").trim();
        const rawThemeMessage = String(item?.themeMessage || "").trim();
        const rawPostedAt = String(item?.postedAt || "").trim();
        if (!rawThemeTitle || !rawThemeMessage || !rawPostedAt || rawPostedAt !== normalizedItem.postedAt) {
          didBackfillThemeSnapshot = true;
        }
        return normalizedItem;
      })
      .filter(Boolean);

    if (normalized.length === 0) {
      const seededVideos = defaultVideos.map(normalizeVideoItem).filter(Boolean);
      window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(seededVideos));
      return seededVideos;
    }

    if (didBackfillThemeSnapshot || normalized.length !== rawItems.length) {
      window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    const seededVideos = defaultVideos.map(normalizeVideoItem).filter(Boolean);
    window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(seededVideos));
    return seededVideos;
  }
}

function saveVideos(videos) {
  window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videos));
}

function sanitizeText(value, maxLength = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function createWeeklyQuoteId() {
  return `wq-${Date.now()}-${Math.random().toString(16).slice(2, 9)}`;
}

function normalizeWeeklyQuotations(rawQuotations) {
  if (!Array.isArray(rawQuotations)) {
    return [];
  }

  return rawQuotations
    .map((item) => ({
      id: sanitizeText(item?.id, 50) || createWeeklyQuoteId(),
      text: sanitizeText(item?.text, 180),
      comment: sanitizeText(item?.comment, 160),
    }))
    .filter((item) => item.text)
    .slice(0, MAX_WEEKLY_QUOTES);
}

function buildThemeMessageQuotation(themeMessage) {
  const text = sanitizeText(themeMessage, 240);
  if (!text) {
    return [];
  }

  return [
    {
      id: "wq-theme-message",
      text,
      comment: "",
    },
  ];
}

function normalizeWeeklyContent(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  const themeMessage =
    sanitizeText(source.themeMessage || defaultWeeklyContent.themeMessage, 240) || defaultWeeklyContent.themeMessage;

  return {
    themeTitle: sanitizeText(source.themeTitle || defaultWeeklyContent.themeTitle, 80) || defaultWeeklyContent.themeTitle,
    themeMessage,
    quotations: buildThemeMessageQuotation(themeMessage),
  };
}

function loadWeeklyContent() {
  try {
    const raw = window.localStorage.getItem(WEEKLY_CONTENT_STORAGE_KEY);
    if (!raw) {
      return normalizeWeeklyContent(defaultWeeklyContent);
    }
    return normalizeWeeklyContent(JSON.parse(raw));
  } catch {
    return normalizeWeeklyContent(defaultWeeklyContent);
  }
}

function saveWeeklyContent(content) {
  window.localStorage.setItem(WEEKLY_CONTENT_STORAGE_KEY, JSON.stringify(content));
}

function publishWeeklyDraft(message = "") {
  weeklyContentDraft = normalizeWeeklyContent(weeklyContentDraft);
  saveWeeklyContent(weeklyContentDraft);
  if (message) {
    showStatus(message);
  }
}

function syncWeeklyDraftFromInputs() {
  if (!weeklyContentDraft) {
    weeklyContentDraft = loadWeeklyContent();
  }

  if (weeklyThemeTitleInput) {
    weeklyContentDraft.themeTitle =
      sanitizeText(weeklyThemeTitleInput.value, 80) || defaultWeeklyContent.themeTitle;
  }

  if (weeklyThemeMessageInput) {
    weeklyContentDraft.themeMessage =
      sanitizeText(weeklyThemeMessageInput.value, 240) || defaultWeeklyContent.themeMessage;
  }

  weeklyContentDraft.quotations = buildThemeMessageQuotation(weeklyContentDraft.themeMessage);

  return weeklyContentDraft;
}

function renderWeeklyQuoteList() {
  if (!weeklyQuotesList) {
    return;
  }

  weeklyQuotesList.innerHTML = "";
  const quotes = Array.isArray(weeklyContentDraft?.quotations) ? weeklyContentDraft.quotations : [];

  if (quotes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "weekly-quote-item weekly-quote-empty";
    empty.textContent = "No quotations added yet.";
    weeklyQuotesList.append(empty);
    return;
  }

  quotes.forEach((quote, index) => {
    const item = document.createElement("li");
    item.className = "weekly-quote-item";
    item.dataset.quoteId = quote.id;

    const copyWrap = document.createElement("div");
    copyWrap.className = "weekly-quote-copy";

    const quoteText = document.createElement("p");
    quoteText.className = "weekly-quote-text";
    quoteText.textContent = quote.text;

    const quoteComment = document.createElement("p");
    quoteComment.className = "weekly-quote-comment";
    quoteComment.textContent = quote.comment || "-";

    const order = document.createElement("span");
    order.className = "weekly-quote-order";
    order.textContent = `Quotation ${index + 1}`;

    const deleteButton = document.createElement("button");
    deleteButton.className = "btn btn-danger";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete-weekly-quote";
    deleteButton.dataset.quoteId = quote.id;
    deleteButton.textContent = "Delete";

    copyWrap.append(order, quoteText, quoteComment);
    item.append(copyWrap, deleteButton);
    weeklyQuotesList.append(item);
  });
}

function renderWeeklyContentEditor() {
  if (!weeklyContentDraft) {
    weeklyContentDraft = loadWeeklyContent();
  }

  if (weeklyThemeTitleInput) {
    weeklyThemeTitleInput.value = weeklyContentDraft.themeTitle;
  }

  if (weeklyThemeMessageInput) {
    weeklyThemeMessageInput.value = weeklyContentDraft.themeMessage;
  }

  renderWeeklyQuoteList();
}

function addWeeklyQuotationToDraft() {
  if (!weeklyQuoteInput) {
    return;
  }

  const quotationText = sanitizeText(weeklyQuoteInput.value, 180);
  const quotationComment = sanitizeText(weeklyQuoteCommentInput?.value, 160);
  if (!quotationText) {
    showStatus("Enter the quotation text first.");
    weeklyQuoteInput.focus();
    return;
  }

  syncWeeklyDraftFromInputs();
  const nextQuotes = [
    {
      id: createWeeklyQuoteId(),
      text: quotationText,
      comment: quotationComment,
    },
    ...(Array.isArray(weeklyContentDraft.quotations) ? weeklyContentDraft.quotations : []),
  ].slice(0, MAX_WEEKLY_QUOTES);

  weeklyContentDraft = {
    ...weeklyContentDraft,
    quotations: nextQuotes,
  };

  renderWeeklyQuoteList();
  publishWeeklyDraft("Quotation published to main page.");

  weeklyQuoteInput.value = "";
  if (weeklyQuoteCommentInput) {
    weeklyQuoteCommentInput.value = "";
  }
  weeklyQuoteInput.focus();
}

function deleteWeeklyQuotationFromDraft(quoteId) {
  const targetId = String(quoteId || "").trim();
  if (!targetId) {
    return;
  }

  syncWeeklyDraftFromInputs();
  const currentQuotes = Array.isArray(weeklyContentDraft.quotations) ? weeklyContentDraft.quotations : [];
  const nextQuotes = currentQuotes.filter((quote) => quote.id !== targetId);

  if (nextQuotes.length === currentQuotes.length) {
    return;
  }

  weeklyContentDraft = {
    ...weeklyContentDraft,
    quotations: nextQuotes,
  };

  renderWeeklyQuoteList();
  publishWeeklyDraft("Quotation removed and synced to main page.");
}

function saveWeeklyDraftToStorage() {
  syncWeeklyDraftFromInputs();
  publishWeeklyDraft("Weekly theme and quotations published to main page.");
  renderWeeklyContentEditor();
}

function scheduleWeeklyDraftAutosave() {
  syncWeeklyDraftFromInputs();
  window.clearTimeout(weeklyAutosaveTimerId);
  weeklyAutosaveTimerId = window.setTimeout(() => {
    publishWeeklyDraft();
  }, 260);
}

function getActiveVideoId(videos) {
  const saved = window.localStorage.getItem(ACTIVE_VIDEO_KEY);
  if (saved && videos.some((video) => video.id === saved)) {
    return saved;
  }
  return videos[0]?.id || "";
}

function renderVideos() {
  if (!videoList || !videosPageIndicator) {
    return;
  }

  cachedVideos = loadVideos();
  const activeId = getActiveVideoId(cachedVideos);
  const totalPages = Math.max(1, Math.ceil(cachedVideos.length / VIDEOS_PAGE_SIZE));
  videosPage = Math.min(Math.max(videosPage, 1), totalPages);

  const startIndex = (videosPage - 1) * VIDEOS_PAGE_SIZE;
  const pageItems = cachedVideos.slice(startIndex, startIndex + VIDEOS_PAGE_SIZE);

  videoList.innerHTML = "";
  pageItems.forEach((video) => {
    const item = document.createElement("li");
    item.className = "moderation-item";
    item.dataset.videoId = video.id;
    const isActive = video.id === activeId;
    if (isActive) {
      item.classList.add("video-item-active");
    }
    const sourceLabel = video.sourceType === "upload" ? "Uploaded Video" : "Embed Video";
    item.innerHTML = `
      <button type="button" class="video-item-clear-btn" data-action="delete-video" aria-label="Clear this video" title="Clear video">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div>
        <strong>${video.title}</strong>
        <p><strong>Theme:</strong> ${video.themeTitle || "-"}</p>
        <p><strong>Theme Message:</strong> ${video.themeMessage || "-"}</p>
        <p><em>${sourceLabel}</em></p>
        <p>${video.url}</p>
      </div>
      <div class="action-row">
        <button type="button" class="btn ${isActive ? "btn-solid is-active-video-btn" : "btn-light"}" data-action="set-active" ${isActive ? "disabled" : ""}>
          ${isActive ? "Active" : "Set Active"}
        </button>
      </div>
      <p class="video-item-posted-date">Posted: ${formatPostedDay(video.postedAt)}</p>
    `;
    videoList.append(item);
  });

  videosPageIndicator.textContent = `Page ${videosPage} / ${totalPages}`;
  videosPrevBtn.disabled = videosPage <= 1;
  videosNextBtn.disabled = videosPage >= totalPages;
}

function renderUsers(users) {
  if (!usersTableBody) {
    return;
  }

  const filteredUsers = getFilteredUsers(users);
  const hasSearch = Boolean(String(userSearchQuery || "").trim());

  let totalPages = 1;
  let pageUsers = filteredUsers;

  if (!hasSearch) {
    totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
    usersPage = Math.min(Math.max(usersPage, 1), totalPages);
    const startIndex = (usersPage - 1) * USERS_PAGE_SIZE;
    pageUsers = filteredUsers.slice(startIndex, startIndex + USERS_PAGE_SIZE);
  } else {
    usersPage = 1;
  }

  usersTableBody.innerHTML = "";

  if (!pageUsers || pageUsers.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="7" class="empty-row-cell">No users found.</td>`;
    usersTableBody.append(row);
  } else {
    pageUsers.forEach((user) => {
      const admin = isUserAdmin(user);
      const row = document.createElement("tr");
      row.dataset.userId = user.id;
      row.dataset.source = user.source || "server";
      row.dataset.isAdmin = admin ? "1" : "0";
      row.innerHTML = `
        <td data-label="Name">${user.fullname || "-"}</td>
        <td data-label="Email">${user.email || "-"}</td>
        <td data-label="Source"><span class="source-tag">${user.sourceLabel || "Server"}</span></td>
        <td data-label="Role"><span class="role-tag ${admin ? "role-tag-admin" : "role-tag-user"}">${admin ? "Admin" : "User"}</span></td>
        <td data-label="Total Logins">${formatNumber(user.total_logins)}</td>
        <td data-label="Last Login">${formatDate(user.last_login)}</td>
        <td data-label="Actions">
          <div class="action-row">
            <button class="btn ${admin ? "btn-admin-remove" : "btn-admin-add"}" type="button" data-action="toggle-admin">${admin ? "Remove Admin" : "Make Admin"}</button>
            <button class="btn btn-danger" type="button" data-action="delete-user">Delete User</button>
          </div>
        </td>
      `;
      usersTableBody.append(row);
    });
  }

  if (usersPageIndicator) {
    usersPageIndicator.textContent = hasSearch
      ? `Search Results: ${formatNumber(filteredUsers.length)}`
      : `Page ${usersPage} / ${totalPages}`;
  }
  if (usersPrevBtn) {
    usersPrevBtn.disabled = hasSearch || usersPage <= 1;
  }
  if (usersNextBtn) {
    usersNextBtn.disabled = hasSearch || usersPage >= totalPages;
  }
}

function renderAdminRoleSection(users) {
  if (!adminRoleTableBody) {
    return;
  }

  const filteredUsers = getFilteredUsers(users).filter((user) => isUserAdmin(user));
  adminRoleTableBody.innerHTML = "";

  if (!filteredUsers.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="5" class="empty-row-cell">No admin users found.</td>`;
    adminRoleTableBody.append(row);
    return;
  }

  filteredUsers.forEach((user) => {
    const admin = isUserAdmin(user);
    const row = document.createElement("tr");
    row.dataset.userId = user.id;
    row.dataset.source = user.source || "server";
    row.dataset.isAdmin = admin ? "1" : "0";
    row.innerHTML = `
      <td data-label="Name">${user.fullname || "-"}</td>
      <td data-label="Email">${user.email || "-"}</td>
      <td data-label="Source"><span class="source-tag">${user.sourceLabel || "Server"}</span></td>
      <td data-label="Current Role"><span class="role-tag ${admin ? "role-tag-admin" : "role-tag-user"}">${admin ? "Admin" : "User"}</span></td>
      <td data-label="Change Role">
        <button class="btn ${admin ? "btn-admin-remove" : "btn-admin-add"}" type="button" data-action="toggle-admin">${admin ? "Remove Admin" : "Make Admin"}</button>
      </td>
    `;
    adminRoleTableBody.append(row);
  });
}

function updateUserSearchPredictions() {
  if (!userSearchSuggestions) {
    return;
  }

  const rawQuery = String(userSearchInput?.value || "").trim().toLowerCase();
  const seen = new Set();
  const items = [];

  cachedCombinedUsers.forEach((user) => {
    const name = String(user.fullname || "").trim();
    const email = String(user.email || "").trim();

    if (name) {
      items.push(name);
    }
    if (email) {
      items.push(email);
    }
  });

  const filtered = items
    .filter((item) => {
      if (!item) {
        return false;
      }
      if (!rawQuery) {
        return true;
      }
      return item.toLowerCase().includes(rawQuery);
    })
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  userSearchSuggestions.innerHTML = "";
  filtered.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    userSearchSuggestions.append(option);
  });
}

function getCombinedUsers(serverUsers = []) {
  const localUsers = loadLocalUsers();
  const { map: localLoginMap } = buildLocalLoginMap();
  cachedLocalUsers = localUsers;

  const combined = [];

  serverUsers.forEach((user) => {
    combined.push({
      id: String(user.id),
      fullname: user.fullname,
      email: user.email,
      source: "server",
      sourceLabel: "Server",
      is_admin: isUserAdmin(user),
      total_logins: Number(user.total_logins) || 0,
      last_login: user.last_login,
    });
  });

  localUsers.forEach((user) => {
    const email = String(user.email || "").toLowerCase();
    const logins = localLoginMap.get(email) || { count: 0, last: null };
    combined.push({
      id: String(user.id),
      fullname: user.fullname,
      email: user.email,
      source: "local",
      sourceLabel: "Local Mode",
      is_admin: isUserAdmin(user),
      total_logins: logins.count,
      last_login: logins.last,
    });
  });

  return combined;
}

function setStats(values) {
  statUsers.textContent = formatNumber(values.totalUsers);
  statAdmins.textContent = formatNumber(values.totalAdmins);
  statUniqueLogins.textContent = formatNumber(values.totalUsers);
}

async function refreshStats() {
  const localUsers = loadLocalUsers();
  const { events: localEvents } = buildLocalLoginMap();
  const localUniqueLogins = new Set(localEvents.map((event) => String(event.email || "").toLowerCase()).filter(Boolean)).size;
  const localAdmins = localUsers.filter((user) => isUserAdmin(user)).length;

  const statsResult = await apiRequest("/stats/logins");
  const usersResult = await apiRequest("/admin/users");

  if (!statsResult.ok && !usersResult.ok) {
    serverOnline = false;
    setStats({
      totalUsers: localUsers.length,
      totalAdmins: localAdmins,
      uniqueLogins: localUniqueLogins,
    });
    showStatus("Server offline. Showing local-mode login stats.");
    return;
  }

  serverOnline = true;
  const stats = statsResult.ok ? statsResult.data.stats || {} : {};
  const serverUsers = usersResult.ok ? usersResult.data.users || [] : [];
  if (usersResult.ok) {
    cachedServerUsers = serverUsers;
  }
  const serverAdminCount = serverUsers.filter((user) => isUserAdmin(user)).length;

  setStats({
    totalUsers: (Number(stats.total_registered_users) || serverUsers.length || 0) + localUsers.length,
    totalAdmins: serverAdminCount + localAdmins,
    uniqueLogins: (Number(stats.unique_users_logged_in) || 0) + localUniqueLogins,
  });
}

async function refreshUsers() {
  const result = await apiRequest("/admin/users");
  if (!result.ok) {
    serverOnline = false;
    cachedCombinedUsers = getCombinedUsers([]);
    renderUsers(cachedCombinedUsers);
    renderAdminRoleSection(cachedCombinedUsers);
    updateUserSearchPredictions();
    showStatus("Server offline. Showing local-mode user logins.");
    return;
  }

  serverOnline = true;
  cachedServerUsers = result.data.users || [];
  cachedCombinedUsers = getCombinedUsers(cachedServerUsers);
  renderUsers(cachedCombinedUsers);
  renderAdminRoleSection(cachedCombinedUsers);
  updateUserSearchPredictions();
}

function applyUserSearch() {
  userSearchQuery = String(userSearchInput?.value || "").trim();
  usersPage = 1;
  renderUsers(cachedCombinedUsers);
  renderAdminRoleSection(cachedCombinedUsers);
}

if (refreshStatsBtn) {
  refreshStatsBtn.addEventListener("click", async () => {
    await refreshStats();
    showStatus("Stats refreshed.");
  });
}

if (userSearchBtn) {
  userSearchBtn.addEventListener("click", () => {
    applyUserSearch();
    showStatus("User search applied.");
  });
}

if (userSearchInput) {
  userSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyUserSearch();
      showStatus("User search applied.");
    }
  });

  userSearchInput.addEventListener("input", () => {
    applyUserSearch();
    updateUserSearchPredictions();
  });
}

if (usersPrevBtn) {
  usersPrevBtn.addEventListener("click", () => {
    usersPage -= 1;
    renderUsers(cachedCombinedUsers);
  });
}

if (usersNextBtn) {
  usersNextBtn.addEventListener("click", () => {
    usersPage += 1;
    renderUsers(cachedCombinedUsers);
  });
}

if (clearAllLoginsBtn) {
  clearAllLoginsBtn.addEventListener("click", async () => {
    const confirmed = window.confirm("Delete all login history?");
    if (!confirmed) {
      return;
    }

    saveLocalLoginEvents([]);

    if (serverOnline) {
      const result = await apiRequest("/admin/logins", { method: "DELETE" });
      if (!result.ok) {
        showStatus(result.message);
      }
    }

    await refreshStats();
    await refreshUsers();
    showStatus("All login history deleted.");
  });
}

if (adminConfirmYesBtn) {
  adminConfirmYesBtn.addEventListener("click", () => {
    closeAdminConfirmModal(true);
  });
}

if (adminConfirmNoBtn) {
  adminConfirmNoBtn.addEventListener("click", () => {
    closeAdminConfirmModal(false);
  });
}

if (adminConfirmModal) {
  adminConfirmModal.addEventListener("click", (event) => {
    if (event.target === adminConfirmModal) {
      closeAdminConfirmModal(false);
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && adminConfirmModal?.classList.contains("show")) {
    closeAdminConfirmModal(false);
  }
});

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = String(adminEmailInput?.value || "").trim();
    const password = String(adminPasswordInput?.value || "");

    if (!email || !password) {
      setAdminAuthMessage("Enter both email and password.");
      return;
    }

    if (adminLoginBtn) {
      adminLoginBtn.disabled = true;
    }
    setAdminAuthMessage("Checking admin access...");

    const result = await authenticateAdminCredentials(email, password);

    if (adminLoginBtn) {
      adminLoginBtn.disabled = false;
    }

    if (!result.ok) {
      setAdminAuthMessage(result.message || "Unable to login.");
      return;
    }

    setAdminAuthMessage("");
    if (adminPasswordInput) {
      adminPasswordInput.value = "";
    }
    await unlockDashboardAfterAuth(result.user);
  });
}

async function handleUserAction(button) {
  const action = String(button?.dataset?.action || "");
  const row = button.closest("tr");
  const userId = row?.dataset.userId;
  const source = row?.dataset.source || "server";

  if (!action || !userId) {
    return;
  }

  if (source === "local") {
    const users = loadLocalUsers();
    const events = loadLocalLoginEvents();
    const target = users.find((user) => String(user.id) === userId);

    if (!target) {
      showStatus("Local-mode user not found.");
      return;
    }

    if (action === "toggle-admin") {
      const nextIsAdmin = !isUserAdmin(target);
      const confirmed = await confirmAdminRoleChange(target.fullname, nextIsAdmin);
      if (!confirmed) {
        return;
      }

      const nextUsers = users.map((user) => {
        if (String(user.id) !== userId) {
          return user;
        }
        return {
          ...user,
          isAdmin: nextIsAdmin,
          is_admin: nextIsAdmin ? 1 : 0,
        };
      });

      saveLocalUsers(nextUsers);
      await refreshUsers();
      showStatus(nextIsAdmin ? "User promoted to admin (local mode)." : "Admin access removed (local mode).");
      return;
    }

    if (action === "delete-user") {
      const confirmed = window.confirm("Delete this local-mode user and login history?");
      if (!confirmed) {
        return;
      }

      const nextUsers = users.filter((user) => String(user.id) !== userId);
      const nextEvents = events.filter((event) => {
        const sameId = String(event.userId || "") === userId;
        const sameEmail = String(event.email || "").toLowerCase() === String(target.email || "").toLowerCase();
        return !sameId && !sameEmail;
      });

      saveLocalUsers(nextUsers);
      saveLocalLoginEvents(nextEvents);
      await refreshUsers();
      await refreshStats();
      showStatus("Local-mode user deleted.");
      return;
    }

    if (action === "clear-logins") {
      const confirmed = window.confirm("Delete local-mode login history for this user?");
      if (!confirmed) {
        return;
      }

      const nextEvents = events.filter((event) => {
        const sameId = String(event.userId || "") === userId;
        const sameEmail = String(event.email || "").toLowerCase() === String(target.email || "").toLowerCase();
        return !sameId && !sameEmail;
      });

      saveLocalLoginEvents(nextEvents);
      await refreshUsers();
      await refreshStats();
      showStatus("Local-mode login history deleted.");
    }
    return;
  }

  if (action === "toggle-admin") {
    const currentIsAdmin = row?.dataset.isAdmin === "1";
    const nextIsAdmin = !currentIsAdmin;
    const userName = getUserDisplayName(userId, source);
    const confirmed = await confirmAdminRoleChange(userName, nextIsAdmin);
    if (!confirmed) {
      return;
    }

    const result = await apiRequest(`/admin/users/${userId}/admin`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_admin: nextIsAdmin }),
    });

    if (!result.ok) {
      showStatus(result.message);
      return;
    }

    await refreshUsers();
    showStatus(nextIsAdmin ? "User promoted to admin." : "Admin access removed.");
    return;
  }

  if (action === "delete-user") {
    const confirmed = window.confirm("Delete this user and all login history?");
    if (!confirmed) {
      return;
    }

    const result = await apiRequest(`/admin/users/${userId}`, { method: "DELETE" });
    if (!result.ok) {
      showStatus(result.message);
      return;
    }

    await refreshUsers();
    await refreshStats();
    showStatus("User deleted.");
    return;
  }

  if (action === "clear-logins") {
    const confirmed = window.confirm("Delete login history for this user?");
    if (!confirmed) {
      return;
    }

    const result = await apiRequest(`/admin/users/${userId}/logins`, { method: "DELETE" });
    if (!result.ok) {
      showStatus(result.message);
      return;
    }

    await refreshUsers();
    await refreshStats();
    showStatus("User login history deleted.");
  }
}

function bindUserActionTable(tableBody) {
  if (!tableBody) {
    return;
  }

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    await handleUserAction(button);
  });
}

bindUserActionTable(usersTableBody);
bindUserActionTable(adminRoleTableBody);

if (videoForm) {
  videoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = videoTitleInput.value.trim();
    const sourceType = normalizeVideoSourceType(videoSourceTypeInput?.value);

    let finalUrl = "";
    if (sourceType === "upload") {
      const selectedFile = videoFileInput?.files?.[0] || null;
      if (!selectedFile) {
        showStatus("Choose a video file to upload.");
        return;
      }

      showStatus("Uploading video...");
      const uploadResult = await uploadVideoFile(selectedFile);
      if (!uploadResult.ok) {
        showStatus(uploadResult.message || "Upload failed.");
        return;
      }

      finalUrl = String(uploadResult.data?.media?.url || "").trim();
      if (!finalUrl) {
        showStatus("Upload completed but no file URL was returned.");
        return;
      }
    } else {
      finalUrl = normalizeVideoUrl(videoUrlInput.value);
      if (!finalUrl) {
        showStatus("Enter a valid embed video URL.");
        return;
      }
    }

    const videos = loadVideos();
    const weeklySnapshot = syncWeeklyDraftFromInputs();
    videos.unshift({
      id: `video-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      url: finalUrl,
      sourceType,
      themeTitle:
        sanitizeText(weeklySnapshot?.themeTitle, 80) || defaultWeeklyContent.themeTitle,
      themeMessage:
        sanitizeText(weeklySnapshot?.themeMessage, 240) || defaultWeeklyContent.themeMessage,
      postedAt: new Date().toISOString(),
    });

    saveVideos(videos);
    videosPage = 1;
    renderVideos();
    videoForm.reset();
    if (videoSourceTypeInput) {
      videoSourceTypeInput.value = "embed";
    }
    setVideoInputMode();
    showStatus(sourceType === "upload" ? "Uploaded video added." : "Embed video added.");
  });
}

if (videoSourceTypeInput) {
  videoSourceTypeInput.addEventListener("change", () => {
    setVideoInputMode();
  });
}

if (videoList) {
  videoList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const item = button.closest("li");
    const videoId = item?.dataset.videoId;
    if (!videoId) {
      return;
    }

    const videos = loadVideos();
    if (button.dataset.action === "set-active") {
      const selectedVideo = videos.find((video) => video.id === videoId) || null;
      window.localStorage.setItem(ACTIVE_VIDEO_KEY, videoId);
      if (selectedVideo) {
        const syncedWeeklyContent = normalizeWeeklyContent({
          themeTitle: selectedVideo.themeTitle,
          themeMessage: selectedVideo.themeMessage,
        });
        saveWeeklyContent(syncedWeeklyContent);
        weeklyContentDraft = syncedWeeklyContent;
        renderWeeklyContentEditor();
      }
      renderVideos();
      showStatus("Active video and theme updated.");
      return;
    }

    if (button.dataset.action === "delete-video") {
      const videoName = String(videos.find((video) => video.id === videoId)?.title || "this video").trim();
      const confirmed = await openAdminConfirmModal({
        title: "Clear Video",
        message: `Do you want to clear ${videoName}?`,
        yesClass: "btn-admin-remove",
        yesLabel: "Yes",
      });
      if (!confirmed) {
        return;
      }

      const nextVideos = videos.filter((video) => video.id !== videoId);
      if (nextVideos.length === 0) {
        showStatus("Keep at least one video.");
        return;
      }

      saveVideos(nextVideos);
      const activeId = window.localStorage.getItem(ACTIVE_VIDEO_KEY);
      if (activeId === videoId) {
        const fallbackVideo = nextVideos[0];
        window.localStorage.setItem(ACTIVE_VIDEO_KEY, fallbackVideo.id);
        const syncedWeeklyContent = normalizeWeeklyContent({
          themeTitle: fallbackVideo.themeTitle,
          themeMessage: fallbackVideo.themeMessage,
        });
        saveWeeklyContent(syncedWeeklyContent);
        weeklyContentDraft = syncedWeeklyContent;
        renderWeeklyContentEditor();
      }

      renderVideos();
      showStatus("Video deleted.");
    }
  });
}

if (videosPrevBtn) {
  videosPrevBtn.addEventListener("click", () => {
    videosPage -= 1;
    renderVideos();
  });
}

if (videosNextBtn) {
  videosNextBtn.addEventListener("click", () => {
    videosPage += 1;
    renderVideos();
  });
}

if (reloadWeeklyContentBtn) {
  reloadWeeklyContentBtn.addEventListener("click", () => {
    weeklyContentDraft = loadWeeklyContent();
    renderWeeklyContentEditor();
    showStatus("Weekly content reloaded.");
  });
}

if (addWeeklyQuoteBtn) {
  addWeeklyQuoteBtn.addEventListener("click", () => {
    addWeeklyQuotationToDraft();
  });
}

if (weeklyThemeTitleInput) {
  weeklyThemeTitleInput.addEventListener("input", () => {
    scheduleWeeklyDraftAutosave();
  });
}

if (weeklyThemeMessageInput) {
  weeklyThemeMessageInput.addEventListener("input", () => {
    scheduleWeeklyDraftAutosave();
  });
}

if (weeklyQuotesList) {
  weeklyQuotesList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='delete-weekly-quote']");
    if (!button) {
      return;
    }

    deleteWeeklyQuotationFromDraft(button.dataset.quoteId);
  });
}

if (weeklyContentForm) {
  weeklyContentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveWeeklyDraftToStorage();
  });
}

async function initDashboard() {
  setVideoInputMode();
  await refreshUsers();
  await refreshStats();
  renderVideos();
  weeklyContentDraft = loadWeeklyContent();
  renderWeeklyContentEditor();
}

async function bootAdminPage() {
  const signedInUser = getStoredUserRecord();
  if (!isValidSignedInUser(signedInUser)) {
    window.location.replace(buildLoginRedirectUrl());
    return;
  }

  if (!adminAuthGate || !adminLoginForm) {
    dashboardInitialized = true;
    await initDashboard();
    return;
  }

  setAdminAuthGateLocked(true);
  setAdminAuthMessage("");

  const rememberedEmail = getStoredUserEmail();
  if (adminEmailInput && rememberedEmail) {
    adminEmailInput.value = rememberedEmail;
  }

  const autoUnlocked = await tryAutoUnlockAdminAccess();
  if (autoUnlocked) {
    return;
  }

  window.setTimeout(() => {
    adminEmailInput?.focus();
  }, 0);
}

bootAdminPage().catch(() => {
  setAdminAuthGateLocked(true);
});

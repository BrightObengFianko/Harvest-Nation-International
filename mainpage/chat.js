const chatUserName = document.querySelector("#chat-user-name");
const chatLogoutBtn = document.querySelector("#chat-logout-btn");
const chatServerStatus = document.querySelector("#chat-server-status");
const chatUserSearch = document.querySelector("#chat-user-search");
const chatUserSuggestions = document.querySelector("#chat-user-suggestions");
const chatUserList = document.querySelector("#chat-user-list");
const chatUserEmptyState = document.querySelector("#chat-user-empty-state");
const chatThreadHead = document.querySelector("#chat-thread-head");
const chatThreadBackBtn = document.querySelector("#chat-thread-back-btn");
const chatThreadTitle = document.querySelector("#chat-thread-title");
const chatThreadSubtitle = document.querySelector("#chat-thread-subtitle");
const chatThreadEmptyState = document.querySelector("#chat-thread-empty-state");
const chatThread = document.querySelector("#chat-thread");
const chatForm = document.querySelector("#chat-form");
const chatMessageInput = document.querySelector("#chat-message-input");
const chatSendBtn = document.querySelector("#chat-send-btn");
const liveMessage = document.querySelector("#chat-live-message");

const CURRENT_USER_KEY = "hni_current_user";
const ACCOUNT_PROFILE_STORAGE_KEY = "hni_account_profiles_v1";
const CHAT_NOTIFICATION_SEEN_KEY = "hni_chat_notification_seen_v1";
const CHAT_READ_STATE_KEY = "hni_chat_read_state_v1";
const POLL_MESSAGES_MS = 1500;
const POLL_USERS_MS = 5000;
const SEARCH_SUGGEST_DEBOUNCE_MS = 260;
const USER_SEARCH_RESULTS_LIMIT = 1000;
const DEFAULT_COMPOSER_PLACEHOLDER = "Type your message here...";
const INACTIVE_COMPOSER_PLACEHOLDER = "Select a user on the left to start chatting...";
const MOBILE_CHAT_BREAKPOINT = 760;
const VIEWPORT_HEIGHT_CSS_VAR = "--chat-viewport-height";

const API_BASE = "/api";

let activeSessionUser = null;
let availableUsers = [];
let suggestedUsers = [];
let activeChannel = { scope: "none", peerUserId: null };
let pollingMessagesTimerId = null;
let pollingUsersTimerId = null;
let sendingInProgress = false;
let lastRenderedSignature = "";
let searchSuggestTimerId = null;
let lastSuggestionRequestId = 0;
let mobileChatView = "list";
let lastActivePeer = null;

function showMessage(text) {
  if (!liveMessage) {
    return;
  }

  liveMessage.textContent = text;
  liveMessage.classList.add("show");
  window.clearTimeout(showMessage.timerId);
  showMessage.timerId = window.setTimeout(() => {
    liveMessage.classList.remove("show");
  }, 1800);
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatConversationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
}

function setServerStatus(label, isOnline) {
  if (!chatServerStatus) {
    return;
  }

  chatServerStatus.textContent = label;
  chatServerStatus.classList.remove("online", "offline");
  if (isOnline === true) {
    chatServerStatus.classList.add("online");
  } else if (isOnline === false) {
    chatServerStatus.classList.add("offline");
  }
}

function setThreadMode(hasConversation) {
  if (chatThreadEmptyState) {
    chatThreadEmptyState.hidden = Boolean(hasConversation);
  }
  if (chatThreadHead) {
    chatThreadHead.hidden = !hasConversation;
  }
  if (chatThread) {
    chatThread.hidden = !hasConversation;
  }
  if (chatForm) {
    chatForm.hidden = false;
  }
  if (!hasConversation) {
    mobileChatView = "list";
  }
  syncMobileChatView();
}

function isPhoneChatLayout() {
  return window.innerWidth <= MOBILE_CHAT_BREAKPOINT;
}

function syncMobileChatView() {
  if (!document.body) {
    return;
  }
  const showThread =
    isPhoneChatLayout() && mobileChatView === "thread" && activeChannel.scope !== "none";
  document.body.classList.toggle("chat-mobile-thread-open", showThread);
}

function syncChatViewportHeight() {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  const visualViewport = window.visualViewport;
  const viewportHeight = Math.round(
    visualViewport?.height || window.innerHeight || root.clientHeight || 0
  );

  if (viewportHeight > 0) {
    root.style.setProperty(VIEWPORT_HEIGHT_CSS_VAR, `${viewportHeight}px`);
  }

  if (!visualViewport || visualViewport.height >= window.innerHeight - 8) {
    window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  }
}

function openMobileChatList() {
  mobileChatView = "list";
  syncMobileChatView();
}

function openMobileChatThread() {
  if (activeChannel.scope === "none") {
    openMobileChatList();
    return;
  }
  mobileChatView = "thread";
  syncMobileChatView();
}

function setComposerEnabled(enabled) {
  const allow = Boolean(enabled) && activeChannel.scope !== "none";

  if (chatMessageInput) {
    chatMessageInput.disabled = !allow;
    chatMessageInput.placeholder = allow ? DEFAULT_COMPOSER_PLACEHOLDER : INACTIVE_COMPOSER_PLACEHOLDER;
  }
  if (chatSendBtn) {
    chatSendBtn.disabled = !allow || sendingInProgress;
  }
}

function setUserEmptyState(show) {
  if (chatUserEmptyState) {
    chatUserEmptyState.hidden = !show;
  }
}

function normalizeSearchToken(value) {
  return String(value || "").trim().toLowerCase();
}

function levenshteinDistance(a, b) {
  const s = normalizeSearchToken(a);
  const t = normalizeSearchToken(b);
  if (!s || !t) return Math.max(s.length, t.length);
  if (s === t) return 0;
  if (Math.abs(s.length - t.length) > 2) return 3;

  const dp = Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) dp[j] = j;

  for (let i = 1; i <= s.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const temp = dp[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[t.length];
}

function isFuzzyMatch(token, query) {
  const a = normalizeSearchToken(token);
  const b = normalizeSearchToken(query);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return levenshteinDistance(a, b) <= 1;
}

function getCurrentUserRecord() {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getStoredAuthToken() {
  const currentUser = activeSessionUser || getCurrentUserRecord();
  return String(currentUser?.auth_token || currentUser?.token || "").trim();
}

function isValidSignedInUser(user) {
  if (!user || typeof user !== "object") {
    return false;
  }
  const email = String(user.email || "").trim();
  const id = String(user.id || "").trim();
  const fullname = String(user.fullname || "").trim();
  return Boolean(email || id || fullname);
}

function getDisplayName(user) {
  const fullname = String(user?.fullname || "").trim();
  if (fullname) {
    return fullname;
  }
  const username = String(user?.username || "").trim();
  if (username) {
    return username;
  }
  return String(user?.email || "").trim() || "Member";
}

function getProfileStorage() {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_PROFILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getProfileKey(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (email) {
    return email;
  }
  return String(user?.id || "").trim();
}

function getUserProfileImage(user) {
  const storage = getProfileStorage();
  const key = getProfileKey(user);
  return key ? String(storage[key] || "").trim() : "";
}

function getUserInitials(user) {
  const name = getDisplayName(user);
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function getNotificationSeenStorage() {
  try {
    const raw = window.localStorage.getItem(CHAT_NOTIFICATION_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveNotificationSeenStorage(storage) {
  try {
    window.localStorage.setItem(CHAT_NOTIFICATION_SEEN_KEY, JSON.stringify(storage));
  } catch {
    // Ignore storage failures.
  }
}

function getChatReadStateStorage() {
  try {
    const raw = window.localStorage.getItem(CHAT_READ_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveChatReadStateStorage(storage) {
  try {
    window.localStorage.setItem(CHAT_READ_STATE_KEY, JSON.stringify(storage));
  } catch {
    // Ignore storage failures.
  }
}

function getChatReadStateUserKey(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (email) {
    return email;
  }
  return String(user?.id || "").trim();
}

function getConversationReadCount(peerUserId) {
  const sessionKey = getChatReadStateUserKey(activeSessionUser);
  if (!sessionKey) {
    return 0;
  }

  const storage = getChatReadStateStorage();
  const sessionState = storage[sessionKey];
  if (!sessionState || typeof sessionState !== "object") {
    return 0;
  }

  return Number(sessionState[String(peerUserId)] || 0);
}

function markConversationRead(peerUserId, readCount = null) {
  const normalizedPeerId = parsePositiveInteger(peerUserId);
  const sessionKey = getChatReadStateUserKey(activeSessionUser);
  if (!normalizedPeerId || !sessionKey) {
    return;
  }

  let nextReadCount = Number(readCount);
  if (!Number.isFinite(nextReadCount) || nextReadCount < 0) {
    const peerUser = availableUsers.find((user) => Number(user?.id) === normalizedPeerId);
    nextReadCount = Number(peerUser?.incoming_message_count) || 0;
  }

  const storage = getChatReadStateStorage();
  const sessionState =
    storage[sessionKey] && typeof storage[sessionKey] === "object" ? storage[sessionKey] : {};
  sessionState[String(normalizedPeerId)] = nextReadCount;
  storage[sessionKey] = sessionState;
  saveChatReadStateStorage(storage);
}

function getNotificationSeenKey(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (email) {
    return email;
  }
  return String(user?.id || "").trim();
}

function markChatNotificationsSeen(user, timestamp = new Date().toISOString()) {
  const key = getNotificationSeenKey(user);
  if (!key) {
    return;
  }

  const storage = getNotificationSeenStorage();
  storage[key] = String(timestamp || new Date().toISOString());
  saveNotificationSeenStorage(storage);
}

function getUserSuggestionValue(user) {
  const name = getDisplayName(user);
  const email = String(user?.email || "").trim();
  if (!email) {
    return name;
  }
  if (normalizeSearchToken(name) === normalizeSearchToken(email)) {
    return name;
  }
  return `${name} (${email})`;
}

function getUserSearchTokens(user) {
  const name = String(user?.fullname || "").trim();
  const email = String(user?.email || "").trim();
  const suggestionValue = getUserSuggestionValue(user);
  const tokens = [normalizeSearchToken(name), normalizeSearchToken(email), normalizeSearchToken(suggestionValue)];
  if (name && email) {
    tokens.push(normalizeSearchToken(`${name} <${email}>`));
    tokens.push(normalizeSearchToken(`${name} (${email})`));
  }
  return Array.from(new Set(tokens.filter(Boolean)));
}

function mergeUniqueUsers(sourceUsers) {
  sourceUsers.forEach((user) => {
    const id = Number(user?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }
    const existingIndex = availableUsers.findIndex((entry) => Number(entry?.id) === id);
    if (existingIndex >= 0) {
      availableUsers[existingIndex] = {
        ...availableUsers[existingIndex],
        ...user,
      };
      return;
    }
    availableUsers.push(user);
  });
}

function renderSearchSuggestions(users) {
  if (!chatUserSuggestions) {
    return;
  }

  chatUserSuggestions.innerHTML = "";
  users.forEach((user) => {
    const option = document.createElement("option");
    const suggestionValue = getUserSuggestionValue(user);
    option.value = suggestionValue;
    option.label = suggestionValue;
    chatUserSuggestions.append(option);
  });
}

function findUserBySearchValue(rawValue) {
  const token = normalizeSearchToken(rawValue);
  if (!token) {
    return null;
  }

  const pools = [suggestedUsers, availableUsers];
  for (const pool of pools) {
    const found = pool.find((user) => getUserSearchTokens(user).includes(token));
    if (found) {
      return found;
    }
  }

  for (const pool of pools) {
    const found = pool.find((user) => {
      const name = normalizeSearchToken(getDisplayName(user));
      const email = normalizeSearchToken(user?.email || "");
      return (
        name.includes(token) ||
        email.includes(token) ||
        isFuzzyMatch(name, token) ||
        isFuzzyMatch(email, token)
      );
    });
    if (found) {
      return found;
    }
  }

  return null;
}

function buildLoginRedirectUrl() {
  const url = new URL("../login.html", window.location.href);
  url.searchParams.set("next", window.location.href);
  return url.toString();
}

function enforceAuth() {
  const currentUser = getCurrentUserRecord();
  if (isValidSignedInUser(currentUser)) {
    return currentUser;
  }
  window.location.replace(buildLoginRedirectUrl());
  return null;
}

async function apiRequest(path, options = {}) {
  const authToken = getStoredAuthToken();
  try {
    const nextOptions = { ...options };
    const headers = new Headers(options.headers || {});
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
      headers.set("X-HNI-Auth-Token", authToken);
    }
    nextOptions.headers = headers;
    const response = await fetch(`${API_BASE}${path}`, nextOptions);
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      return { ok: false, message: data.message || "Request failed.", data };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      offline: true,
      message: "Chat service is unavailable right now.",
      details: error ? String(error.message || error) : "",
    };
  }
}

async function resolveSessionUser(storedUser) {
  const authToken = String(storedUser?.auth_token || storedUser?.token || "").trim();
  if (!authToken) {
    return { ok: false, message: "Your login session is missing. Please login again." };
  }

  const syncStoredUser = (serverUser) => {
    try {
      window.localStorage.setItem(
        CURRENT_USER_KEY,
        JSON.stringify({
          ...storedUser,
          id: serverUser.id,
          fullname: serverUser.fullname,
          email: serverUser.email,
          is_admin: serverUser.is_admin,
          auth_token: serverUser.auth_token || authToken,
        })
      );
    } catch {
      // Ignore storage failures.
    }
  };

  const result = await apiRequest("/chat/session-user");
  if (result.ok && result.data?.user) {
    syncStoredUser(result.data.user);
    return result;
  }
  return result;
}

function getActivePeerUser() {
  if (activeChannel.scope !== "direct") {
    return null;
  }
  return availableUsers.find((user) => Number(user.id) === Number(activeChannel.peerUserId)) || null;
}

function updateThreadHeader() {
  if (!chatThreadTitle || !chatThreadSubtitle) {
    return;
  }

  if (activeChannel.scope === "all") {
    chatThreadTitle.textContent = "All Users Room";
    chatThreadSubtitle.textContent = "Message everyone who has logged in.";
    return;
  }

  if (activeChannel.scope === "direct") {
    const peerUser = getActivePeerUser();
    if (!peerUser) {
      chatThreadTitle.textContent = "Direct Chat";
      chatThreadSubtitle.textContent = "Select a user to start chatting.";
      return;
    }

    chatThreadTitle.textContent = getDisplayName(peerUser);
    chatThreadSubtitle.textContent = String(peerUser.email || "").trim() || "Private conversation";
    return;
  }

  chatThreadTitle.textContent = "Start a conversation";
  chatThreadSubtitle.textContent = "Pick a chat on the left to begin.";
}

function getConversationPreview(user) {
  const preview = String(user?.last_message_text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (preview) {
    const fromMe = Number(user?.last_message_sender_user_id) === Number(activeSessionUser?.id);
    return fromMe ? `You: ${preview}` : preview;
  }
  if (Number(user?.id) === Number(activeSessionUser?.id)) {
    return "Your account";
  }
  return String(user?.email || "").trim() || "Start a conversation";
}

function getConversationBadgeCount(user) {
  const peerUserId = Number(user?.id);
  if (!Number.isInteger(peerUserId) || peerUserId <= 0) {
    return 0;
  }

  const totalIncoming = Math.max(0, Number(user?.incoming_message_count) || 0);
  const readCount = Math.max(0, getConversationReadCount(peerUserId));
  if (totalIncoming <= readCount) {
    return 0;
  }
  return totalIncoming - readCount;
}

function buildConversationItem({
  label,
  sublabel,
  iconClass,
  scope,
  peerUserId,
  active,
  disabled = false,
  avatarUrl = "",
  avatarInitials = "",
  timeLabel = "",
  badgeCount = 0,
}) {
  const item = document.createElement("li");
  item.className = "chat-user-item";
  if (active) {
    item.classList.add("active");
  }
  if (disabled) {
    item.classList.add("self");
  }

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.scope = scope;
  if (scope === "direct" && peerUserId) {
    button.dataset.peerUserId = String(peerUserId);
  }
  button.disabled = Boolean(disabled);

  const avatar = document.createElement("span");
  avatar.className = "chat-user-avatar";
  if (avatarUrl) {
    const avatarImage = document.createElement("img");
    avatarImage.alt = `${label} profile`;
    avatarImage.src = avatarUrl;
    avatar.append(avatarImage);
  } else if (iconClass) {
    const icon = document.createElement("i");
    icon.className = iconClass;
    icon.setAttribute("aria-hidden", "true");
    avatar.append(icon);
  } else {
    const initials = document.createElement("span");
    initials.className = "chat-user-avatar-fallback";
    initials.textContent = avatarInitials || "U";
    avatar.append(initials);
  }

  const main = document.createElement("div");
  main.className = "chat-user-main";

  const title = document.createElement("strong");
  title.textContent = label;
  const meta = document.createElement("span");
  meta.textContent = sublabel;

  main.append(title, meta);

  const side = document.createElement("div");
  side.className = "chat-user-side";
  if (timeLabel) {
    const time = document.createElement("span");
    time.className = "chat-user-time";
    time.textContent = timeLabel;
    side.append(time);
  }
  if (badgeCount > 0 && !disabled) {
    const count = document.createElement("span");
    count.className = "chat-user-count";
    count.textContent = badgeCount > 99 ? "99+" : String(badgeCount);
    side.append(count);
  }

  button.append(avatar, main, side);
  item.append(button);
  return item;
}

function renderUserList() {
  if (!chatUserList) {
    return;
  }

  chatUserList.innerHTML = "";
  const query = normalizeSearchToken(chatUserSearch?.value || "");
  const hasUsers = availableUsers.length > 0;

  const shouldShowAllRoom = hasUsers;
  const allRoomMatches = !query || "all users room broadcast everyone".includes(query);
  if (shouldShowAllRoom && allRoomMatches) {
    chatUserList.append(
      buildConversationItem({
        label: "All Users Room",
        sublabel: "Broadcast to everyone who has logged in",
        iconClass: "fa-solid fa-bullhorn",
        scope: "all",
        active: activeChannel.scope === "all",
      })
    );
  }

  const filteredUsers = availableUsers.filter((user) => {
    if (!query) {
      return true;
    }
    const name = normalizeSearchToken(user?.fullname || "");
    const email = normalizeSearchToken(user?.email || "");
    return (
      name.includes(query) ||
      email.includes(query) ||
      isFuzzyMatch(name, query) ||
      isFuzzyMatch(email, query)
    );
  });

  filteredUsers.forEach((user) => {
    const isSelf = Number(user.id) === Number(activeSessionUser?.id);
    const label = getDisplayName(user);
    const preview = getConversationPreview(user);
    const timeLabel = formatConversationTime(user.last_message_at || user.last_login || user.created_at);
    const badgeCount =
      !isSelf && activeChannel.scope === "direct" && Number(activeChannel.peerUserId) === Number(user.id)
        ? 0
        : getConversationBadgeCount(user);
    chatUserList.append(
      buildConversationItem({
        label,
        sublabel: preview,
        iconClass: isSelf ? "fa-solid fa-user-check" : "",
        avatarUrl: getUserProfileImage(user),
        avatarInitials: getUserInitials(user),
        timeLabel,
        badgeCount,
        scope: "direct",
        peerUserId: user.id,
        active: !isSelf && activeChannel.scope === "direct" && Number(activeChannel.peerUserId) === Number(user.id),
        disabled: isSelf,
      })
    );
  });

  setUserEmptyState(chatUserList.children.length === 0);
}

function syncDirectConversationSummary(messages) {
  if (
    activeChannel.scope !== "direct" ||
    !activeChannel.peerUserId ||
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return;
  }

  const lastMessage = messages[messages.length - 1];
  const peerUserId = Number(activeChannel.peerUserId);
  const userIndex = availableUsers.findIndex((user) => Number(user?.id) === peerUserId);
  if (userIndex < 0) {
    return;
  }

  availableUsers[userIndex] = {
    ...availableUsers[userIndex],
    last_message_text: String(lastMessage?.content || "").trim(),
    last_message_at: lastMessage?.created_at || null,
    last_message_sender_user_id: Number(lastMessage?.sender?.id) || null,
  };
  if (Number(lastMessage?.sender?.id) !== Number(activeSessionUser?.id)) {
    markConversationRead(peerUserId, Number(availableUsers[userIndex].incoming_message_count) || 0);
  }
  lastActivePeer = availableUsers[userIndex];
  renderUserList();
}

function isNearBottom() {
  if (!chatThread) {
    return true;
  }
  const diff = chatThread.scrollHeight - chatThread.scrollTop - chatThread.clientHeight;
  return diff < 90;
}

function scrollThreadToBottom() {
  if (!chatThread) {
    return;
  }
  chatThread.scrollTop = chatThread.scrollHeight;
}

function renderMessages(messages) {
  if (!chatThread) {
    return;
  }

  chatThread.innerHTML = "";
  if (!Array.isArray(messages) || messages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent =
      activeChannel.scope === "all"
        ? "No messages yet in All Users Room."
        : "No direct messages yet. Start the conversation.";
    chatThread.append(empty);
    return;
  }

  messages.forEach((message) => {
    const mine = Number(message?.sender?.id) === Number(activeSessionUser?.id);
    const item = document.createElement("article");
    item.className = `chat-message ${mine ? "mine" : "other"}`;

    const meta = document.createElement("p");
    meta.className = "chat-message-meta";
    const senderName = mine ? "You" : getDisplayName(message.sender);
    meta.textContent = `${senderName} - ${formatDateTime(message.created_at)}`;

    const bubble = document.createElement("p");
    bubble.className = "chat-message-bubble";
    bubble.textContent = String(message.content || "");

    item.append(meta, bubble);
    chatThread.append(item);
  });
}

async function fetchUsers(options = {}) {
  if (!activeSessionUser) {
    return { ok: false, message: "No active user session." };
  }

  const query = String(options.query || "").trim();
  const limit = parsePositiveInteger(options.limit) || USER_SEARCH_RESULTS_LIMIT;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (query) {
    params.set("q", query);
  }
  return apiRequest(`/chat/users?${params.toString()}`);
}

async function fetchMessages() {
  if (!activeSessionUser) {
    return { ok: false, message: "No active user session." };
  }

  if (activeChannel.scope === "none") {
    return { ok: true, data: { messages: [] } };
  }

  const params = new URLSearchParams();
  params.set("scope", activeChannel.scope);
  params.set("limit", "220");
  if (activeChannel.scope === "direct" && activeChannel.peerUserId) {
    params.set("peerUserId", String(activeChannel.peerUserId));
  }
  return apiRequest(`/chat/messages?${params.toString()}`);
}

async function refreshUsers() {
  const result = await fetchUsers();
  if (!result.ok) {
    if (result.offline) {
      setServerStatus("Offline", false);
      setComposerEnabled(false);
    }
    return result;
  }

  availableUsers = Array.isArray(result.data?.users) ? result.data.users : [];
  setServerStatus("Online", true);

  if (activeChannel.scope === "direct" && activeChannel.peerUserId) {
    const activePeer = availableUsers.find(
      (user) => Number(user?.id) === Number(activeChannel.peerUserId)
    );
    if (activePeer) {
      markConversationRead(activeChannel.peerUserId, Number(activePeer.incoming_message_count) || 0);
    }
  }

  if (activeChannel.scope === "direct" && activeChannel.peerUserId) {
    const hasPeer = availableUsers.some((user) => Number(user.id) === Number(activeChannel.peerUserId));
    if (hasPeer) {
      lastActivePeer =
        availableUsers.find((user) => Number(user.id) === Number(activeChannel.peerUserId)) || lastActivePeer;
    } else if (lastActivePeer && Number(lastActivePeer.id) === Number(activeChannel.peerUserId)) {
      availableUsers.push(lastActivePeer);
    } else {
      // keep placeholder so the selection stays visible
      availableUsers.push({
        id: activeChannel.peerUserId,
        fullname: "User",
        email: "",
        is_admin: false,
      });
    }
  }

  renderUserList();
  updateThreadHeader();

  if (String(chatUserSearch?.value || "").trim()) {
    scheduleUserSuggestions();
  } else {
    suggestedUsers = [];
    renderSearchSuggestions([]);
  }

  if (activeChannel.scope === "none") {
    setThreadMode(false);
    setComposerEnabled(false);
  } else {
    setThreadMode(true);
    setComposerEnabled(true);
  }

  return result;
}

function scheduleUserSuggestions() {
  window.clearTimeout(searchSuggestTimerId);

  const query = String(chatUserSearch?.value || "").trim();
  if (!query) {
    suggestedUsers = [];
    renderSearchSuggestions([]);
    return;
  }

  const requestId = ++lastSuggestionRequestId;
  searchSuggestTimerId = window.setTimeout(async () => {
    const result = await fetchUsers({ query, limit: USER_SEARCH_RESULTS_LIMIT });
    if (requestId !== lastSuggestionRequestId) {
      return;
    }

    if (!result.ok) {
      if (result.offline) {
        setServerStatus("Offline", false);
      }
      return;
    }

    const users = Array.isArray(result.data?.users) ? result.data.users : [];
    suggestedUsers = users;
    mergeUniqueUsers(users);
    renderSearchSuggestions(users);
    renderUserList();
  }, SEARCH_SUGGEST_DEBOUNCE_MS);
}

async function refreshMessages(forceScroll = false) {
  if (activeChannel.scope === "none") {
    setThreadMode(false);
    setComposerEnabled(false);
    markChatNotificationsSeen(activeSessionUser);
    return;
  }

  const canStickToBottom = forceScroll || isNearBottom();
  const result = await fetchMessages();

  if (!result.ok) {
    if (result.offline) {
      setServerStatus("Offline", false);
      setComposerEnabled(false);
    }
    return;
  }

  const messages = Array.isArray(result.data?.messages) ? result.data.messages : [];
  const signature = `${messages.length}:${messages[0]?.id || 0}:${messages[messages.length - 1]?.id || 0}`;
  const needsRender = signature !== lastRenderedSignature;
  if (needsRender) {
    renderMessages(messages);
    lastRenderedSignature = signature;
    void refreshUsers();
  }

  if (activeChannel.scope === "direct" && activeChannel.peerUserId) {
    const peerUser = availableUsers.find(
      (user) => Number(user?.id) === Number(activeChannel.peerUserId)
    );
    markConversationRead(activeChannel.peerUserId, Number(peerUser?.incoming_message_count) || 0);
  }

  syncDirectConversationSummary(messages);

  if (canStickToBottom) {
    scrollThreadToBottom();
  }

  setThreadMode(true);
  setComposerEnabled(true);
  setServerStatus("Online", true);
  markChatNotificationsSeen(activeSessionUser);
}

async function sendMessage(content) {
  if (!activeSessionUser || activeChannel.scope === "none") {
    return { ok: false, message: "Select a conversation first." };
  }

  const payload = {
    scope: activeChannel.scope,
    content,
  };

  if (activeChannel.scope === "direct") {
    payload.recipientUserId = activeChannel.peerUserId;
  }

  return apiRequest("/chat/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function startPolling() {
  window.clearInterval(pollingMessagesTimerId);
  window.clearInterval(pollingUsersTimerId);

  pollingMessagesTimerId = window.setInterval(() => {
    if (document.visibilityState === "hidden" || activeChannel.scope === "none") {
      return;
    }
    refreshMessages(false);
  }, POLL_MESSAGES_MS);

  pollingUsersTimerId = window.setInterval(() => {
    if (document.visibilityState === "hidden") {
      return;
    }
    refreshUsers();
  }, POLL_USERS_MS);
}

function stopPolling() {
  window.clearInterval(pollingMessagesTimerId);
  window.clearInterval(pollingUsersTimerId);
  window.clearTimeout(searchSuggestTimerId);
}

async function activateChannel(scope, peerUserId = null) {
  if (scope === "all") {
    if (availableUsers.length === 0) {
      activeChannel = { scope: "none", peerUserId: null };
    } else {
      activeChannel = { scope: "all", peerUserId: null };
    }
  } else if (scope === "direct") {
    if (Number(peerUserId) === Number(activeSessionUser?.id)) {
      activeChannel = { scope: "none", peerUserId: null };
      showMessage("Your account is included. Choose another user to start a direct chat.");
      lastRenderedSignature = "";
      renderUserList();
      updateThreadHeader();
      setThreadMode(false);
      setComposerEnabled(false);
      return;
    }
    const hasPeer = availableUsers.some((user) => Number(user.id) === Number(peerUserId));
    if (hasPeer) {
      lastActivePeer =
        availableUsers.find((user) => Number(user.id) === Number(peerUserId)) || lastActivePeer;
      activeChannel = { scope: "direct", peerUserId: Number(peerUserId) };
    } else if (lastActivePeer && Number(lastActivePeer.id) === Number(peerUserId)) {
      availableUsers.push(lastActivePeer);
      activeChannel = { scope: "direct", peerUserId: Number(peerUserId) };
    } else {
      const placeholder = { id: Number(peerUserId), fullname: "User", email: "", is_admin: false };
      availableUsers.push(placeholder);
      lastActivePeer = placeholder;
      activeChannel = { scope: "direct", peerUserId: Number(peerUserId) };
    }
  } else {
    activeChannel = { scope: "none", peerUserId: null };
  }

  lastRenderedSignature = "";
  if (activeChannel.scope === "direct" && activeChannel.peerUserId) {
    const activePeer = availableUsers.find(
      (user) => Number(user?.id) === Number(activeChannel.peerUserId)
    );
    if (activePeer) {
      markConversationRead(activeChannel.peerUserId, Number(activePeer.incoming_message_count) || 0);
    }
  }
  renderUserList();
  updateThreadHeader();

  if (activeChannel.scope === "none") {
    setThreadMode(false);
    setComposerEnabled(false);
    return;
  }

  openMobileChatThread();
  setThreadMode(true);
  setComposerEnabled(true);
  await refreshMessages(true);
}

async function openDirectChatFromSearchInput() {
  const typedValue = String(chatUserSearch?.value || "").trim();
  if (!typedValue) {
    return false;
  }

  const normalized = normalizeSearchToken(typedValue);
  if (["all", "all users", "all users room", "broadcast"].includes(normalized)) {
    await activateChannel("all");
    return true;
  }

  let matchedUser = findUserBySearchValue(typedValue);
  if (!matchedUser) {
    const result = await fetchUsers({ query: typedValue, limit: USER_SEARCH_RESULTS_LIMIT });
    if (!result.ok) {
      if (result.offline) {
        setServerStatus("Offline", false);
      }
      return false;
    }

    const users = Array.isArray(result.data?.users) ? result.data.users : [];
    suggestedUsers = users;
    mergeUniqueUsers(users);
    renderSearchSuggestions(users);
    renderUserList();
    if (!lastActivePeer && users.length > 0) {
      lastActivePeer = users[0];
    }
    matchedUser = findUserBySearchValue(typedValue);
  }

  if (!matchedUser) {
    return false;
  }

  if (Number(matchedUser.id) === Number(activeSessionUser?.id)) {
    showMessage("Your account is included. Choose another user to start a direct chat.");
    return true;
  }

  await activateChannel("direct", matchedUser.id);
  return true;
}

async function handleSendMessage(event) {
  if (event) {
    event.preventDefault();
  }

  if (sendingInProgress || !chatMessageInput) {
    return;
  }

  if (activeChannel.scope === "none") {
    showMessage("Select a conversation first.");
    return;
  }

  const text = String(chatMessageInput.value || "").trim();
  if (!text) {
    showMessage("Write a message first.");
    return;
  }

  sendingInProgress = true;
  setComposerEnabled(false);

  const result = await sendMessage(text);
  sendingInProgress = false;
  setComposerEnabled(true);

  if (!result.ok) {
    if (result.offline) {
      setServerStatus("Offline", false);
      showMessage("Chat service is unavailable right now.");
      return;
    }
    showMessage(result.message || "Unable to send message.");
    return;
  }

  chatMessageInput.value = "";
  chatMessageInput.blur();
  syncChatViewportHeight();
  await refreshMessages(true);
}

function setupChatEvents() {
  if (chatUserList) {
    chatUserList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-scope]");
      if (!button) {
        return;
      }

      const scope = String(button.dataset.scope || "none");
      const peerUserId = parsePositiveInteger(button.dataset.peerUserId);
      await activateChannel(scope, peerUserId);
    });
  }

  if (chatUserSearch) {
    chatUserSearch.addEventListener("input", () => {
      renderUserList();
      scheduleUserSuggestions();
    });

    chatUserSearch.addEventListener("change", async () => {
      await openDirectChatFromSearchInput();
    });

    chatUserSearch.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      const found = await openDirectChatFromSearchInput();
      if (!found) {
        showMessage("No matching user found.");
      }
    });
  }

  if (chatForm) {
    chatForm.addEventListener("submit", handleSendMessage);
  }

  if (chatMessageInput) {
    chatMessageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    });

    chatMessageInput.addEventListener("focus", () => {
      syncChatViewportHeight();
    });

    chatMessageInput.addEventListener("blur", () => {
      window.setTimeout(syncChatViewportHeight, 140);
    });
  }

  if (chatThreadBackBtn) {
    chatThreadBackBtn.addEventListener("click", () => {
      openMobileChatList();
    });
  }

  window.addEventListener("resize", () => {
    syncMobileChatView();
    syncChatViewportHeight();
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncChatViewportHeight);
    window.visualViewport.addEventListener("scroll", syncChatViewportHeight);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    syncChatViewportHeight();
    void refreshUsers();
    if (activeChannel.scope !== "none") {
      void refreshMessages(false);
    }
  });
  window.addEventListener("focus", () => {
    syncChatViewportHeight();
    void refreshUsers();
    if (activeChannel.scope !== "none") {
      void refreshMessages(false);
    }
  });

  if (chatLogoutBtn) {
    chatLogoutBtn.addEventListener("click", () => {
      window.localStorage.removeItem(CURRENT_USER_KEY);
      window.location.href = buildLoginRedirectUrl();
    });
  }
}

function readPeerFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return parsePositiveInteger(params.get("peer"));
}

function readScopeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("scope") || "").trim().toLowerCase();
}

async function initChatPage() {
  syncChatViewportHeight();
  setupChatEvents();

  const localUser = enforceAuth();
  if (!localUser) {
    return;
  }

  if (chatUserName) {
    chatUserName.textContent = getDisplayName(localUser);
  }

  setThreadMode(false);
  setComposerEnabled(false);
  setServerStatus("Connecting...", null);

  const resolved = await resolveSessionUser(localUser);
  if (!resolved.ok) {
    if (resolved.offline) {
      setServerStatus("Offline", false);
      showMessage("Chat service is unavailable right now.");
    } else {
      setServerStatus("Online", true);
      showMessage((resolved.message || "Unable to load your chat account.") + " Please login again.");
    }
    return;
  }

  activeSessionUser = resolved.data.user;
  if (chatUserName) {
    chatUserName.textContent = getDisplayName(activeSessionUser);
  }
  markChatNotificationsSeen(activeSessionUser);

  const usersResult = await refreshUsers();
  if (!usersResult.ok) {
    showMessage(usersResult.message || "Unable to load users.");
    return;
  }

  const requestedPeer = readPeerFromUrl();
  const requestedScope = readScopeFromUrl();

  if (requestedScope === "all") {
    await activateChannel("all");
  } else if (requestedPeer) {
    await activateChannel("direct", requestedPeer);
  } else {
    openMobileChatList();
    await activateChannel("none");
  }

  startPolling();
}

window.addEventListener("beforeunload", stopPolling);

initChatPage().catch(() => {
  setServerStatus("Offline", false);
  setThreadMode(false);
  setComposerEnabled(false);
  showMessage("Unable to open chat page.");
});

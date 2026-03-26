(() => {
  const CURRENT_USER_KEY = "hni_current_user";
  const CHAT_NOTIFICATION_SEEN_KEY = "hni_chat_notification_seen_v1";
  const NOTIFICATION_LIMIT = 20;
  const NOTIFICATION_POLL_MS = 12000;

  const notificationShell = document.querySelector("#notification-shell");
  const notificationToggle = document.querySelector("#notification-toggle");
  const notificationMenu = document.querySelector("#notification-menu");
  const notificationList = document.querySelector("#notification-list");
  const notificationEmpty = document.querySelector("#notification-empty");
  const notificationBadge = document.querySelector("#notification-badge");

  if (!notificationShell || !notificationToggle || !notificationMenu || !notificationList) {
    return;
  }

  const currentHost = window.location.hostname || "127.0.0.1";
  const API_BASE_CANDIDATES = [
    `http://${currentHost}:3000/api`,
    "http://127.0.0.1:3000/api",
    "http://localhost:3000/api",
  ].filter((value, index, array) => array.indexOf(value) === index);

  let activeSessionUser = null;
  let notificationItems = [];
  let pollingTimerId = null;

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

  function parsePositiveInteger(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
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

  function getSeenStorage() {
    try {
      const raw = window.localStorage.getItem(CHAT_NOTIFICATION_SEEN_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveSeenStorage(storage) {
    try {
      window.localStorage.setItem(CHAT_NOTIFICATION_SEEN_KEY, JSON.stringify(storage));
    } catch {
      // Ignore storage failures.
    }
  }

  function getSeenStorageKey(user) {
    const email = String(user?.email || "").trim().toLowerCase();
    if (email) {
      return email;
    }
    return String(user?.id || "").trim();
  }

  function getSeenTimestamp(user) {
    const key = getSeenStorageKey(user);
    if (!key) {
      return 0;
    }

    const storage = getSeenStorage();
    const parsed = Date.parse(String(storage[key] || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function setSeenTimestamp(user, value) {
    const key = getSeenStorageKey(user);
    if (!key) {
      return;
    }

    const storage = getSeenStorage();
    storage[key] = String(value || new Date().toISOString());
    saveSeenStorage(storage);
  }

  function formatNotificationTime(value) {
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

  async function apiRequest(path, options = {}) {
    let lastError = null;

    for (const apiBase of API_BASE_CANDIDATES) {
      try {
        const response = await fetch(`${apiBase}${path}`, options);
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
        lastError = error;
      }
    }

    return {
      ok: false,
      offline: true,
      message: "Chat notifications are offline.",
      details: lastError ? String(lastError.message || lastError) : "",
    };
  }

  function syncStoredUser(serverUser, storedUser) {
    try {
      window.localStorage.setItem(
        CURRENT_USER_KEY,
        JSON.stringify({
          ...storedUser,
          id: serverUser.id,
          fullname: serverUser.fullname,
          email: serverUser.email,
          is_admin: serverUser.is_admin,
        })
      );
    } catch {
      // Ignore storage failures.
    }
  }

  async function resolveNotificationUser(storedUser) {
    const params = new URLSearchParams();
    const userId = parsePositiveInteger(storedUser?.id);
    const email = String(storedUser?.email || "").trim();

    if (userId) {
      params.set("userId", String(userId));
    }
    if (email) {
      params.set("email", email);
    }
    if (!params.toString()) {
      return { ok: false, message: "No valid account found." };
    }

    const result = await apiRequest(`/chat/session-user?${params.toString()}`);
    if (result.ok && result.data?.user) {
      syncStoredUser(result.data.user, storedUser);
      return result;
    }

    if (result.offline) {
      return result;
    }

    if (!email) {
      return result;
    }

    const ensured = await apiRequest("/chat/session-user/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        fullname: getDisplayName(storedUser),
      }),
    });

    if (ensured.ok && ensured.data?.user) {
      syncStoredUser(ensured.data.user, storedUser);
      return ensured;
    }

    return result;
  }

  async function fetchNotifications() {
    if (!activeSessionUser) {
      return { ok: false, message: "No active session user." };
    }

    const params = new URLSearchParams();
    params.set("currentUserId", String(activeSessionUser.id));
    params.set("limit", String(NOTIFICATION_LIMIT));
    return apiRequest(`/chat/notifications?${params.toString()}`);
  }

  function buildNotificationTarget(item) {
    const url = new URL("chat.html", window.location.href);
    if (item.scope === "all") {
      url.searchParams.set("scope", "all");
    } else if (item.peer_user_id) {
      url.searchParams.set("peer", String(item.peer_user_id));
    }
    return `${url.pathname}${url.search}`;
  }

  function getUnreadCount() {
    if (!activeSessionUser) {
      return 0;
    }

    const seenTimestamp = getSeenTimestamp(activeSessionUser);
    return notificationItems.filter((item) => {
      const createdAt = Date.parse(String(item?.created_at || ""));
      return Number.isFinite(createdAt) && createdAt > seenTimestamp;
    }).length;
  }

  function updateBadge() {
    const unreadCount = getUnreadCount();
    notificationBadge.hidden = unreadCount <= 0;
    notificationBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  }

  function updateEmptyState(message = "") {
    const hasItems = notificationItems.length > 0;
    notificationEmpty.hidden = hasItems;
    if (message) {
      notificationEmpty.textContent = message;
      notificationEmpty.hidden = false;
      return;
    }
    notificationEmpty.textContent = "No chat notifications yet.";
  }

  function renderNotifications() {
    notificationList.innerHTML = "";

    notificationItems.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notification-item";

      const createdAt = Date.parse(String(item?.created_at || ""));
      const unread = Number.isFinite(createdAt) && createdAt > getSeenTimestamp(activeSessionUser);
      if (unread) {
        button.classList.add("unread");
      }

      button.dataset.target = buildNotificationTarget(item);

      const top = document.createElement("div");
      top.className = "notification-item-top";

      const title = document.createElement("strong");
      title.className = "notification-item-title";
      title.textContent =
        item.scope === "all" ? `All Users Room - ${getDisplayName(item.sender)}` : getDisplayName(item.sender);

      const tag = document.createElement("span");
      tag.className = "notification-item-tag";
      tag.textContent = item.scope === "all" ? "All" : "Direct";

      top.append(title, tag);

      const message = document.createElement("p");
      message.className = "notification-item-message";
      message.textContent = String(item.content || "");

      const time = document.createElement("span");
      time.className = "notification-item-time";
      time.textContent = formatNotificationTime(item.created_at);

      button.append(top, message, time);
      notificationList.append(button);
    });

    updateEmptyState();
    updateBadge();
  }

  function closeNotificationMenu() {
    notificationMenu.hidden = true;
    notificationToggle.setAttribute("aria-expanded", "false");
  }

  function markNotificationsSeen() {
    if (!activeSessionUser) {
      return;
    }

    const latestTimestamp = notificationItems[0]?.created_at || new Date().toISOString();
    setSeenTimestamp(activeSessionUser, latestTimestamp);
    renderNotifications();
  }

  function openNotificationMenu() {
    notificationMenu.hidden = false;
    notificationToggle.setAttribute("aria-expanded", "true");
    markNotificationsSeen();
  }

  function toggleNotificationMenu() {
    if (notificationMenu.hidden) {
      openNotificationMenu();
      return;
    }

    closeNotificationMenu();
  }

  async function refreshNotifications() {
    if (!activeSessionUser) {
      notificationItems = [];
      renderNotifications();
      return;
    }

    const result = await fetchNotifications();
    if (!result.ok) {
      notificationItems = [];
      renderNotifications();
      updateEmptyState(result.offline ? "Chat notifications are offline." : (result.message || "Unable to load chat notifications."));
      return;
    }

    notificationItems = Array.isArray(result.data?.notifications) ? result.data.notifications : [];
    renderNotifications();

    if (!notificationMenu.hidden) {
      markNotificationsSeen();
    }
  }

  function startPolling() {
    window.clearInterval(pollingTimerId);
    pollingTimerId = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      refreshNotifications();
    }, NOTIFICATION_POLL_MS);
  }

  function stopPolling() {
    window.clearInterval(pollingTimerId);
  }

  function renderShellVisibility() {
    const storedUser = getCurrentUserRecord();
    const signedIn = isValidSignedInUser(storedUser);
    notificationShell.hidden = !signedIn;
    if (!signedIn) {
      activeSessionUser = null;
      notificationItems = [];
      closeNotificationMenu();
      stopPolling();
    }
  }

  notificationToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleNotificationMenu();
  });

  notificationList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-target]");
    if (!button) {
      return;
    }

    const target = String(button.dataset.target || "").trim();
    if (!target) {
      return;
    }

    closeNotificationMenu();
    window.location.href = target;
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#notification-shell")) {
      closeNotificationMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNotificationMenu();
    }
  });

  window.addEventListener("beforeunload", stopPolling);

  window.addEventListener("storage", () => {
    renderShellVisibility();
    updateBadge();
    if (activeSessionUser) {
      renderNotifications();
    }
  });

  async function initNotifications() {
    renderShellVisibility();
    const storedUser = getCurrentUserRecord();
    if (!isValidSignedInUser(storedUser)) {
      return;
    }

    const resolved = await resolveNotificationUser(storedUser);
    if (!resolved.ok) {
      notificationShell.hidden = false;
      notificationItems = [];
      renderNotifications();
      updateEmptyState(resolved.offline ? "Chat notifications are offline." : (resolved.message || "Unable to load chat notifications."));
      return;
    }

    activeSessionUser = resolved.data.user;
    notificationShell.hidden = false;
    await refreshNotifications();
    startPolling();
  }

  initNotifications().catch(() => {
    notificationShell.hidden = false;
    notificationItems = [];
    renderNotifications();
    updateEmptyState("Unable to load chat notifications.");
  });
})();

const menuToggle = document.querySelector("#menu-toggle");
const siteNav = document.querySelector("#site-nav");
const siteHeader = document.querySelector("#site-header");

const videoTitle = document.querySelector("#video-title");
const videoSubtitle = document.querySelector("#video-subtitle");
const activeLessonPostedDate = document.querySelector("#active-lesson-posted-date");
const videoPlayerSlot = document.querySelector("#video-player-slot");
const weeklyThemeTitle = document.querySelector("#weekly-theme-title");
const weeklyThemeSubtitle = document.querySelector("#weekly-theme-subtitle");
const weeklyQuotationsList = document.querySelector("#weekly-quotations-list");
const lessonsVideoList = document.querySelector("#lessons-video-list");
const lessonsVideoSearchInput = document.querySelector("#lessons-video-search-input");
const lessonsVideoSearchSuggestions = document.querySelector("#lessons-video-search-suggestions");
const lessonsVideoSearchBtn = document.querySelector("#lessons-video-search-btn");
const lessonsVideoToggleBtn = document.querySelector("#lessons-video-toggle");
const lessonViewerModal = document.querySelector("#lesson-viewer-modal");
const lessonViewerCloseBtn = document.querySelector("#lesson-viewer-close-btn");
const lessonCommentsList = document.querySelector("#lesson-comments-list");
const lessonsUserName = document.querySelector("#lessons-user-name");
const lessonsLogoutBtn = document.querySelector("#lessons-logout-btn");
const liveMessage = document.querySelector("#lessons-live-message");

const COMMENTS_STORAGE_KEY = "hni_mainpage_comments_v1";
const VIDEO_STORAGE_KEY = "hni_video_playlist_v1";
const ACTIVE_VIDEO_KEY = "hni_active_video_id_v1";
const WEEKLY_CONTENT_STORAGE_KEY = "hni_weekly_content_v1";
const CURRENT_USER_KEY = "hni_current_user";
const LESSONS_VIDEO_PREVIEW_LIMIT = 5;

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

let currentActiveVideo = null;
let showAllLessonVideos = false;
let lessonSearchQuery = "";

function activateRevealElements() {
  document.querySelectorAll(".reveal").forEach((element) => {
    element.classList.remove("reveal");
    element.style.opacity = "1";
  });
}

function showMessage(message) {
  if (!liveMessage) {
    return;
  }
  liveMessage.textContent = message;
  liveMessage.classList.add("show");
  window.clearTimeout(showMessage.timerId);
  showMessage.timerId = window.setTimeout(() => {
    liveMessage.classList.remove("show");
  }, 1500);
}

function getCurrentUserRecord() {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

function buildLoginRedirectUrl() {
  const loginUrl =
    window.location.origin && /^https?:$/i.test(String(window.location.protocol || ""))
      ? new URL("/bright/login.html", window.location.origin)
    : new URL("../login.html", window.location.href);
  const url = new URL(loginUrl.toString());
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

function cleanWeeklyText(value, maxLength = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getCommentAuthorName(item) {
  const directName = String(item?.authorName || "").trim();
  if (directName) {
    return directName;
  }

  const legacyName = String(item?.userName || item?.fullname || item?.author || item?.username || "").trim();
  if (legacyName) {
    return legacyName;
  }

  return "Member";
}

function normalizeThemeTitle(value) {
  const title = cleanWeeklyText(value, 80);
  return title || defaultWeeklyContent.themeTitle;
}

function normalizeCommentTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }

    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }
  }

  return Date.now();
}

function formatCommentTime(value) {
  const createdAt = normalizeCommentTimestamp(value);
  const diff = Date.now() - createdAt;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return "just now";
  }
  if (diff < hour) {
    return `${Math.floor(diff / minute)}m ago`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)}h ago`;
  }
  return new Date(createdAt).toLocaleDateString();
}

function normalizeLessonReplies(rawReplies) {
  if (!Array.isArray(rawReplies)) {
    return [];
  }

  return rawReplies
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => ({
      id: String(item.id || `lesson-reply-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      authorName: getCommentAuthorName(item),
      text: cleanWeeklyText(item.text, 240),
      createdAt: normalizeCommentTimestamp(item.createdAt),
    }))
    .filter((item) => item.text);
}

function loadLessonComments() {
  try {
    const raw = window.localStorage.getItem(COMMENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item.text === "string" && item.text.trim())
      .map((item) => ({
        id: String(item.id || `lesson-comment-${Date.now()}-${Math.random().toString(16).slice(2)}`),
        videoId: String(item.videoId || "").trim(),
        authorName: getCommentAuthorName(item),
        text: cleanWeeklyText(item.text, 240),
        createdAt: normalizeCommentTimestamp(item.createdAt),
        replies: normalizeLessonReplies(item.replies),
      }))
      .filter((item) => item.text);
  } catch {
    return [];
  }
}

function normalizeWeeklyQuotations(rawQuotations) {
  if (!Array.isArray(rawQuotations)) {
    return [];
  }
  return rawQuotations
    .map((item) => ({
      text: cleanWeeklyText(item?.text, 180),
      comment: cleanWeeklyText(item?.comment, 160),
    }))
    .filter((item) => item.text)
    .slice(0, 12);
}

function normalizeWeeklyContent(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  const hasQuotationList = Array.isArray(source.quotations);
  const quotations = hasQuotationList
    ? normalizeWeeklyQuotations(source.quotations)
    : normalizeWeeklyQuotations(defaultWeeklyContent.quotations);

  return {
    themeTitle: normalizeThemeTitle(source.themeTitle || defaultWeeklyContent.themeTitle),
    themeMessage:
      cleanWeeklyText(source.themeMessage || defaultWeeklyContent.themeMessage, 240) || defaultWeeklyContent.themeMessage,
    quotations,
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

function normalizeVideoSourceType(rawType) {
  return String(rawType || "").toLowerCase() === "upload" ? "upload" : "embed";
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

function buildVideoTitle(rawTitle, themeTitle, postedAt) {
  const directTitle = cleanWeeklyText(rawTitle, 120);
  if (directTitle) {
    return directTitle;
  }

  const themeBasedTitle = cleanWeeklyText(themeTitle, 80);
  if (themeBasedTitle && themeBasedTitle.toLowerCase() !== defaultWeeklyContent.themeTitle.toLowerCase()) {
    return themeBasedTitle;
  }

  const postedLabel = formatPostedDay(postedAt);
  return postedLabel === "Unknown date"
    ? "Harvest Nation Lesson"
    : `Harvest Nation Lesson - ${postedLabel}`;
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

function normalizeLessonSearchQuery(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildLessonSearchHaystack(video) {
  const postedDate = new Date(video.postedAt);
  const dateLabels = Number.isNaN(postedDate.getTime())
    ? []
    : [
        formatPostedDay(video.postedAt),
        postedDate.toLocaleDateString(),
        postedDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
        postedDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
        postedDate.toISOString().slice(0, 10),
      ];

  return [
    video.title,
    video.themeTitle,
    video.themeMessage,
    ...dateLabels,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function matchesLessonSearch(video, rawQuery) {
  const query = normalizeLessonSearchQuery(rawQuery);
  if (!query) {
    return true;
  }

  const haystack = buildLessonSearchHaystack(video);
  return query.split(" ").every((token) => haystack.includes(token));
}

function applyLessonSearch() {
  if (!lessonsVideoSearchInput) {
    return;
  }

  lessonSearchQuery = normalizeLessonSearchQuery(lessonsVideoSearchInput.value);
  renderLessonsSection();

  if (!lessonSearchQuery) {
    showMessage("Showing all posted lessons.");
    return;
  }

  showMessage(`Showing results for ${lessonsVideoSearchInput.value.trim()}.`);
}

function updateLessonSearchPredictions() {
  if (!lessonsVideoSearchSuggestions) {
    return;
  }

  const rawQuery = normalizeLessonSearchQuery(lessonsVideoSearchInput?.value || "");
  const seen = new Set();
  const suggestions = [];

  loadVideos().forEach((video) => {
    const postedDate = formatPostedDay(video.postedAt);
    const items = [
      String(video.themeTitle || "").trim(),
      String(video.title || "").trim(),
      postedDate === "Unknown date" ? "" : postedDate,
      String(video.postedAt || "").slice(0, 10),
    ].filter(Boolean);

    items.forEach((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      if (rawQuery && !key.includes(rawQuery)) {
        return;
      }

      seen.add(key);
      suggestions.push(value);
    });
  });

  lessonsVideoSearchSuggestions.innerHTML = "";
  suggestions.slice(0, 12).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    lessonsVideoSearchSuggestions.append(option);
  });
}

function normalizeVideoItem(rawItem) {
  if (!rawItem || typeof rawItem !== "object") {
    return null;
  }

  const url = String(rawItem.url || "").trim();
  if (!url) {
    return null;
  }

  const weeklyContentFallback = loadWeeklyContent();
  const themeTitle = normalizeThemeTitle(rawItem.themeTitle || weeklyContentFallback.themeTitle);
  const themeMessage =
    cleanWeeklyText(rawItem.themeMessage || weeklyContentFallback.themeMessage, 320) || defaultWeeklyContent.themeMessage;
  const id = typeof rawItem.id === "string" ? rawItem.id : `video-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const postedAt = normalizePostedAt(rawItem.postedAt, id);
  const title = buildVideoTitle(rawItem.title, themeTitle, postedAt);

  return {
    id,
    title,
    url,
    sourceType: normalizeVideoSourceType(rawItem.sourceType),
    themeTitle,
    themeMessage,
    postedAt,
  };
}

function loadVideos() {
  try {
    const raw = window.localStorage.getItem(VIDEO_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const rawItems = Array.isArray(parsed) ? parsed : [];
    let didBackfill = false;

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
          didBackfill = true;
        }
        return normalizedItem;
      })
      .filter(Boolean);

    if (normalized.length === 0) {
      const seededVideos = defaultVideos.map(normalizeVideoItem).filter(Boolean);
      window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(seededVideos));
      return seededVideos;
    }

    if (didBackfill || normalized.length !== rawItems.length) {
      window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    const seededVideos = defaultVideos.map(normalizeVideoItem).filter(Boolean);
    window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(seededVideos));
    return seededVideos;
  }
}

function renderVideoPlayer(video) {
  if (!videoPlayerSlot || !video) {
    return;
  }

  videoPlayerSlot.innerHTML = "";
  const sourceType = normalizeVideoSourceType(video.sourceType);
  let playerElement = null;

  if (sourceType === "upload") {
    const videoElement = document.createElement("video");
    videoElement.className = "video-player";
    videoElement.controls = true;
    videoElement.playsInline = true;
    videoElement.src = video.url;
    playerElement = videoElement;
  } else {
    const iframe = document.createElement("iframe");
    iframe.className = "video-player";
    iframe.src = video.url;
    iframe.title = video.title || "Harvest Nation lesson video";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.setAttribute("allowfullscreen", "true");
    playerElement = iframe;
  }

  videoPlayerSlot.append(playerElement);
}

function renderWeeklyContent() {
  if (!weeklyThemeTitle || !weeklyQuotationsList) {
    return;
  }

  const weeklyContent = loadWeeklyContent();
  const activeThemeTitle = cleanWeeklyText(currentActiveVideo?.themeTitle, 80);
  const activeThemeMessage = cleanWeeklyText(currentActiveVideo?.themeMessage, 240);
  const displayThemeTitle = activeThemeTitle || weeklyContent.themeTitle;
  const displayThemeMessage = activeThemeMessage || weeklyContent.themeMessage;

  weeklyThemeTitle.textContent = displayThemeTitle;
  if (weeklyThemeSubtitle) {
    weeklyThemeSubtitle.textContent = "Theme";
  }

  weeklyQuotationsList.innerHTML = "";
  const quotationText = cleanWeeklyText(displayThemeMessage, 240);
  if (!quotationText) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "quotation-empty";
    emptyItem.textContent = "No theme message added yet.";
    weeklyQuotationsList.append(emptyItem);
    return;
  }

  const item = document.createElement("li");
  const text = document.createElement("p");
  text.className = "quotation-text";
  text.textContent = quotationText;
  item.append(text);
  weeklyQuotationsList.append(item);
}

function renderLessonComments() {
  if (!lessonCommentsList) {
    return;
  }

  const allComments = loadLessonComments();
  const hasBoundComments = allComments.some((comment) => comment.videoId);
  const comments = hasBoundComments && currentActiveVideo
    ? allComments.filter((comment) => comment.videoId === currentActiveVideo.id)
    : allComments;

  lessonCommentsList.innerHTML = "";

  if (!comments.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "lesson-comments-empty";
    emptyItem.textContent = "No comments added yet for this lesson.";
    lessonCommentsList.append(emptyItem);
    return;
  }

  comments.forEach((comment) => {
    const item = document.createElement("li");
    item.className = "lesson-comment-item";

    const author = document.createElement("span");
    author.className = "lesson-comments-author";
    author.textContent = comment.authorName;

    const time = document.createElement("span");
    time.className = "lesson-comments-time";
    time.textContent = formatCommentTime(comment.createdAt);

    const text = document.createElement("p");
    text.className = "lesson-comments-text";
    text.textContent = comment.text;

    item.append(author, time, text);

    if (Array.isArray(comment.replies) && comment.replies.length > 0) {
      const replyList = document.createElement("ul");
      replyList.className = "lesson-comment-reply-list";

      comment.replies.forEach((reply) => {
        const replyItem = document.createElement("li");
        replyItem.className = "lesson-comment-reply-item";

        const replyMeta = document.createElement("div");
        replyMeta.className = "lesson-comment-reply-meta";

        const replyAuthor = document.createElement("span");
        replyAuthor.className = "lesson-comment-reply-author";
        replyAuthor.textContent = reply.authorName;

        const replyTime = document.createElement("span");
        replyTime.className = "lesson-comment-reply-time";
        replyTime.textContent = formatCommentTime(reply.createdAt);

        const replyText = document.createElement("p");
        replyText.className = "lesson-comment-reply-text";
        replyText.textContent = reply.text;

        replyMeta.append(replyAuthor, replyTime);
        replyItem.append(replyMeta, replyText);
        replyList.append(replyItem);
      });

      item.append(replyList);
    }

    lessonCommentsList.append(item);
  });
}

function renderLessonsSection() {
  if (!lessonsVideoList) {
    return;
  }

  const videos = loadVideos();
  const isSearchMode = Boolean(lessonSearchQuery);
  const filteredVideos = isSearchMode
    ? videos.filter((video) => matchesLessonSearch(video, lessonSearchQuery))
    : videos;
  lessonsVideoList.innerHTML = "";

  if (filteredVideos.length === 0) {
    if (lessonsVideoToggleBtn) {
      lessonsVideoToggleBtn.hidden = true;
    }
    const emptyItem = document.createElement("li");
    emptyItem.className = "lessons-video-empty";
    emptyItem.textContent = isSearchMode
      ? "No posted video matches that theme or date."
      : "No lesson videos posted yet.";
    lessonsVideoList.append(emptyItem);
    return;
  }

  const visibleVideos = isSearchMode
    ? filteredVideos
    : showAllLessonVideos
    ? filteredVideos
    : filteredVideos.slice(0, LESSONS_VIDEO_PREVIEW_LIMIT);

  visibleVideos.forEach((video, index) => {
    const item = document.createElement("li");
    item.className = "lessons-video-item";
    if (currentActiveVideo && currentActiveVideo.id === video.id) {
      item.classList.add("active");
    }

    const order = document.createElement("span");
    order.className = "lessons-video-index";
    order.textContent = String(index + 1).padStart(2, "0");

    const meta = document.createElement("div");
    meta.className = "lessons-video-meta";

    const themeLabel = document.createElement("p");
    themeLabel.className = "lessons-item-theme-label";
    themeLabel.textContent = `Theme: ${video.themeTitle || "This Week's Theme"}`;

    const themeMessage = document.createElement("p");
    themeMessage.className = "lessons-item-theme-message";
    themeMessage.textContent = video.themeMessage || "No theme message added yet.";

    const title = document.createElement("p");
    title.className = "lessons-video-title";
    title.textContent = video.title;

    const subtitle = document.createElement("p");
    subtitle.className = "lessons-video-subtitle";
    subtitle.textContent =
      normalizeVideoSourceType(video.sourceType) === "upload"
        ? "Uploaded lesson video"
        : "Embedded lesson video";

    meta.append(themeLabel, themeMessage, title, subtitle);

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.className = "lessons-video-play";
    playButton.textContent =
      !lessonViewerModal?.hidden && currentActiveVideo && currentActiveVideo.id === video.id ? "Open" : "Play";
    playButton.addEventListener("click", () => {
      openLessonViewer(video);
      showMessage(`Now playing: ${video.title}`);
    });

    const postedDate = document.createElement("p");
    postedDate.className = "lessons-video-posted-date";
    postedDate.textContent = `Posted: ${formatPostedDay(video.postedAt)}`;

    item.append(order, meta, playButton, postedDate);
    lessonsVideoList.append(item);
  });

  if (!lessonsVideoToggleBtn) {
    return;
  }

  if (isSearchMode || filteredVideos.length <= LESSONS_VIDEO_PREVIEW_LIMIT) {
    lessonsVideoToggleBtn.hidden = true;
    return;
  }

  const hiddenCount = Math.max(filteredVideos.length - LESSONS_VIDEO_PREVIEW_LIMIT, 0);
  lessonsVideoToggleBtn.hidden = false;
  lessonsVideoToggleBtn.innerHTML = showAllLessonVideos
    ? '<i class="fa-solid fa-angle-up" aria-hidden="true"></i><span>View Less</span>'
    : `<i class="fa-solid fa-angle-down" aria-hidden="true"></i><span>View More (${hiddenCount})</span>`;
  lessonsVideoToggleBtn.setAttribute(
    "aria-label",
    showAllLessonVideos
      ? "Show fewer posted videos"
      : `Show ${hiddenCount} more posted videos`
  );
}

function populateLessonViewer(video) {
  if (!video) {
    return;
  }

  currentActiveVideo = video;
  renderVideoPlayer(video);

  if (videoTitle) {
    videoTitle.textContent = video.title;
  }
  if (videoSubtitle) {
    videoSubtitle.textContent =
      normalizeVideoSourceType(video.sourceType) === "upload"
        ? "Uploaded from admin media section"
        : "Selected from admin video section";
  }
  if (activeLessonPostedDate) {
    activeLessonPostedDate.textContent = `Posted: ${formatPostedDay(video.postedAt)}`;
  }

  renderWeeklyContent();
  renderLessonComments();
  renderLessonsSection();
}

function stopLessonPlayback() {
  if (!videoPlayerSlot) {
    return;
  }

  const player = videoPlayerSlot.querySelector(".video-player");
  if (player instanceof HTMLVideoElement) {
    try {
      player.pause();
      player.removeAttribute("src");
      player.load();
    } catch {
      // Ignore cleanup issues while closing the viewer.
    }
  } else if (player instanceof HTMLIFrameElement) {
    try {
      player.src = "about:blank";
    } catch {
      // Ignore cleanup issues while closing the viewer.
    }
  }

  videoPlayerSlot.innerHTML = "";
}

function openLessonViewer(video) {
  if (!lessonViewerModal || !video) {
    return;
  }

  populateLessonViewer(video);
  lessonViewerModal.hidden = false;
  document.body.style.overflow = "hidden";
  renderLessonsSection();
}

function closeLessonViewer() {
  if (!lessonViewerModal) {
    return;
  }

  stopLessonPlayback();
  lessonViewerModal.hidden = true;
  document.body.style.overflow = "";
  renderLessonsSection();
}

function applyActiveVideo() {
  const videos = loadVideos();
  const savedId = window.localStorage.getItem(ACTIVE_VIDEO_KEY);
  const activeVideo = videos.find((video) => video.id === savedId) || videos[0];
  if (!activeVideo) {
    currentActiveVideo = null;
    renderLessonsSection();
    return;
  }
  currentActiveVideo = activeVideo;
  renderLessonsSection();
  if (!lessonViewerModal?.hidden) {
    populateLessonViewer(activeVideo);
  }
}

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target.closest("#site-nav") && !target.closest("#menu-toggle")) {
      siteNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

window.addEventListener("scroll", () => {
  if (!siteHeader) {
    return;
  }
  siteHeader.classList.toggle("scrolled", window.scrollY > 12);
});

if (lessonViewerCloseBtn) {
  lessonViewerCloseBtn.addEventListener("click", closeLessonViewer);
}

if (lessonsVideoToggleBtn) {
  lessonsVideoToggleBtn.addEventListener("click", () => {
    showAllLessonVideos = !showAllLessonVideos;
    renderLessonsSection();
  });
}

if (lessonsVideoSearchBtn) {
  lessonsVideoSearchBtn.addEventListener("click", applyLessonSearch);
}

if (lessonsVideoSearchInput) {
  lessonsVideoSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyLessonSearch();
    }
  });

  lessonsVideoSearchInput.addEventListener("input", () => {
    lessonSearchQuery = normalizeLessonSearchQuery(lessonsVideoSearchInput.value);
    renderLessonsSection();
    updateLessonSearchPredictions();
  });
}

document.querySelectorAll("[data-close-lesson-viewer]").forEach((element) => {
  element.addEventListener("click", closeLessonViewer);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lessonViewerModal?.hidden) {
    closeLessonViewer();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === VIDEO_STORAGE_KEY || event.key === ACTIVE_VIDEO_KEY) {
    applyActiveVideo();
    updateLessonSearchPredictions();
  }
  if (event.key === WEEKLY_CONTENT_STORAGE_KEY) {
    if (!lessonViewerModal?.hidden) {
      renderWeeklyContent();
    }
    renderLessonsSection();
    updateLessonSearchPredictions();
  }
  if (event.key === COMMENTS_STORAGE_KEY && !lessonViewerModal?.hidden) {
    renderLessonComments();
  }
});

const activeUser = enforceAuth();
if (activeUser) {
  activateRevealElements();
  if (lessonsUserName) {
    lessonsUserName.textContent = getDisplayName(activeUser);
  }

  if (lessonsLogoutBtn) {
    lessonsLogoutBtn.addEventListener("click", () => {
      window.localStorage.removeItem(CURRENT_USER_KEY);
      window.location.href = buildLoginRedirectUrl();
    });
  }

  applyActiveVideo();
  updateLessonSearchPredictions();
}

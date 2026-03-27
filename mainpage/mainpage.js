const menuToggle = document.querySelector("#menu-toggle");
const siteNav = document.querySelector("#site-nav");
const siteHeader = document.querySelector("#site-header");
const likeBtn = document.querySelector(".like-btn");
const commentBtn = document.querySelector(".comment-btn");
const shareBtn = document.querySelector(".share-btn");
const likeCount = document.querySelector("#like-count");
const commentCount = document.querySelector("#comment-count");
const shareCount = document.querySelector("#share-count");
const commentsSection = document.querySelector("#comments-section");
const emojiButtons = document.querySelectorAll("#comments-section [data-emoji]");
const chatFloat = document.querySelector("#chat-float");
const commentInput = document.querySelector("#video-comment");
const postCommentBtn = document.querySelector("#post-comment-btn");
const commentEmojiToggle = document.querySelector("#comment-emoji-toggle");
const commentsEmojiBar = document.querySelector("#comments-emoji-bar");
const commentList = document.querySelector("#comment-list");
const commentsScrollControls = document.querySelector("#comments-scroll-controls");
const commentScrollUpBtn = document.querySelector("#comment-scroll-up");
const commentScrollDownBtn = document.querySelector("#comment-scroll-down");
const liveMessage = document.querySelector("#live-message");
const videoPlayerSlot = document.querySelector("#video-player-slot");
const downloadMenu = document.querySelector("#download-menu");
const downloadToggleBtn = document.querySelector("#download-toggle-btn");
const downloadOptions = document.querySelector("#download-options");
const downloadMp4Btn = document.querySelector("#download-mp4-btn");
const downloadMp3Btn = document.querySelector("#download-mp3-btn");
const enlargeVideoBtn = document.querySelector("#enlarge-video-btn");
const videoTitle = document.querySelector("#video-title");
const videoSubtitle = document.querySelector("#video-subtitle");
const weeklyThemeTitle = document.querySelector("#weekly-theme-title");
const weeklyThemeSubtitle = document.querySelector("#weekly-theme-subtitle");
const weeklyQuotationsList = document.querySelector("#weekly-quotations-list");
const lessonsVideoList = document.querySelector("#lessons-video-list");
const sidebar = document.querySelector(".content-grid .sidebar");
const mainStage = document.querySelector(".content-grid .main-stage");

const COMMENTS_STORAGE_KEY = "hni_mainpage_comments_v1";
const VIDEO_STORAGE_KEY = "hni_video_playlist_v1";
const ACTIVE_VIDEO_KEY = "hni_active_video_id_v1";
const WEEKLY_CONTENT_STORAGE_KEY = "hni_weekly_content_v1";
const CURRENT_USER_KEY = "hni_current_user";
const GUEST_REACTOR_KEY = "hni_guest_reactor_key_v1";
const MAX_COMMENT_LENGTH = 220;
const MAX_REPLY_LENGTH = 220;
const COMMENT_PREVIEW_LIMIT = 2;
const COMMENTS_TOTAL_LABEL_ID = "comments-total-label";
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
let activeApiBase = API_BASE_CANDIDATES[0];
const COMMENT_REACTION_EMOJIS = [
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F525}",
  "\u{1F64F}",
  "\u{1F44F}",
  "\u{1F602}",
  "\u{1F64C}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F389}",
  "\u{2705}",
  "\u{1F4AF}",
  "\u{2728}",
  "\u{1F91D}",
];
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
    { text: "2 Feb. The good shepherd still leads with mercy.", comment: "Stay close to His leading this week." },
    { text: "9 Feb. Ask for wisdom and walk by faith.", comment: "Pray before every major decision." },
    { text: "16 Feb. The call of God is greater than fear.", comment: "Courage grows when we obey." },
    { text: "23 Feb. Salvation is the start of new life.", comment: "New life means a new daily walk." },
  ],
};
let currentActiveVideo = null;
let showAllComments = false;

if (commentInput) {
  commentInput.setAttribute("maxlength", String(MAX_COMMENT_LENGTH));
}

function formatCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }

  const abs = Math.abs(number);
  if (abs < 1000) {
    return new Intl.NumberFormat("en-US").format(Math.trunc(number));
  }

  const units = [
    { value: 1_000_000_000, suffix: "B" },
    { value: 1_000_000, suffix: "M" },
    { value: 1_000, suffix: "K" },
  ];

  const selectedUnit = units.find((unit) => abs >= unit.value) || units[units.length - 1];
  const compactValue = number / selectedUnit.value;
  const rounded =
    Math.abs(compactValue) >= 100
      ? compactValue.toFixed(0)
      : Math.abs(compactValue) >= 10
      ? compactValue.toFixed(1)
      : compactValue.toFixed(1);

  return `${rounded.replace(/\.0$/, "")}${selectedUnit.suffix}`;
}

function cleanWeeklyText(value, maxLength = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeThemeTitle(value) {
  const title = cleanWeeklyText(value, 80);
  return title || defaultWeeklyContent.themeTitle;
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
    emptyItem.textContent = "No quotations added yet.";
    weeklyQuotationsList.append(emptyItem);
    renderLessonsSection();
    return;
  }

  const item = document.createElement("li");
  const text = document.createElement("p");
  text.className = "quotation-text";
  text.textContent = quotationText;
  item.append(text);
  weeklyQuotationsList.append(item);
  renderLessonsSection();
}

function getCurrentUserRecord() {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    // Ignore malformed storage values.
    return null;
  }
}

function getCurrentUserName() {
  const user = getCurrentUserRecord();
  const fullname = String(user?.fullname || "").trim();
  if (fullname) {
    return fullname;
  }

  const username = String(user?.username || "").trim();
  if (username) {
    return username;
  }

  const email = String(user?.email || "").trim();
  if (email) {
    return email;
  }

  return "Guest";
}

function getCurrentReactorKey() {
  const user = getCurrentUserRecord();
  const userId = String(user?.id || "").trim();
  if (userId) {
    return `user:${userId}`;
  }

  const email = String(user?.email || "").trim().toLowerCase();
  if (email) {
    return `email:${email}`;
  }

  const fullName = String(user?.fullname || "").trim().toLowerCase();
  if (fullName) {
    return `name:${fullName}`;
  }

  let guestKey = "";
  try {
    guestKey = String(window.localStorage.getItem(GUEST_REACTOR_KEY) || "").trim();
    if (!guestKey) {
      guestKey = `guest-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      window.localStorage.setItem(GUEST_REACTOR_KEY, guestKey);
    }
  } catch {
    guestKey = `guest-fallback-${Date.now()}`;
  }

  return `guest:${guestKey}`;
}

function getCommentAuthorName(item) {
  const directName = String(item?.authorName || "").trim();
  if (directName) {
    return directName;
  }

  const legacyName = String(item?.userName || item?.fullname || item?.author || "").trim();
  if (legacyName) {
    return legacyName;
  }

  return "Member";
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

function normalizeReplyList(rawReplies) {
  if (!Array.isArray(rawReplies)) {
    return [];
  }

  return rawReplies
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => {
      const { likedBy, dislikedBy } = normalizeVoteLists(item.likedBy, item.dislikedBy);
      return {
        id: typeof item.id === "string" ? item.id : `r-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text: item.text.trim().slice(0, MAX_REPLY_LENGTH),
        authorName: getCommentAuthorName(item),
        createdAt: normalizeCommentTimestamp(item.createdAt),
        likedBy,
        likeCount: normalizeLikeCount(item.likeCount ?? item.likes, likedBy),
        dislikedBy,
        dislikeCount: normalizeDislikeCount(item.dislikeCount ?? item.dislikes, dislikedBy),
      };
    })
    .slice(-100);
}

function normalizeLikedBy(rawLikedBy) {
  const list = Array.isArray(rawLikedBy)
    ? rawLikedBy
    : typeof rawLikedBy === "string"
    ? [rawLikedBy]
    : [];

  return Array.from(new Set(list.map((value) => String(value || "").trim()).filter(Boolean)));
}

function normalizeVoteLists(rawLikedBy, rawDislikedBy, preferredReaction = "", preferredKey = "") {
  const likedSet = new Set(normalizeLikedBy(rawLikedBy));
  const dislikedSet = new Set(normalizeLikedBy(rawDislikedBy));

  Array.from(likedSet).forEach((key) => {
    if (!dislikedSet.has(key)) {
      return;
    }

    if (preferredReaction === "dislike" && key === preferredKey) {
      likedSet.delete(key);
      return;
    }

    dislikedSet.delete(key);
  });

  return {
    likedBy: Array.from(likedSet),
    dislikedBy: Array.from(dislikedSet),
  };
}

function normalizeLikeCount(rawCount, likedByList) {
  const likedBySize = Array.isArray(likedByList) ? likedByList.length : 0;
  if (likedBySize > 0) {
    return likedBySize;
  }
  const parsed = Number(rawCount);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeDislikeCount(rawCount, dislikedByList) {
  const size = Array.isArray(dislikedByList) ? dislikedByList.length : 0;
  if (size > 0) {
    return size;
  }
  const parsed = Number(rawCount);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeReactionMap(rawReactions) {
  const normalized = {};

  if (!rawReactions || typeof rawReactions !== "object") {
    return normalized;
  }

  COMMENT_REACTION_EMOJIS.forEach((emoji) => {
    const count = Number(rawReactions[emoji]);
    if (Number.isFinite(count) && count > 0) {
      normalized[emoji] = Math.floor(count);
    }
  });

  return normalized;
}

function normalizeUserReactions(rawUserReactions) {
  const normalized = {};

  if (!rawUserReactions || typeof rawUserReactions !== "object") {
    return normalized;
  }

  Object.entries(rawUserReactions).forEach(([userKey, reactionValue]) => {
    const key = String(userKey || "").trim();
    if (!key) {
      return;
    }

    const rawList = Array.isArray(reactionValue)
      ? reactionValue
      : typeof reactionValue === "string"
      ? [reactionValue]
      : [];

    const unique = Array.from(
      new Set(
        rawList
          .map((value) => String(value || ""))
          .filter((emoji) => COMMENT_REACTION_EMOJIS.includes(emoji))
      )
    );

    if (unique.length > 0) {
      normalized[key] = unique;
    }
  });

  return normalized;
}

function updateCounter(counterElement, delta) {
  if (!counterElement) {
    return;
  }

  const current = Number(counterElement.dataset.count || "0");
  const next = Math.max(current + delta, 0);
  counterElement.dataset.count = String(next);
  counterElement.textContent = formatCompact(next);
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
}

function updateEnlargeButtonState() {
  if (!enlargeVideoBtn) {
    return;
  }

  const isFullscreen = Boolean(getFullscreenElement());
  const icon = enlargeVideoBtn.querySelector("i");

  enlargeVideoBtn.setAttribute("aria-label", isFullscreen ? "Exit full screen" : "Enlarge video");
  enlargeVideoBtn.title = isFullscreen ? "Exit full screen" : "Enlarge video";

  if (icon) {
    icon.classList.toggle("fa-expand", !isFullscreen);
    icon.classList.toggle("fa-compress", isFullscreen);
  }
}

function getVideoFullscreenTarget() {
  if (!videoPlayerSlot) {
    return null;
  }
  return videoPlayerSlot.querySelector(".video-player") || videoPlayerSlot;
}

async function requestElementFullscreen(element) {
  if (!element) {
    throw new Error("No element");
  }

  if (element.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }
  if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
    return;
  }
  if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
    return;
  }
  throw new Error("Fullscreen API is not supported.");
}

async function exitFullscreenMode() {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
    return;
  }
  if (document.msExitFullscreen) {
    document.msExitFullscreen();
    return;
  }
  throw new Error("Exit fullscreen API is not supported.");
}

function showMessage(text) {
  if (!liveMessage) {
    return;
  }

  liveMessage.textContent = text;
  liveMessage.classList.add("show");
  window.clearTimeout(showMessage.timerId);
  showMessage.timerId = window.setTimeout(() => {
    liveMessage.classList.remove("show");
  }, 1500);
}

function normalizeVideoSourceType(rawType) {
  return String(rawType || "").toLowerCase() === "upload" ? "upload" : "embed";
}

function slugifyName(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "media";
}

function setDownloadMenuOpen(open) {
  if (!downloadOptions) {
    return;
  }
  downloadOptions.hidden = !open;
}

function buildMediaDownloadUrl(format) {
  const sourceUrl = String(currentActiveVideo?.url || "").trim();
  const sourceTitle = String(currentActiveVideo?.title || "media").trim();
  const params = new URLSearchParams({
    url: sourceUrl,
    format,
    title: slugifyName(sourceTitle),
  });
  return `${activeApiBase}/media/download?${params.toString()}`;
}

function updateDownloadOptionAvailability() {
  if (!downloadMp4Btn || !downloadMp3Btn) {
    return;
  }

  const hasMedia = Boolean(currentActiveVideo && String(currentActiveVideo.url || "").trim());
  const sourceType = normalizeVideoSourceType(currentActiveVideo?.sourceType);
  const canConvertOrDownload = hasMedia && sourceType === "upload";

  downloadMp4Btn.disabled = !canConvertOrDownload;
  downloadMp3Btn.disabled = !canConvertOrDownload;

  const disabledHint = hasMedia
    ? "MP3/MP4 download is available for uploaded media only."
    : "No media selected.";

  downloadMp4Btn.title = canConvertOrDownload ? "Download as MP4" : disabledHint;
  downloadMp3Btn.title = canConvertOrDownload ? "Download as MP3" : disabledHint;
}

async function triggerMediaDownload(format) {
  const safeFormat = String(format || "").toLowerCase();
  if (!["mp3", "mp4"].includes(safeFormat)) {
    return;
  }

  if (!currentActiveVideo || !String(currentActiveVideo.url || "").trim()) {
    showMessage("No media available for download.");
    return;
  }

  const sourceType = normalizeVideoSourceType(currentActiveVideo.sourceType);
  if (sourceType !== "upload") {
    const copied = await copyLinkFallback(getVideoShareUrl());
    if (copied) {
      showMessage("Embed media cannot be downloaded directly. Link copied.");
    } else {
      showMessage("Embed media cannot be downloaded directly.");
    }
    return;
  }

  const downloadUrl = buildMediaDownloadUrl(safeFormat);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  showMessage(`${safeFormat.toUpperCase()} download started.`);
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

function renderLessonsSection() {
  if (!lessonsVideoList) {
    return;
  }

  const videos = loadVideos();
  lessonsVideoList.innerHTML = "";

  if (videos.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "lessons-video-empty";
    emptyItem.textContent = "No lesson videos posted yet.";
    lessonsVideoList.append(emptyItem);
    return;
  }

  videos.forEach((video, index) => {
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
    playButton.textContent = currentActiveVideo && currentActiveVideo.id === video.id ? "Playing" : "Play";
    playButton.addEventListener("click", () => {
      applyVideoSelection(video);
      videoPlayerSlot?.scrollIntoView({ behavior: "smooth", block: "start" });
      showMessage(`Now playing: ${video.title}`);
    });

    const postedDate = document.createElement("p");
    postedDate.className = "lessons-video-posted-date";
    postedDate.textContent = `Posted: ${formatPostedDay(video.postedAt)}`;

    item.append(order, meta, playButton, postedDate);
    lessonsVideoList.append(item);
  });
}

function syncSidebarHeightToVideo() {
  if (!sidebar) {
    return;
  }

  if (window.innerWidth <= 1060) {
    sidebar.style.removeProperty("height");
    return;
  }

  if (!mainStage) {
    sidebar.style.removeProperty("height");
    return;
  }

  const height = Math.round(mainStage.getBoundingClientRect().height);
  if (height > 0) {
    sidebar.style.height = `${height}px`;
  }
}

function updateCommentScrollControls() {
  if (!commentsScrollControls || !commentList) {
    return;
  }

  const shouldShow =
    showAllComments &&
    storedComments.length > COMMENT_PREVIEW_LIMIT &&
    commentList.scrollHeight > commentList.clientHeight + 4;

  commentsScrollControls.hidden = !shouldShow;

  if (!shouldShow) {
    if (commentScrollUpBtn) {
      commentScrollUpBtn.disabled = true;
    }
    if (commentScrollDownBtn) {
      commentScrollDownBtn.disabled = true;
    }
    return;
  }

  const isNearTop = commentList.scrollTop <= 4;
  const isNearBottom = commentList.scrollTop + commentList.clientHeight >= commentList.scrollHeight - 4;

  if (commentScrollUpBtn) {
    commentScrollUpBtn.disabled = isNearTop;
  }
  if (commentScrollDownBtn) {
    commentScrollDownBtn.disabled = isNearBottom;
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
    iframe.title = video.title || "Harvest Nation sermon stream";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.setAttribute("allowfullscreen", "true");
    playerElement = iframe;
  }

  videoPlayerSlot.dataset.sourceType = sourceType;
  videoPlayerSlot.dataset.url = video.url;
  videoPlayerSlot.append(playerElement);
  window.requestAnimationFrame(syncSidebarHeightToVideo);
}

function applyVideoSelection(video) {
  if (!video) {
    return;
  }

  currentActiveVideo = video;
  storedComments = loadComments(video.id);
  showAllComments = false;
  renderVideoPlayer(video);
  updateDownloadOptionAvailability();

  if (videoTitle) {
    videoTitle.textContent = video.title;
  }
  if (videoSubtitle) {
    videoSubtitle.textContent =
      normalizeVideoSourceType(video.sourceType) === "upload"
        ? "Uploaded from admin media section"
        : "Selected from admin video section";
  }

  renderWeeklyContent();
  renderComments();
}

function applyActiveVideo() {
  const videos = loadVideos();
  const savedId = window.localStorage.getItem(ACTIVE_VIDEO_KEY);
  const activeVideo = videos.find((video) => video.id === savedId) || videos[0];
  if (!activeVideo) {
    currentActiveVideo = null;
    storedComments = [];
    renderWeeklyContent();
    renderComments();
    return;
  }
  applyVideoSelection(activeVideo);
}

function insertEmojiIntoComment(emoji) {
  if (!commentInput || !emoji) {
    return;
  }

  const start = commentInput.selectionStart ?? commentInput.value.length;
  const end = commentInput.selectionEnd ?? commentInput.value.length;
  const before = commentInput.value.slice(0, start);
  const after = commentInput.value.slice(end);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  const prefix = needsSpaceBefore ? " " : "";
  const nextValue = `${before}${prefix}${emoji} ${after}`;

  commentInput.value = nextValue;
  const caret = before.length + prefix.length + emoji.length + 1;
  commentInput.focus();
  commentInput.setSelectionRange(caret, caret);
}

function canUseCompactCommentEmojiPicker() {
  return window.matchMedia("(min-width: 701px)").matches;
}

function setCommentEmojiPickerOpen(isOpen) {
  if (!commentsSection || !commentEmojiToggle) {
    return;
  }

  const nextState = Boolean(isOpen) && canUseCompactCommentEmojiPicker();
  commentsSection.classList.toggle("show-emoji-picker", nextState);
  commentEmojiToggle.setAttribute("aria-expanded", String(nextState));
}

function getVideoShareUrl() {
  if (!currentActiveVideo || !String(currentActiveVideo.url || "").trim()) {
    return window.location.href;
  }

  const activeSourceType = normalizeVideoSourceType(currentActiveVideo.sourceType);
  const activeUrl = String(currentActiveVideo.url || "").trim();
  if (activeSourceType === "upload") {
    return activeUrl;
  }

  try {
    const parsed = new URL(activeUrl, window.location.href);
    const isYouTube = parsed.hostname.includes("youtube.com");
    const isEmbed = parsed.pathname.startsWith("/embed/");

    if (isYouTube && isEmbed) {
      const videoId = parsed.pathname.replace("/embed/", "").split(/[?/&#]/)[0];
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }

    return parsed.toString();
  } catch {
    return activeUrl;
  }
}

async function copyLinkFallback(url) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function getCommentBaseCount() {
  if (!commentCount) {
    return 0;
  }

  if (!commentCount.dataset.base) {
    commentCount.dataset.base = commentCount.dataset.count || "0";
  }

  return Number(commentCount.dataset.base || "0");
}

function getFallbackCommentVideoId() {
  if (currentActiveVideo?.id) {
    return currentActiveVideo.id;
  }

  const videos = loadVideos();
  const savedId = String(window.localStorage.getItem(ACTIVE_VIDEO_KEY) || "").trim();
  if (savedId && videos.some((video) => video.id === savedId)) {
    return savedId;
  }

  return videos[0]?.id || "";
}

function normalizeCommentCollection(rawItems, videoId = "") {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => {
      const { likedBy, dislikedBy } = normalizeVoteLists(item.likedBy, item.dislikedBy);
      return {
        id: typeof item.id === "string" ? item.id : `c-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        videoId: String(item.videoId || videoId || "").trim(),
        text: item.text.trim().slice(0, MAX_COMMENT_LENGTH),
        authorName: getCommentAuthorName(item),
        createdAt: normalizeCommentTimestamp(item.createdAt),
        reactions: normalizeReactionMap(item.reactions),
        userReactions: normalizeUserReactions(item.userReactions),
        replies: normalizeReplyList(item.replies),
        likedBy,
        likeCount: normalizeLikeCount(item.likeCount ?? item.likes, likedBy),
        dislikedBy,
        dislikeCount: normalizeDislikeCount(item.dislikeCount ?? item.dislikes, dislikedBy),
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

function saveCommentStore(store) {
  try {
    window.localStorage.setItem(
      COMMENTS_STORAGE_KEY,
      JSON.stringify({
        byVideo: store,
      })
    );
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

function normalizeCommentStore(rawValue) {
  if (Array.isArray(rawValue)) {
    const fallbackVideoId = getFallbackCommentVideoId();
    if (!fallbackVideoId) {
      return {};
    }

    return {
      [fallbackVideoId]: normalizeCommentCollection(rawValue, fallbackVideoId),
    };
  }

  if (!rawValue || typeof rawValue !== "object") {
    return {};
  }

  const source =
    rawValue.byVideo && typeof rawValue.byVideo === "object" && !Array.isArray(rawValue.byVideo)
      ? rawValue.byVideo
      : rawValue;

  return Object.entries(source).reduce((acc, [videoId, items]) => {
    const cleanVideoId = String(videoId || "").trim();
    if (!cleanVideoId) {
      return acc;
    }

    acc[cleanVideoId] = normalizeCommentCollection(items, cleanVideoId);
    return acc;
  }, {});
}

function loadCommentStore() {
  try {
    const raw = window.localStorage.getItem(COMMENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const normalized = normalizeCommentStore(parsed);
    const shouldRewrite =
      !raw ||
      Array.isArray(parsed) ||
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.byVideo;

    if (shouldRewrite) {
      saveCommentStore(normalized);
    }

    return normalized;
  } catch {
    return {};
  }
}

function loadComments(videoId = getFallbackCommentVideoId()) {
  const cleanVideoId = String(videoId || "").trim();
  if (!cleanVideoId) {
    return [];
  }

  const store = loadCommentStore();
  return Array.isArray(store[cleanVideoId]) ? store[cleanVideoId] : [];
}

function saveComments(comments, videoId = getFallbackCommentVideoId()) {
  const cleanVideoId = String(videoId || "").trim();
  if (!cleanVideoId) {
    return;
  }

  const store = loadCommentStore();
  store[cleanVideoId] = normalizeCommentCollection(comments, cleanVideoId);
  saveCommentStore(store);
}

function formatCommentTime(createdAt) {
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

function setCommentCount(baseCount, extraCount) {
  if (!commentCount) {
    return;
  }

  const next = Math.max(baseCount + extraCount, 0);
  commentCount.dataset.count = String(next);
  commentCount.textContent = formatCompact(next);
}

function getTotalCommentUnits(comments) {
  return comments.length;
}

function updateCommentReaction(commentId, emoji) {
  if (!commentId || !COMMENT_REACTION_EMOJIS.includes(emoji)) {
    return;
  }

  const reactorKey = getCurrentReactorKey();
  const targetIndex = storedComments.findIndex((comment) => comment.id === commentId);
  if (targetIndex === -1) {
    return;
  }

  const comment = storedComments[targetIndex];
  const nextReactions = normalizeReactionMap(comment.reactions);
  const nextUserReactions = normalizeUserReactions(comment.userReactions);
  const userReactionSet = new Set(nextUserReactions[reactorKey] || []);

  if (userReactionSet.has(emoji)) {
    const nextCount = Math.max(Number(nextReactions[emoji] || 0) - 1, 0);
    if (nextCount > 0) {
      nextReactions[emoji] = nextCount;
    } else {
      delete nextReactions[emoji];
    }

    userReactionSet.delete(emoji);
    if (userReactionSet.size === 0) {
      delete nextUserReactions[reactorKey];
    } else {
      nextUserReactions[reactorKey] = Array.from(userReactionSet);
    }

    showMessage("Reaction removed.");
  } else {
    nextReactions[emoji] = Math.max(Number(nextReactions[emoji] || 0), 0) + 1;
    userReactionSet.add(emoji);
    nextUserReactions[reactorKey] = Array.from(userReactionSet);
    showMessage("Reaction added.");
  }

  const nextComment = {
    ...comment,
    reactions: nextReactions,
    userReactions: nextUserReactions,
  };

  storedComments = [
    ...storedComments.slice(0, targetIndex),
    nextComment,
    ...storedComments.slice(targetIndex + 1),
  ];
  saveComments(storedComments);
  renderComments();
}

function toggleCommentLike(commentId) {
  if (!commentId) {
    return;
  }

  const reactorKey = getCurrentReactorKey();
  const targetIndex = storedComments.findIndex((comment) => comment.id === commentId);
  if (targetIndex === -1) {
    return;
  }

  const target = storedComments[targetIndex];
  const { likedBy, dislikedBy } = normalizeVoteLists(target.likedBy, target.dislikedBy);
  const hasLiked = likedBy.includes(reactorKey);
  const hasDisliked = dislikedBy.includes(reactorKey);

  if (hasLiked) {
    showMessage("You already liked this comment.");
    return;
  }

  const nextLikedBy = [...likedBy, reactorKey];
  const nextDislikedBy = dislikedBy.filter((key) => key !== reactorKey);

  const nextComment = {
    ...target,
    likedBy: nextLikedBy,
    dislikedBy: nextDislikedBy,
    likeCount: nextLikedBy.length,
    dislikeCount: nextDislikedBy.length,
  };

  storedComments = [
    ...storedComments.slice(0, targetIndex),
    nextComment,
    ...storedComments.slice(targetIndex + 1),
  ];
  saveComments(storedComments);
  renderComments();
  showMessage(hasDisliked ? "Comment changed to like." : "Comment liked.");
}

function toggleCommentDislike(commentId) {
  if (!commentId) {
    return;
  }

  const reactorKey = getCurrentReactorKey();
  const targetIndex = storedComments.findIndex((comment) => comment.id === commentId);
  if (targetIndex === -1) {
    return;
  }

  const target = storedComments[targetIndex];
  const { likedBy, dislikedBy } = normalizeVoteLists(target.likedBy, target.dislikedBy);
  const hasLiked = likedBy.includes(reactorKey);
  const hasDisliked = dislikedBy.includes(reactorKey);

  if (hasDisliked) {
    showMessage("You already disliked this comment.");
    return;
  }

  const nextDislikedBy = [...dislikedBy, reactorKey];
  const nextLikedBy = likedBy.filter((key) => key !== reactorKey);

  const nextComment = {
    ...target,
    dislikedBy: nextDislikedBy,
    likedBy: nextLikedBy,
    likeCount: nextLikedBy.length,
    dislikeCount: nextDislikedBy.length,
  };

  storedComments = [
    ...storedComments.slice(0, targetIndex),
    nextComment,
    ...storedComments.slice(targetIndex + 1),
  ];
  saveComments(storedComments);
  renderComments();
  showMessage(hasLiked ? "Comment changed to dislike." : "Comment disliked.");
}

function toggleReplyLike(commentId, replyId) {
  if (!commentId || !replyId) {
    return;
  }

  const reactorKey = getCurrentReactorKey();
  const targetIndex = storedComments.findIndex((comment) => comment.id === commentId);
  if (targetIndex === -1) {
    return;
  }

  const target = storedComments[targetIndex];
  const replies = Array.isArray(target.replies) ? target.replies : [];
  const replyIndex = replies.findIndex((reply) => reply.id === replyId);
  if (replyIndex === -1) {
    return;
  }

  const reply = replies[replyIndex];
  const { likedBy, dislikedBy } = normalizeVoteLists(reply.likedBy, reply.dislikedBy);
  const hasLiked = likedBy.includes(reactorKey);
  const hasDisliked = dislikedBy.includes(reactorKey);

  if (hasLiked) {
    showMessage("You already liked this reply.");
    return;
  }

  const nextLikedBy = [...likedBy, reactorKey];
  const nextDislikedBy = dislikedBy.filter((id) => id !== reactorKey);

  const nextReply = {
    ...reply,
    likedBy: nextLikedBy,
    dislikedBy: nextDislikedBy,
    likeCount: nextLikedBy.length,
    dislikeCount: nextDislikedBy.length,
  };

  const nextReplies = [
    ...replies.slice(0, replyIndex),
    nextReply,
    ...replies.slice(replyIndex + 1),
  ];

  const nextComment = {
    ...target,
    replies: nextReplies,
  };

  storedComments = [
    ...storedComments.slice(0, targetIndex),
    nextComment,
    ...storedComments.slice(targetIndex + 1),
  ];

  saveComments(storedComments);
  renderComments();
  showMessage(hasDisliked ? "Reply changed to like." : "Reply liked.");
}

function toggleReplyDislike(commentId, replyId) {
  if (!commentId || !replyId) {
    return;
  }

  const commentIndex = storedComments.findIndex((comment) => comment.id === commentId);
  if (commentIndex === -1) {
    return;
  }

  const comment = storedComments[commentIndex];
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  const replyIndex = replies.findIndex((reply) => reply.id === replyId);
  if (replyIndex === -1) {
    return;
  }

  const reactorKey = getCurrentReactorKey();
  const reply = replies[replyIndex];
  const { likedBy, dislikedBy } = normalizeVoteLists(reply.likedBy, reply.dislikedBy);
  const hasLiked = likedBy.includes(reactorKey);
  const hasDisliked = dislikedBy.includes(reactorKey);

  if (hasDisliked) {
    showMessage("You already disliked this reply.");
    return;
  }

  const nextDislikedBy = [...dislikedBy, reactorKey];
  const nextLikedBy = likedBy.filter((id) => id !== reactorKey);

  const nextReplies = [...replies];
  nextReplies[replyIndex] = {
    ...reply,
    dislikedBy: nextDislikedBy,
    likedBy: nextLikedBy,
    likeCount: nextLikedBy.length,
    dislikeCount: nextDislikedBy.length,
  };

  storedComments[commentIndex] = {
    ...comment,
    replies: nextReplies,
  };

  saveComments(storedComments);
  renderComments();
  showMessage(hasLiked ? "Reply changed to dislike." : "Reply disliked.");
}

function postReply(commentId, text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    showMessage("Write a reply first.");
    return;
  }

  if (cleanText.length > MAX_REPLY_LENGTH) {
    showMessage(`Reply is too long. Max ${MAX_REPLY_LENGTH} characters.`);
    return;
  }

  const targetIndex = storedComments.findIndex((comment) => comment.id === commentId);
  if (targetIndex === -1) {
    return;
  }

  const target = storedComments[targetIndex];
  const nextReplies = [
    ...(Array.isArray(target.replies) ? target.replies : []),
    {
      id: `r-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: cleanText,
      authorName: getCurrentUserName(),
      createdAt: Date.now(),
      likedBy: [],
      likeCount: 0,
    },
  ].slice(-100);

  const nextComment = {
    ...target,
    replies: nextReplies,
  };

  storedComments = [
    ...storedComments.slice(0, targetIndex),
    nextComment,
    ...storedComments.slice(targetIndex + 1),
  ];

  saveComments(storedComments);
  renderComments();
  showMessage("Reply posted.");
}

function deleteReply(commentId, replyId) {
  const targetIndex = storedComments.findIndex((comment) => comment.id === commentId);
  if (targetIndex === -1) {
    return;
  }

  const target = storedComments[targetIndex];
  const currentReplies = Array.isArray(target.replies) ? target.replies : [];
  const nextReplies = currentReplies.filter((reply) => reply.id !== replyId);
  if (nextReplies.length === currentReplies.length) {
    return;
  }

  const nextComment = {
    ...target,
    replies: nextReplies,
  };

  storedComments = [
    ...storedComments.slice(0, targetIndex),
    nextComment,
    ...storedComments.slice(targetIndex + 1),
  ];

  saveComments(storedComments);
  renderComments();
  showMessage("Reply removed.");
}

function buildReplyItem(commentId, reply) {
  const item = document.createElement("li");
  item.className = "comment-reply-item";
  item.dataset.replyId = reply.id;

  const head = document.createElement("div");
  head.className = "comment-reply-top";

  const meta = document.createElement("span");
  meta.className = "comment-reply-meta";
  meta.textContent = `${reply.authorName || "Member"} - ${formatCommentTime(reply.createdAt)}`;

  const removeButton = document.createElement("button");
  removeButton.className = "comment-reply-delete";
  removeButton.type = "button";
  removeButton.dataset.commentId = commentId;
  removeButton.dataset.replyId = reply.id;
  removeButton.setAttribute("aria-label", "Delete reply");
  removeButton.textContent = "Delete";

  const text = document.createElement("p");
  text.className = "comment-reply-text";
  text.textContent = reply.text;

  const reactorKey = getCurrentReactorKey();
  const { likedBy, dislikedBy } = normalizeVoteLists(reply.likedBy, reply.dislikedBy);
  const isLiked = likedBy.includes(reactorKey);
  const likeCount = normalizeLikeCount(reply.likeCount, likedBy);
  const isDisliked = dislikedBy.includes(reactorKey);
  const dislikeCount = normalizeDislikeCount(reply.dislikeCount, dislikedBy);

  const actions = document.createElement("div");
  actions.className = "comment-reply-actions";

  const likeButton = document.createElement("button");
  likeButton.className = "comment-reply-like-btn";
  if (isLiked) {
    likeButton.classList.add("active");
  }
  likeButton.type = "button";
  likeButton.dataset.action = "toggle-reply-like";
  likeButton.dataset.commentId = commentId;
  likeButton.dataset.replyId = reply.id;
  likeButton.setAttribute("aria-label", "Like this reply");
  likeButton.innerHTML = `
    <i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
    <span>${formatCompact(likeCount)}</span>
  `;

  const dislikeButton = document.createElement("button");
  dislikeButton.className = "comment-reply-dislike-btn";
  if (isDisliked) {
    dislikeButton.classList.add("active");
  }
  dislikeButton.type = "button";
  dislikeButton.dataset.action = "toggle-reply-dislike";
  dislikeButton.dataset.commentId = commentId;
  dislikeButton.dataset.replyId = reply.id;
  dislikeButton.setAttribute("aria-label", "Dislike this reply");
  dislikeButton.innerHTML = `
    <i class="${isDisliked ? "fa-solid" : "fa-regular"} fa-thumbs-down"></i>
    <span>${formatCompact(dislikeCount)}</span>
  `;

  const replyButton = document.createElement("button");
  replyButton.className = "comment-reply-reply-btn";
  replyButton.type = "button";
  replyButton.dataset.action = "reply-to-reply";
  replyButton.dataset.commentId = commentId;
  replyButton.dataset.replyAuthor = String(reply.authorName || "Member");
  replyButton.setAttribute("aria-label", "Reply to this reply");
  replyButton.innerHTML = `
    <i class="fa-solid fa-reply"></i>
    <span>Reply</span>
  `;

  head.append(meta, removeButton);
  actions.append(likeButton, dislikeButton, replyButton);
  item.append(head, text, actions);
  return item;
}

function buildCommentItem(comment) {
  const listItem = document.createElement("li");
  listItem.dataset.commentId = comment.id;

  const topRow = document.createElement("div");
  topRow.className = "comment-top";

  const meta = document.createElement("span");
  meta.className = "comment-meta";
  meta.textContent = `${comment.authorName || "Member"} - ${formatCommentTime(comment.createdAt)}`;

  const removeButton = document.createElement("button");
  removeButton.className = "comment-delete";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", "Delete comment");
  removeButton.textContent = "Delete";

  const content = document.createElement("p");
  content.className = "comment-text";
  content.textContent = comment.text;

  const reactorKey = getCurrentReactorKey();
  const likedBy = normalizeLikedBy(comment.likedBy);
  const isLiked = likedBy.includes(reactorKey);
  const likeCount = normalizeLikeCount(comment.likeCount, likedBy);
  const dislikedBy = normalizeLikedBy(comment.dislikedBy);
  const isDisliked = dislikedBy.includes(reactorKey);
  const dislikeCount = normalizeDislikeCount(comment.dislikeCount, dislikedBy);

  const replyToggleButton = document.createElement("button");
  replyToggleButton.className = "comment-reply-toggle";
  replyToggleButton.type = "button";
  replyToggleButton.dataset.action = "toggle-reply-box";
  replyToggleButton.dataset.commentId = comment.id;
  replyToggleButton.setAttribute("aria-label", "Reply to comment");
  replyToggleButton.innerHTML = `
    <i class="fa-solid fa-reply"></i>
    <span class="reply-label">Reply</span>
  `;

  const commentLikeButton = document.createElement("button");
  commentLikeButton.className = "comment-like-btn";
  if (isLiked) commentLikeButton.classList.add("active");
  commentLikeButton.type = "button";
  commentLikeButton.dataset.action = "toggle-comment-like";
  commentLikeButton.dataset.commentId = comment.id;
  commentLikeButton.setAttribute("aria-label", "Like this comment");
  commentLikeButton.innerHTML = `
    <i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
    <span>${formatCompact(likeCount)}</span>
  `;

  const commentDislikeButton = document.createElement("button");
  commentDislikeButton.className = "comment-dislike-btn";
  if (isDisliked) commentDislikeButton.classList.add("active");
  commentDislikeButton.type = "button";
  commentDislikeButton.dataset.action = "toggle-comment-dislike";
  commentDislikeButton.dataset.commentId = comment.id;
  commentDislikeButton.setAttribute("aria-label", "Dislike this comment");
  commentDislikeButton.innerHTML = `
    <i class="${isDisliked ? "fa-solid" : "fa-regular"} fa-thumbs-down"></i>
    <span>${formatCompact(dislikeCount)}</span>
  `;

  const actionRow = document.createElement("div");
  actionRow.className = "comment-action-row";
  actionRow.append(commentLikeButton, commentDislikeButton, replyToggleButton);

  const topActions = document.createElement("div");
  topActions.className = "comment-top-actions";
  topActions.append(removeButton);

  const replyForm = document.createElement("div");
  replyForm.className = "comment-reply-form-wrap";

  const replyInputRow = document.createElement("div");
  replyInputRow.className = "comment-reply-input-row";

  const replyInput = document.createElement("input");
  replyInput.className = "comment-reply-input";
  replyInput.type = "text";
  replyInput.maxLength = MAX_REPLY_LENGTH;
  replyInput.placeholder = "Write a reply...";

  const replyPostButton = document.createElement("button");
  replyPostButton.className = "comment-reply-post";
  replyPostButton.type = "button";
  replyPostButton.dataset.action = "post-reply";
  replyPostButton.dataset.commentId = comment.id;
  replyPostButton.textContent = "Reply";

  replyInputRow.append(replyInput, replyPostButton);
  replyForm.append(replyInputRow);

  const replyList = document.createElement("ul");
  replyList.className = "comment-reply-list";
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  replies.forEach((reply, index) => {
    const replyItem = buildReplyItem(comment.id, reply);
    if (index > 0) {
      replyItem.classList.add("reply-extra");
    }
    replyList.append(replyItem);
  });

  const repliesToggleWrap = document.createElement("div");
  repliesToggleWrap.className = "comment-replies-toggle-wrap";

  if (replies.length > 1) {
    const hiddenCount = replies.length - 1;
    const repliesToggleButton = document.createElement("button");
    repliesToggleButton.className = "comment-replies-toggle";
    repliesToggleButton.type = "button";
    repliesToggleButton.dataset.action = "toggle-more-replies";
    repliesToggleButton.dataset.commentId = comment.id;
    repliesToggleButton.dataset.hiddenCount = String(hiddenCount);
    repliesToggleButton.setAttribute("aria-label", `View ${hiddenCount} more replies`);
    repliesToggleButton.innerHTML = `
      <i class="fa-solid fa-angle-down"></i>
      <span>View more (${hiddenCount})</span>
    `;
    repliesToggleWrap.append(repliesToggleButton);
  }

  topRow.append(meta, topActions);
  listItem.append(topRow, content);
  listItem.append(actionRow, replyForm, replyList, repliesToggleWrap);
  return listItem;
}

let storedComments = loadComments();

function renderComments() {
  if (!commentList) {
    return;
  }

  syncSidebarHeightToVideo();

  const totalLabel = document.getElementById(COMMENTS_TOTAL_LABEL_ID);
  if (totalLabel) {
    totalLabel.textContent = `${formatCompact(storedComments.length)} comments`;
  }

  commentList.innerHTML = "";

  if (storedComments.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "comment-empty";
    emptyItem.textContent = "No new comments yet.";
    commentList.append(emptyItem);
  } else {
    const visibleComments = showAllComments
      ? storedComments
      : storedComments.slice(0, COMMENT_PREVIEW_LIMIT);

    visibleComments.forEach((comment) => {
      commentList.append(buildCommentItem(comment));
    });

    if (storedComments.length > COMMENT_PREVIEW_LIMIT) {
      const hiddenCount = Math.max(storedComments.length - COMMENT_PREVIEW_LIMIT, 0);
      const toggleItem = document.createElement("li");
      toggleItem.className = "comment-more-item";

      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "comment-more-btn";
      toggleButton.dataset.action = "toggle-more-comments";
      toggleButton.dataset.hiddenCount = String(hiddenCount);
      toggleButton.setAttribute(
        "aria-label",
        showAllComments
          ? "Show fewer comments"
          : `View ${hiddenCount} more comments`
      );

      toggleButton.innerHTML = showAllComments
        ? `<i class="fa-solid fa-angle-up"></i><span>View less</span>`
        : `<i class="fa-solid fa-angle-down"></i><span>View more (${hiddenCount})</span>`;

      toggleItem.append(toggleButton);
      commentList.append(toggleItem);
    }
  }

  setCommentCount(getCommentBaseCount(), getTotalCommentUnits(storedComments));
  window.requestAnimationFrame(updateCommentScrollControls);
}

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    siteNav.classList.toggle("open");
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (!siteNav.classList.contains("open")) {
        return;
      }
      siteNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

if (siteHeader) {
  const setHeaderState = () => {
    siteHeader.classList.toggle("scrolled", window.scrollY > 10);
  };

  setHeaderState();
  window.addEventListener("scroll", setHeaderState);
}

if (likeBtn && likeCount) {
  likeBtn.addEventListener("click", () => {
    likeBtn.classList.add("active");
    updateCounter(likeCount, 1);
    showMessage("Thanks for liking this message.");
  });
}

if (shareBtn && shareCount) {
  shareBtn.addEventListener("click", async () => {
    const videoUrl = getVideoShareUrl();
    const shareData = {
      title: "Harvest Nation International",
      text: "Watch this worship message.",
      url: videoUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        shareBtn.classList.add("active");
        updateCounter(shareCount, 1);
        showMessage("Video shared successfully.");
        return;
      } catch (error) {
        if (error && error.name === "AbortError") {
          showMessage("Share canceled.");
          return;
        }
      }
    }

    const copied = await copyLinkFallback(videoUrl);
    if (copied) {
      shareBtn.classList.add("active");
      updateCounter(shareCount, 1);
      showMessage("Video link copied. You can now paste and share.");
      return;
    }

    showMessage("Unable to share automatically on this device.");
  });
}

if (commentBtn && commentInput) {
  commentBtn.addEventListener("click", () => {
    commentBtn.classList.add("active");
    window.clearTimeout(commentBtn.timerId);
    commentBtn.timerId = window.setTimeout(() => {
      commentBtn.classList.remove("active");
    }, 900);
    commentInput.focus();
    commentInput.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function postComment() {
  if (!commentInput || !commentList) {
    return;
  }

  const text = commentInput.value.trim();
  if (!text) {
    showMessage("Write a comment first.");
    commentInput.focus();
    return;
  }

  if (text.length > MAX_COMMENT_LENGTH) {
    showMessage(`Comment is too long. Max ${MAX_COMMENT_LENGTH} characters.`);
    return;
  }

  const newComment = {
    id: `c-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    authorName: getCurrentUserName(),
    createdAt: Date.now(),
    reactions: {},
    userReactions: {},
    replies: [],
    likedBy: [],
    likeCount: 0,
    dislikedBy: [],
    dislikeCount: 0,
  };

  storedComments = [...storedComments, newComment].slice(-100);
  saveComments(storedComments);
  showAllComments = false;
  renderComments();
  commentInput.value = "";
  showMessage("Comment posted.");
}

if (postCommentBtn) {
  postCommentBtn.addEventListener("click", postComment);
}

if (commentInput) {
  commentInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      postComment();
    }
  });
}

if (commentEmojiToggle) {
  commentEmojiToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!canUseCompactCommentEmojiPicker()) {
      return;
    }

    const isOpen = commentsSection?.classList.contains("show-emoji-picker");
    setCommentEmojiPickerOpen(!isOpen);
  });
}

if (commentList) {
  commentList.addEventListener("scroll", updateCommentScrollControls);

  commentList.addEventListener("click", (event) => {
    const toggleMoreCommentsButton = event.target.closest("[data-action='toggle-more-comments']");
    if (toggleMoreCommentsButton) {
      showAllComments = !showAllComments;
      renderComments();
      window.requestAnimationFrame(syncSidebarHeightToVideo);
      return;
    }

    const toggleReplyButton = event.target.closest("[data-action='toggle-reply-box']");
    if (toggleReplyButton) {
      const commentItem = toggleReplyButton.closest("li[data-comment-id]");
      if (!commentItem) {
        return;
      }

      commentList.querySelectorAll("li[data-comment-id].show-reply-box").forEach((item) => {
        if (item !== commentItem) {
          item.classList.remove("show-reply-box");
          item.classList.remove("show-inline-reaction-picker");
        }
      });

      commentItem.classList.toggle("show-reply-box");
      if (commentItem.classList.contains("show-reply-box")) {
        const input = commentItem.querySelector(".comment-reply-input");
        input?.focus();
      } else {
        commentItem.classList.remove("show-inline-reaction-picker");
      }
      window.requestAnimationFrame(updateCommentScrollControls);
      return;
    }

    const postReplyButton = event.target.closest("[data-action='post-reply']");
    if (postReplyButton) {
      const commentId = String(postReplyButton.dataset.commentId || "").trim();
      const commentItem = postReplyButton.closest("li[data-comment-id]");
      const input = commentItem?.querySelector(".comment-reply-input");
      const replyText = String(input?.value || "");
      postReply(commentId, replyText);
      return;
    }

    const toggleMoreRepliesButton = event.target.closest("[data-action='toggle-more-replies']");
    if (toggleMoreRepliesButton) {
      const commentItem = toggleMoreRepliesButton.closest("li[data-comment-id]");
      if (!commentItem) {
        return;
      }

      const hiddenCount = Number(toggleMoreRepliesButton.dataset.hiddenCount || "0");
      const isExpanded = commentItem.classList.toggle("show-all-replies");
      const label = toggleMoreRepliesButton.querySelector("span");
      const icon = toggleMoreRepliesButton.querySelector("i");
      if (label) {
        label.textContent = isExpanded ? "View less" : `View more (${hiddenCount})`;
      }
      if (icon) {
        icon.classList.toggle("fa-angle-down", !isExpanded);
        icon.classList.toggle("fa-angle-up", isExpanded);
      }
      window.requestAnimationFrame(updateCommentScrollControls);
      return;
    }

    const commentLikeButton = event.target.closest("[data-action='toggle-comment-like']");
    if (commentLikeButton) {
      const commentId = String(commentLikeButton.dataset.commentId || "").trim();
      toggleCommentLike(commentId);
      return;
    }

    const commentDislikeButton = event.target.closest("[data-action='toggle-comment-dislike']");
    if (commentDislikeButton) {
      const commentId = String(commentDislikeButton.dataset.commentId || "").trim();
      toggleCommentDislike(commentId);
      return;
    }

    const replyLikeButton = event.target.closest("[data-action='toggle-reply-like']");
    if (replyLikeButton) {
      const commentId = String(replyLikeButton.dataset.commentId || "").trim();
      const replyId = String(replyLikeButton.dataset.replyId || "").trim();
      toggleReplyLike(commentId, replyId);
      return;
    }

    const replyDislikeButton = event.target.closest("[data-action='toggle-reply-dislike']");
    if (replyDislikeButton) {
      const commentId = String(replyDislikeButton.dataset.commentId || "").trim();
      const replyId = String(replyDislikeButton.dataset.replyId || "").trim();
      toggleReplyDislike(commentId, replyId);
      return;
    }

    const replyToReplyButton = event.target.closest("[data-action='reply-to-reply']");
    if (replyToReplyButton) {
      const commentId = String(replyToReplyButton.dataset.commentId || "").trim();
      const replyAuthor = String(replyToReplyButton.dataset.replyAuthor || "Member").trim();
      if (!commentId) {
        return;
      }

      const commentItem = Array.from(commentList.querySelectorAll("li[data-comment-id]")).find(
        (item) => String(item.dataset.commentId || "") === commentId
      );
      if (!commentItem) {
        return;
      }

      commentList.querySelectorAll("li[data-comment-id].show-reply-box").forEach((item) => {
        if (item !== commentItem) {
          item.classList.remove("show-reply-box");
          item.classList.remove("show-inline-reaction-picker");
        }
      });

      commentItem.classList.add("show-reply-box");
      commentItem.classList.remove("show-inline-reaction-picker");

      const input = commentItem.querySelector(".comment-reply-input");
      if (input) {
        const mentionPrefix = `@${replyAuthor} `;
        const currentText = String(input.value || "").trim();
        if (!currentText.startsWith(`@${replyAuthor}`)) {
          input.value = mentionPrefix;
        }
        input.focus();
        const caret = input.value.length;
        input.setSelectionRange(caret, caret);
      }

      window.requestAnimationFrame(updateCommentScrollControls);
      showMessage(`Replying to ${replyAuthor}.`);
      return;
    }

    const deleteReplyButton = event.target.closest(".comment-reply-delete");
    if (deleteReplyButton) {
      const commentId = String(deleteReplyButton.dataset.commentId || "").trim();
      const replyId = String(deleteReplyButton.dataset.replyId || "").trim();
      if (!commentId || !replyId) {
        return;
      }
      deleteReply(commentId, replyId);
      return;
    }

    const toggleInlineReactionButton = event.target.closest("[data-action='toggle-inline-reaction-picker']");
    if (toggleInlineReactionButton) {
      const commentItem = toggleInlineReactionButton.closest("li[data-comment-id]");
      if (!commentItem) {
        return;
      }

      commentList.querySelectorAll("li[data-comment-id].show-inline-reaction-picker").forEach((item) => {
        if (item !== commentItem) {
          item.classList.remove("show-inline-reaction-picker");
        }
      });

      commentItem.classList.add("show-reply-box");
      commentItem.classList.toggle("show-inline-reaction-picker");
      return;
    }

    const inlineReactionButton = event.target.closest(".comment-inline-reaction-btn");
    if (inlineReactionButton) {
      const commentId = String(inlineReactionButton.dataset.commentId || "").trim();
      const emoji = String(inlineReactionButton.dataset.commentReaction || "");
      updateCommentReaction(commentId, emoji);
      return;
    }

    const deleteButton = event.target.closest(".comment-delete");
    if (!deleteButton) {
      return;
    }

    const commentItem = deleteButton.closest("li");
    const commentId = commentItem?.dataset.commentId;
    if (!commentId) {
      return;
    }

    storedComments = storedComments.filter((comment) => comment.id !== commentId);
    saveComments(storedComments);
    renderComments();
    showMessage("Comment removed.");
  });

  commentList.addEventListener("keydown", (event) => {
    const replyInput = event.target.closest(".comment-reply-input");
    if (!replyInput || event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const commentItem = replyInput.closest("li[data-comment-id]");
    const commentId = String(commentItem?.dataset.commentId || "").trim();
    postReply(commentId, replyInput.value);
  });
}

if (commentScrollUpBtn && commentList) {
  commentScrollUpBtn.addEventListener("click", () => {
    commentList.scrollTo({ top: 0, behavior: "smooth" });
  });
}

if (commentScrollDownBtn && commentList) {
  commentScrollDownBtn.addEventListener("click", () => {
    commentList.scrollTo({ top: commentList.scrollHeight, behavior: "smooth" });
  });
}

document.addEventListener("click", (event) => {
  if (commentList && commentList.querySelector("li.show-inline-reaction-picker")) {
    if (!event.target.closest("#comment-list")) {
      commentList.querySelectorAll("li.show-inline-reaction-picker").forEach((item) => {
        item.classList.remove("show-inline-reaction-picker");
      });
    }
  }

  if (
    commentsSection?.classList.contains("show-emoji-picker") &&
    !event.target.closest("#comment-emoji-toggle") &&
    !event.target.closest("#comments-emoji-bar")
  ) {
    setCommentEmojiPickerOpen(false);
  }
});

window.addEventListener("resize", () => {
  if (!canUseCompactCommentEmojiPicker()) {
    setCommentEmojiPickerOpen(false);
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === WEEKLY_CONTENT_STORAGE_KEY) {
    renderWeeklyContent();
    return;
  }

  if (event.key === VIDEO_STORAGE_KEY || event.key === ACTIVE_VIDEO_KEY) {
    applyActiveVideo();
    return;
  }

  if (event.key === COMMENTS_STORAGE_KEY) {
    storedComments = loadComments();
    renderComments();
  }
});

emojiButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const emoji = button.dataset.emoji || "";
    if (emoji && commentInput) {
      insertEmojiIntoComment(emoji);
      setCommentEmojiPickerOpen(false);
      showMessage("Emoji added to your comment.");
      return;
    }

    const reaction = button.getAttribute("aria-label") || "Reaction sent";
    showMessage(`${reaction} added.`);
  });
});

if (chatFloat) {
  chatFloat.addEventListener("click", (event) => {
    if (String(chatFloat.tagName || "").toLowerCase() === "a") {
      return;
    }

    event.preventDefault();
    window.location.href = "chat.html";
  });
}

if (downloadToggleBtn && downloadOptions) {
  setDownloadMenuOpen(false);

  downloadToggleBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDownloadMenuOpen(downloadOptions.hidden);
  });

  if (downloadMp4Btn) {
    downloadMp4Btn.addEventListener("click", async (event) => {
      event.preventDefault();
      await triggerMediaDownload("mp4");
      setDownloadMenuOpen(false);
    });
  }

  if (downloadMp3Btn) {
    downloadMp3Btn.addEventListener("click", async (event) => {
      event.preventDefault();
      await triggerMediaDownload("mp3");
      setDownloadMenuOpen(false);
    });
  }

  document.addEventListener("click", (event) => {
    if (!downloadMenu || downloadMenu.contains(event.target)) {
      return;
    }
    setDownloadMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setDownloadMenuOpen(false);
    }
  });
}

if (enlargeVideoBtn) {
  enlargeVideoBtn.addEventListener("click", async () => {
    try {
      const fullscreenElement = getFullscreenElement();
      if (fullscreenElement) {
        await exitFullscreenMode();
        return;
      }

      const target = getVideoFullscreenTarget();
      if (!target) {
        showMessage("No active video to enlarge.");
        return;
      }

      await requestElementFullscreen(target);
    } catch {
      showMessage("Fullscreen is not available on this device.");
    } finally {
      updateEnlargeButtonState();
    }
  });

  document.addEventListener("fullscreenchange", updateEnlargeButtonState);
  document.addEventListener("webkitfullscreenchange", updateEnlargeButtonState);
  document.addEventListener("MSFullscreenChange", updateEnlargeButtonState);
  document.addEventListener("fullscreenchange", syncSidebarHeightToVideo);
  document.addEventListener("webkitfullscreenchange", syncSidebarHeightToVideo);
  document.addEventListener("MSFullscreenChange", syncSidebarHeightToVideo);
  updateEnlargeButtonState();
}

window.addEventListener("resize", syncSidebarHeightToVideo);
window.addEventListener("resize", () => {
  window.requestAnimationFrame(updateCommentScrollControls);
});

applyActiveVideo();
renderWeeklyContent();
window.requestAnimationFrame(syncSidebarHeightToVideo);

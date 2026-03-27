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
const lessonCommentsTotalLabel = document.querySelector("#lesson-comments-total-label");
const lessonCommentInput = document.querySelector("#lesson-video-comment");
const lessonPostCommentBtn = document.querySelector("#lesson-post-comment-btn");
const lessonEmojiButtons = document.querySelectorAll("[data-lesson-emoji]");
const lessonsUserName = document.querySelector("#lessons-user-name");
const lessonsLogoutBtn = document.querySelector("#lessons-logout-btn");
const liveMessage = document.querySelector("#lessons-live-message");

const COMMENTS_STORAGE_KEY = "hni_mainpage_comments_v1";
const VIDEO_STORAGE_KEY = "hni_video_playlist_v1";
const ACTIVE_VIDEO_KEY = "hni_active_video_id_v1";
const WEEKLY_CONTENT_STORAGE_KEY = "hni_weekly_content_v1";
const CURRENT_USER_KEY = "hni_current_user";
const LESSONS_VIDEO_PREVIEW_LIMIT = 5;
const MAX_COMMENT_LENGTH = 220;
const MAX_REPLY_LENGTH = 220;

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
let lessonStoredComments = [];

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

function getCurrentUserName() {
  return getDisplayName(getCurrentUserRecord()) || "Member";
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

  return "member";
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

function normalizeLessonReplies(rawReplies) {
  if (!Array.isArray(rawReplies)) {
    return [];
  }

  return rawReplies
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => {
      const { likedBy, dislikedBy } = normalizeVoteLists(item.likedBy, item.dislikedBy);
      return {
        id: String(item.id || `lesson-reply-${Date.now()}-${Math.random().toString(16).slice(2)}`),
        authorName: getCommentAuthorName(item),
        text: cleanWeeklyText(item.text, MAX_REPLY_LENGTH),
        createdAt: normalizeCommentTimestamp(item.createdAt),
        likedBy,
        likeCount: normalizeLikeCount(item.likeCount ?? item.likes, likedBy),
        dislikedBy,
        dislikeCount: normalizeDislikeCount(item.dislikeCount ?? item.dislikes, dislikedBy),
      };
    })
    .filter((item) => item.text)
    .slice(-100);
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

function normalizeLessonCommentCollection(rawItems, videoId = "") {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => {
      const { likedBy, dislikedBy } = normalizeVoteLists(item.likedBy, item.dislikedBy);
      return {
        id: String(item.id || `lesson-comment-${Date.now()}-${Math.random().toString(16).slice(2)}`),
        videoId: String(item.videoId || videoId || "").trim(),
        authorName: getCommentAuthorName(item),
        text: cleanWeeklyText(item.text, MAX_COMMENT_LENGTH),
        createdAt: normalizeCommentTimestamp(item.createdAt),
        reactions:
          item.reactions && typeof item.reactions === "object" && !Array.isArray(item.reactions)
            ? item.reactions
            : {},
        userReactions:
          item.userReactions && typeof item.userReactions === "object" && !Array.isArray(item.userReactions)
            ? item.userReactions
            : {},
        replies: normalizeLessonReplies(item.replies),
        likedBy,
        likeCount: normalizeLikeCount(item.likeCount ?? item.likes, likedBy),
        dislikedBy,
        dislikeCount: normalizeDislikeCount(item.dislikeCount ?? item.dislikes, dislikedBy),
      };
    })
    .filter((item) => item.text)
    .sort((a, b) => a.createdAt - b.createdAt);
}

function saveLessonCommentStore(store) {
  try {
    window.localStorage.setItem(
      COMMENTS_STORAGE_KEY,
      JSON.stringify({
        byVideo: store,
      })
    );
  } catch {
    // Ignore storage failures.
  }
}

function normalizeLessonCommentStore(rawValue) {
  if (Array.isArray(rawValue)) {
    const fallbackVideoId = getFallbackCommentVideoId();
    if (!fallbackVideoId) {
      return {};
    }

    return {
      [fallbackVideoId]: normalizeLessonCommentCollection(rawValue, fallbackVideoId),
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

    acc[cleanVideoId] = normalizeLessonCommentCollection(items, cleanVideoId);
    return acc;
  }, {});
}

function loadLessonCommentStore() {
  try {
    const raw = window.localStorage.getItem(COMMENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const normalized = normalizeLessonCommentStore(parsed);
    const shouldRewrite =
      !raw ||
      Array.isArray(parsed) ||
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.byVideo;

    if (shouldRewrite) {
      saveLessonCommentStore(normalized);
    }

    return normalized;
  } catch {
    return {};
  }
}

function loadLessonComments(videoId = getFallbackCommentVideoId()) {
  const cleanVideoId = String(videoId || "").trim();
  if (!cleanVideoId) {
    return [];
  }

  const store = loadLessonCommentStore();
  return Array.isArray(store[cleanVideoId]) ? store[cleanVideoId] : [];
}

function saveLessonComments(comments, videoId = getFallbackCommentVideoId()) {
  const cleanVideoId = String(videoId || "").trim();
  if (!cleanVideoId) {
    return;
  }

  const store = loadLessonCommentStore();
  store[cleanVideoId] = normalizeLessonCommentCollection(comments, cleanVideoId);
  saveLessonCommentStore(store);
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

function syncLessonCommentsFromStore() {
  lessonStoredComments = loadLessonComments(currentActiveVideo?.id);
  return lessonStoredComments;
}

function buildCommentMeta(authorName, createdAt) {
  const meta = document.createElement("div");
  meta.className = "comment-meta";

  const author = document.createElement("span");
  author.className = "comment-author";
  author.textContent = authorName || "Member";

  const time = document.createElement("span");
  time.className = "comment-date";
  time.textContent = formatCommentTime(createdAt);

  meta.append(author, time);
  return meta;
}

function buildLessonReplyItem(commentId, reply) {
  const item = document.createElement("li");
  item.className = "comment-reply-item";
  item.dataset.replyId = reply.id;

  const top = document.createElement("div");
  top.className = "comment-reply-top";

  const meta = document.createElement("span");
  meta.className = "comment-reply-meta";
  meta.textContent = `${reply.authorName || "Member"} - ${formatCommentTime(reply.createdAt)}`;

  const deleteButton = document.createElement("button");
  deleteButton.className = "comment-reply-delete";
  deleteButton.type = "button";
  deleteButton.dataset.commentId = commentId;
  deleteButton.dataset.replyId = reply.id;
  deleteButton.textContent = "Delete";

  const text = document.createElement("p");
  text.className = "comment-reply-text";
  text.textContent = reply.text;

  const reactorKey = getCurrentReactorKey();
  const { likedBy, dislikedBy } = normalizeVoteLists(reply.likedBy, reply.dislikedBy);
  const isLiked = likedBy.includes(reactorKey);
  const isDisliked = dislikedBy.includes(reactorKey);

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
  likeButton.innerHTML = `
    <i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
    <span>${formatCompact(normalizeLikeCount(reply.likeCount, likedBy))}</span>
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
  dislikeButton.innerHTML = `
    <i class="${isDisliked ? "fa-solid" : "fa-regular"} fa-thumbs-down"></i>
    <span>${formatCompact(normalizeDislikeCount(reply.dislikeCount, dislikedBy))}</span>
  `;

  const replyButton = document.createElement("button");
  replyButton.className = "comment-reply-reply-btn";
  replyButton.type = "button";
  replyButton.dataset.action = "reply-to-reply";
  replyButton.dataset.commentId = commentId;
  replyButton.dataset.replyAuthor = String(reply.authorName || "Member");
  replyButton.innerHTML = `
    <i class="fa-solid fa-reply"></i>
    <span>Reply</span>
  `;

  top.append(meta, deleteButton);
  actions.append(likeButton, dislikeButton, replyButton);
  item.append(top, text, actions);
  return item;
}

function buildLessonCommentItem(comment) {
  const item = document.createElement("li");
  item.dataset.commentId = comment.id;

  const top = document.createElement("div");
  top.className = "comment-top";

  const meta = buildCommentMeta(comment.authorName, comment.createdAt);

  const topActions = document.createElement("div");
  topActions.className = "comment-top-actions";

  const deleteButton = document.createElement("button");
  deleteButton.className = "comment-delete";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  topActions.append(deleteButton);

  const text = document.createElement("p");
  text.className = "comment-text";
  text.textContent = comment.text;

  const reactorKey = getCurrentReactorKey();
  const { likedBy, dislikedBy } = normalizeVoteLists(comment.likedBy, comment.dislikedBy);
  const isLiked = likedBy.includes(reactorKey);
  const isDisliked = dislikedBy.includes(reactorKey);

  const actionRow = document.createElement("div");
  actionRow.className = "comment-action-row";

  const likeButton = document.createElement("button");
  likeButton.className = "comment-like-btn";
  if (isLiked) {
    likeButton.classList.add("active");
  }
  likeButton.type = "button";
  likeButton.dataset.action = "toggle-comment-like";
  likeButton.dataset.commentId = comment.id;
  likeButton.innerHTML = `
    <i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
    <span>${formatCompact(normalizeLikeCount(comment.likeCount, likedBy))}</span>
  `;

  const dislikeButton = document.createElement("button");
  dislikeButton.className = "comment-dislike-btn";
  if (isDisliked) {
    dislikeButton.classList.add("active");
  }
  dislikeButton.type = "button";
  dislikeButton.dataset.action = "toggle-comment-dislike";
  dislikeButton.dataset.commentId = comment.id;
  dislikeButton.innerHTML = `
    <i class="${isDisliked ? "fa-solid" : "fa-regular"} fa-thumbs-down"></i>
    <span>${formatCompact(normalizeDislikeCount(comment.dislikeCount, dislikedBy))}</span>
  `;

  const replyToggleButton = document.createElement("button");
  replyToggleButton.className = "comment-reply-toggle";
  replyToggleButton.type = "button";
  replyToggleButton.dataset.action = "toggle-reply-box";
  replyToggleButton.dataset.commentId = comment.id;
  replyToggleButton.innerHTML = `
    <i class="fa-solid fa-reply"></i>
    <span class="reply-label">Reply</span>
  `;

  actionRow.append(likeButton, dislikeButton, replyToggleButton);

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
    const replyItem = buildLessonReplyItem(comment.id, reply);
    if (index > 0) {
      replyItem.classList.add("reply-extra");
    }
    replyList.append(replyItem);
  });

  const repliesToggleWrap = document.createElement("div");
  repliesToggleWrap.className = "comment-replies-toggle-wrap";
  if (replies.length > 1) {
    const hiddenCount = replies.length - 1;
    const toggleButton = document.createElement("button");
    toggleButton.className = "comment-replies-toggle";
    toggleButton.type = "button";
    toggleButton.dataset.action = "toggle-more-replies";
    toggleButton.dataset.commentId = comment.id;
    toggleButton.dataset.hiddenCount = String(hiddenCount);
    toggleButton.innerHTML = `
      <i class="fa-solid fa-angle-down"></i>
      <span>View more (${hiddenCount})</span>
    `;
    repliesToggleWrap.append(toggleButton);
  }

  top.append(meta, topActions);
  item.append(top, text, actionRow, replyForm, replyList, repliesToggleWrap);
  return item;
}

function renderLessonComments() {
  if (!lessonCommentsList) {
    return;
  }

  const comments = syncLessonCommentsFromStore();
  if (lessonCommentsTotalLabel) {
    lessonCommentsTotalLabel.textContent = `${formatCompact(comments.length)} comments`;
  }

  lessonCommentsList.innerHTML = "";

  if (!comments.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "comment-empty";
    emptyItem.textContent = "No comments added yet for this lesson.";
    lessonCommentsList.append(emptyItem);
    return;
  }

  comments.forEach((comment) => {
    lessonCommentsList.append(buildLessonCommentItem(comment));
  });
}

function insertEmojiIntoLessonComment(emoji) {
  if (!lessonCommentInput || !emoji) {
    return;
  }

  const start = lessonCommentInput.selectionStart ?? lessonCommentInput.value.length;
  const end = lessonCommentInput.selectionEnd ?? lessonCommentInput.value.length;
  const before = lessonCommentInput.value.slice(0, start);
  const after = lessonCommentInput.value.slice(end);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  const prefix = needsSpaceBefore ? " " : "";
  const nextValue = `${before}${prefix}${emoji} ${after}`;

  lessonCommentInput.value = nextValue;
  const caret = before.length + prefix.length + emoji.length + 1;
  lessonCommentInput.focus();
  lessonCommentInput.setSelectionRange(caret, caret);
}

function postLessonComment() {
  if (!lessonCommentInput || !currentActiveVideo) {
    return;
  }

  const text = lessonCommentInput.value.trim();
  if (!text) {
    showMessage("Write a comment first.");
    lessonCommentInput.focus();
    return;
  }

  if (text.length > MAX_COMMENT_LENGTH) {
    showMessage(`Comment is too long. Max ${MAX_COMMENT_LENGTH} characters.`);
    return;
  }

  syncLessonCommentsFromStore();
  lessonStoredComments = [...lessonStoredComments, {
    id: `c-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    videoId: currentActiveVideo.id,
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
  }].slice(-100);

  saveLessonComments(lessonStoredComments, currentActiveVideo.id);
  renderLessonComments();
  lessonCommentInput.value = "";
  showMessage("Comment posted.");
}

function postLessonReply(commentId, text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    showMessage("Write a reply first.");
    return;
  }

  if (cleanText.length > MAX_REPLY_LENGTH) {
    showMessage(`Reply is too long. Max ${MAX_REPLY_LENGTH} characters.`);
    return;
  }

  syncLessonCommentsFromStore();
  const targetIndex = lessonStoredComments.findIndex((comment) => comment.id === commentId);
  if (targetIndex === -1) {
    return;
  }

  const target = lessonStoredComments[targetIndex];
  const nextReplies = [
    ...(Array.isArray(target.replies) ? target.replies : []),
    {
      id: `r-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: cleanText,
      authorName: getCurrentUserName(),
      createdAt: Date.now(),
      likedBy: [],
      likeCount: 0,
      dislikedBy: [],
      dislikeCount: 0,
    },
  ].slice(-100);

  lessonStoredComments = [
    ...lessonStoredComments.slice(0, targetIndex),
    {
      ...target,
      replies: nextReplies,
    },
    ...lessonStoredComments.slice(targetIndex + 1),
  ];

  saveLessonComments(lessonStoredComments, currentActiveVideo?.id);
  renderLessonComments();
  showMessage("Reply posted.");
}

function toggleLessonCommentLike(commentId) {
  syncLessonCommentsFromStore();
  const targetIndex = lessonStoredComments.findIndex((comment) => comment.id === commentId);
  if (targetIndex === -1) {
    return;
  }

  const reactorKey = getCurrentReactorKey();
  const target = lessonStoredComments[targetIndex];
  const { likedBy, dislikedBy } = normalizeVoteLists(target.likedBy, target.dislikedBy);
  const hasLiked = likedBy.includes(reactorKey);
  const hasDisliked = dislikedBy.includes(reactorKey);

  if (hasLiked) {
    showMessage("You already liked this comment.");
    return;
  }

  const nextLikedBy = [...likedBy, reactorKey];
  const nextDislikedBy = dislikedBy.filter((key) => key !== reactorKey);

  lessonStoredComments = [
    ...lessonStoredComments.slice(0, targetIndex),
    {
      ...target,
      likedBy: nextLikedBy,
      dislikedBy: nextDislikedBy,
      likeCount: nextLikedBy.length,
      dislikeCount: nextDislikedBy.length,
    },
    ...lessonStoredComments.slice(targetIndex + 1),
  ];

  saveLessonComments(lessonStoredComments, currentActiveVideo?.id);
  renderLessonComments();
  showMessage(hasDisliked ? "Comment changed to like." : "Comment liked.");
}

function toggleLessonCommentDislike(commentId) {
  syncLessonCommentsFromStore();
  const targetIndex = lessonStoredComments.findIndex((comment) => comment.id === commentId);
  if (targetIndex === -1) {
    return;
  }

  const reactorKey = getCurrentReactorKey();
  const target = lessonStoredComments[targetIndex];
  const { likedBy, dislikedBy } = normalizeVoteLists(target.likedBy, target.dislikedBy);
  const hasLiked = likedBy.includes(reactorKey);
  const hasDisliked = dislikedBy.includes(reactorKey);

  if (hasDisliked) {
    showMessage("You already disliked this comment.");
    return;
  }

  const nextDislikedBy = [...dislikedBy, reactorKey];
  const nextLikedBy = likedBy.filter((key) => key !== reactorKey);

  lessonStoredComments = [
    ...lessonStoredComments.slice(0, targetIndex),
    {
      ...target,
      dislikedBy: nextDislikedBy,
      likedBy: nextLikedBy,
      likeCount: nextLikedBy.length,
      dislikeCount: nextDislikedBy.length,
    },
    ...lessonStoredComments.slice(targetIndex + 1),
  ];

  saveLessonComments(lessonStoredComments, currentActiveVideo?.id);
  renderLessonComments();
  showMessage(hasLiked ? "Comment changed to dislike." : "Comment disliked.");
}

function toggleLessonReplyLike(commentId, replyId) {
  syncLessonCommentsFromStore();
  const commentIndex = lessonStoredComments.findIndex((comment) => comment.id === commentId);
  if (commentIndex === -1) {
    return;
  }

  const replies = Array.isArray(lessonStoredComments[commentIndex].replies)
    ? lessonStoredComments[commentIndex].replies
    : [];
  const replyIndex = replies.findIndex((reply) => reply.id === replyId);
  if (replyIndex === -1) {
    return;
  }

  const reactorKey = getCurrentReactorKey();
  const reply = replies[replyIndex];
  const { likedBy, dislikedBy } = normalizeVoteLists(reply.likedBy, reply.dislikedBy);
  const hasLiked = likedBy.includes(reactorKey);
  const hasDisliked = dislikedBy.includes(reactorKey);

  if (hasLiked) {
    showMessage("You already liked this reply.");
    return;
  }

  const nextLikedBy = [...likedBy, reactorKey];
  const nextDislikedBy = dislikedBy.filter((key) => key !== reactorKey);
  const nextReplies = [...replies];
  nextReplies[replyIndex] = {
    ...reply,
    likedBy: nextLikedBy,
    dislikedBy: nextDislikedBy,
    likeCount: nextLikedBy.length,
    dislikeCount: nextDislikedBy.length,
  };

  lessonStoredComments[commentIndex] = {
    ...lessonStoredComments[commentIndex],
    replies: nextReplies,
  };

  saveLessonComments(lessonStoredComments, currentActiveVideo?.id);
  renderLessonComments();
  showMessage(hasDisliked ? "Reply changed to like." : "Reply liked.");
}

function toggleLessonReplyDislike(commentId, replyId) {
  syncLessonCommentsFromStore();
  const commentIndex = lessonStoredComments.findIndex((comment) => comment.id === commentId);
  if (commentIndex === -1) {
    return;
  }

  const replies = Array.isArray(lessonStoredComments[commentIndex].replies)
    ? lessonStoredComments[commentIndex].replies
    : [];
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
  const nextLikedBy = likedBy.filter((key) => key !== reactorKey);
  const nextReplies = [...replies];
  nextReplies[replyIndex] = {
    ...reply,
    dislikedBy: nextDislikedBy,
    likedBy: nextLikedBy,
    likeCount: nextLikedBy.length,
    dislikeCount: nextDislikedBy.length,
  };

  lessonStoredComments[commentIndex] = {
    ...lessonStoredComments[commentIndex],
    replies: nextReplies,
  };

  saveLessonComments(lessonStoredComments, currentActiveVideo?.id);
  renderLessonComments();
  showMessage(hasLiked ? "Reply changed to dislike." : "Reply disliked.");
}

function deleteLessonComment(commentId) {
  syncLessonCommentsFromStore();
  const nextComments = lessonStoredComments.filter((comment) => comment.id !== commentId);
  if (nextComments.length === lessonStoredComments.length) {
    return;
  }

  lessonStoredComments = nextComments;
  saveLessonComments(lessonStoredComments, currentActiveVideo?.id);
  renderLessonComments();
  showMessage("Comment removed.");
}

function deleteLessonReply(commentId, replyId) {
  syncLessonCommentsFromStore();
  const commentIndex = lessonStoredComments.findIndex((comment) => comment.id === commentId);
  if (commentIndex === -1) {
    return;
  }

  const replies = Array.isArray(lessonStoredComments[commentIndex].replies)
    ? lessonStoredComments[commentIndex].replies
    : [];
  const nextReplies = replies.filter((reply) => reply.id !== replyId);
  if (nextReplies.length === replies.length) {
    return;
  }

  lessonStoredComments[commentIndex] = {
    ...lessonStoredComments[commentIndex],
    replies: nextReplies,
  };

  saveLessonComments(lessonStoredComments, currentActiveVideo?.id);
  renderLessonComments();
  showMessage("Reply removed.");
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
  lessonStoredComments = loadLessonComments(video.id);
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
    lessonStoredComments = [];
    renderLessonsSection();
    return;
  }
  currentActiveVideo = activeVideo;
  lessonStoredComments = loadLessonComments(activeVideo.id);
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

if (lessonPostCommentBtn) {
  lessonPostCommentBtn.addEventListener("click", postLessonComment);
}

if (lessonCommentInput) {
  lessonCommentInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      postLessonComment();
    }
  });
}

lessonEmojiButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const emoji = button.dataset.lessonEmoji || "";
    if (!emoji) {
      return;
    }

    insertEmojiIntoLessonComment(emoji);
    showMessage("Emoji added to your comment.");
  });
});

if (lessonCommentsList) {
  lessonCommentsList.addEventListener("click", (event) => {
    const toggleReplyButton = event.target.closest("[data-action='toggle-reply-box']");
    if (toggleReplyButton) {
      const commentItem = toggleReplyButton.closest("li[data-comment-id]");
      if (!commentItem) {
        return;
      }

      lessonCommentsList.querySelectorAll("li[data-comment-id].show-reply-box").forEach((item) => {
        if (item !== commentItem) {
          item.classList.remove("show-reply-box");
        }
      });

      commentItem.classList.toggle("show-reply-box");
      if (commentItem.classList.contains("show-reply-box")) {
        commentItem.querySelector(".comment-reply-input")?.focus();
      }
      return;
    }

    const postReplyButton = event.target.closest("[data-action='post-reply']");
    if (postReplyButton) {
      const commentId = String(postReplyButton.dataset.commentId || "").trim();
      const commentItem = postReplyButton.closest("li[data-comment-id]");
      const input = commentItem?.querySelector(".comment-reply-input");
      postLessonReply(commentId, String(input?.value || ""));
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
      return;
    }

    const commentLikeButton = event.target.closest("[data-action='toggle-comment-like']");
    if (commentLikeButton) {
      toggleLessonCommentLike(String(commentLikeButton.dataset.commentId || "").trim());
      return;
    }

    const commentDislikeButton = event.target.closest("[data-action='toggle-comment-dislike']");
    if (commentDislikeButton) {
      toggleLessonCommentDislike(String(commentDislikeButton.dataset.commentId || "").trim());
      return;
    }

    const replyLikeButton = event.target.closest("[data-action='toggle-reply-like']");
    if (replyLikeButton) {
      toggleLessonReplyLike(
        String(replyLikeButton.dataset.commentId || "").trim(),
        String(replyLikeButton.dataset.replyId || "").trim()
      );
      return;
    }

    const replyDislikeButton = event.target.closest("[data-action='toggle-reply-dislike']");
    if (replyDislikeButton) {
      toggleLessonReplyDislike(
        String(replyDislikeButton.dataset.commentId || "").trim(),
        String(replyDislikeButton.dataset.replyId || "").trim()
      );
      return;
    }

    const replyToReplyButton = event.target.closest("[data-action='reply-to-reply']");
    if (replyToReplyButton) {
      const commentId = String(replyToReplyButton.dataset.commentId || "").trim();
      const replyAuthor = String(replyToReplyButton.dataset.replyAuthor || "Member").trim();
      const commentItem = Array.from(lessonCommentsList.querySelectorAll("li[data-comment-id]")).find(
        (item) => String(item.dataset.commentId || "") === commentId
      );
      if (!commentItem) {
        return;
      }

      lessonCommentsList.querySelectorAll("li[data-comment-id].show-reply-box").forEach((item) => {
        if (item !== commentItem) {
          item.classList.remove("show-reply-box");
        }
      });

      commentItem.classList.add("show-reply-box");
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
      showMessage(`Replying to ${replyAuthor}.`);
      return;
    }

    const deleteReplyButton = event.target.closest(".comment-reply-delete");
    if (deleteReplyButton) {
      deleteLessonReply(
        String(deleteReplyButton.dataset.commentId || "").trim(),
        String(deleteReplyButton.dataset.replyId || "").trim()
      );
      return;
    }

    const deleteCommentButton = event.target.closest(".comment-delete");
    if (deleteCommentButton) {
      const commentItem = deleteCommentButton.closest("li[data-comment-id]");
      deleteLessonComment(String(commentItem?.dataset.commentId || "").trim());
    }
  });

  lessonCommentsList.addEventListener("keydown", (event) => {
    const replyInput = event.target.closest(".comment-reply-input");
    if (!replyInput || event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const commentItem = replyInput.closest("li[data-comment-id]");
    postLessonReply(String(commentItem?.dataset.commentId || "").trim(), replyInput.value);
  });
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

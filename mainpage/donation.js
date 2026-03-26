const menuToggle = document.querySelector("#menu-toggle");
const siteNav = document.querySelector("#site-nav");
const siteHeader = document.querySelector("#site-header");
const liveMessage = document.querySelector("#donation-live-message");
const CURRENT_USER_KEY = "hni_current_user";

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

const activeUser = enforceAuth();

function showMessage(message) {
  if (!liveMessage) {
    return;
  }

  liveMessage.textContent = message;
  liveMessage.classList.add("show");
  window.clearTimeout(showMessage.timerId);
  showMessage.timerId = window.setTimeout(() => {
    liveMessage.classList.remove("show");
  }, 1700);
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

if (activeUser) {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = String(button.dataset.copy || "").trim();
      if (!value) {
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        showMessage("Number copied.");
      } catch {
        showMessage("Copy failed on this device.");
      }
    });
  });
}

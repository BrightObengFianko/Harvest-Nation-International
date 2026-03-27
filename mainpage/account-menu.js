(() => {
  const CURRENT_USER_KEY = "hni_current_user";
  const ACCOUNT_PROFILE_STORAGE_KEY = "hni_account_profiles_v1";
  const authLinks = document.querySelector("#auth-links");
  const accountShell = document.querySelector("#account-shell");
  const accountToggle = document.querySelector("#account-toggle");
  const accountToggleImage = document.querySelector("#account-toggle-image");
  const accountToggleIcon = document.querySelector("#account-toggle-icon");
  const accountMenu = document.querySelector("#account-menu");
  const accountName = document.querySelector("#account-name");
  const accountEmail = document.querySelector("#account-email");
  const accountSignoutBtn = document.querySelector("#account-signout-btn");
  const accountAvatarBtn = document.querySelector("#account-avatar-btn");
  const accountAvatarInput = document.querySelector("#account-avatar-input");
  const accountAvatarImage = document.querySelector("#account-avatar-image");
  const accountAvatarIcon = document.querySelector("#account-avatar-icon");
  const accountPhotoBtn = document.querySelector("#account-photo-btn");
  const accountLogoutConfirm = document.querySelector("#account-logout-confirm");
  const accountLogoutYes = document.querySelector("#account-logout-yes");
  const accountLogoutNo = document.querySelector("#account-logout-no");
  const mobileAuthLinks = document.querySelector("#mobile-auth-links");
  const mobileAccountPanel = document.querySelector("#mobile-account-panel");
  const mobileAccountName = document.querySelector("#mobile-account-name");
  const mobileAccountEmail = document.querySelector("#mobile-account-email");
  const mobileAccountAvatarImage = document.querySelector("#mobile-account-avatar-image");
  const mobileAccountAvatarIcon = document.querySelector("#mobile-account-avatar-icon");
  const mobileAccountSignoutBtn = document.querySelector("#mobile-account-signout-btn");
  const mobileAccountLogoutConfirm = document.querySelector("#mobile-account-logout-confirm");
  const mobileAccountLogoutYes = document.querySelector("#mobile-account-logout-yes");
  const mobileAccountLogoutNo = document.querySelector("#mobile-account-logout-no");
  const adminNavLinks = Array.from(document.querySelectorAll("[data-admin-link='true']"));

  if (!authLinks && !accountShell) {
    return;
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

  function isAdminUser(user) {
    return (
      user &&
      typeof user === "object" &&
      (user.is_admin === true ||
        user.is_admin === 1 ||
        String(user.is_admin || "").trim() === "1" ||
        user.isAdmin === true)
    );
  }

  function buildLoginUrl() {
    if (window.location.origin && /^https?:$/i.test(String(window.location.protocol || ""))) {
      return `${window.location.origin}/bright/login.html`;
    }
    return new URL("../login.html", window.location.href).toString();
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

  function saveProfileStorage(storage) {
    try {
      window.localStorage.setItem(ACCOUNT_PROFILE_STORAGE_KEY, JSON.stringify(storage));
    } catch {
      if (typeof window.showMessage === "function") {
        window.showMessage("Profile image could not be saved.");
      }
    }
  }

  function getProfileKey(user) {
    const email = String(user?.email || "").trim().toLowerCase();
    if (email) {
      return email;
    }
    return String(user?.id || "").trim();
  }

  function hideLogoutConfirm() {
    if (accountLogoutConfirm) {
      accountLogoutConfirm.hidden = true;
    }
    if (mobileAccountLogoutConfirm) {
      mobileAccountLogoutConfirm.hidden = true;
    }
  }

  function showLogoutConfirm(target = "desktop") {
    hideLogoutConfirm();

    if (target === "mobile") {
      if (mobileAccountLogoutConfirm) {
        mobileAccountLogoutConfirm.hidden = false;
      }
      return;
    }

    if (accountLogoutConfirm) {
      accountLogoutConfirm.hidden = false;
    }
  }

  function applyProfileImage(user) {
    if (!accountAvatarImage || !accountAvatarIcon || !accountToggleImage || !accountToggleIcon) {
      return;
    }

    const key = getProfileKey(user);
    const storage = getProfileStorage();
    const profileImage = key ? String(storage[key] || "").trim() : "";

    if (profileImage) {
      accountAvatarImage.src = profileImage;
      accountAvatarImage.hidden = false;
      accountAvatarIcon.hidden = true;
      accountToggleImage.src = profileImage;
      accountToggleImage.hidden = false;
      accountToggleIcon.hidden = true;
      if (mobileAccountAvatarImage) {
        mobileAccountAvatarImage.src = profileImage;
        mobileAccountAvatarImage.hidden = false;
      }
      if (mobileAccountAvatarIcon) {
        mobileAccountAvatarIcon.hidden = true;
      }
      return;
    }

    accountAvatarImage.removeAttribute("src");
    accountAvatarImage.hidden = true;
    accountAvatarIcon.hidden = false;
    accountToggleImage.removeAttribute("src");
    accountToggleImage.hidden = true;
    accountToggleIcon.hidden = false;
    if (mobileAccountAvatarImage) {
      mobileAccountAvatarImage.removeAttribute("src");
      mobileAccountAvatarImage.hidden = true;
    }
    if (mobileAccountAvatarIcon) {
      mobileAccountAvatarIcon.hidden = false;
    }
  }

  function closeAccountMenu() {
    if (accountMenu) {
      accountMenu.hidden = true;
    }
    hideLogoutConfirm();
    if (accountToggle) {
      accountToggle.setAttribute("aria-expanded", "false");
    }
  }

  function openAccountMenu() {
    if (accountMenu) {
      accountMenu.hidden = false;
    }
    if (accountToggle) {
      accountToggle.setAttribute("aria-expanded", "true");
    }
  }

  function toggleAccountMenu() {
    if (!accountMenu) {
      return;
    }

    if (accountMenu.hidden) {
      openAccountMenu();
      return;
    }

    closeAccountMenu();
  }

  function renderAccountState() {
    const user = getCurrentUserRecord();
    const signedIn = isValidSignedInUser(user);
    const isAdmin = isAdminUser(user);

    if (authLinks) {
      authLinks.hidden = signedIn;
    }

    if (mobileAuthLinks) {
      mobileAuthLinks.hidden = signedIn;
    }

    if (accountShell) {
      accountShell.hidden = !signedIn;
    }

    if (mobileAccountPanel) {
      mobileAccountPanel.hidden = !signedIn;
    }

    adminNavLinks.forEach((link) => {
      link.hidden = !isAdmin;
    });

    if (!signedIn) {
      closeAccountMenu();
      return;
    }

    if (accountName) {
      accountName.textContent = getDisplayName(user);
    }

    if (accountEmail) {
      accountEmail.textContent = String(user.email || "No email address").trim() || "No email address";
    }

    if (mobileAccountName) {
      mobileAccountName.textContent = getDisplayName(user);
    }

    if (mobileAccountEmail) {
      mobileAccountEmail.textContent =
        String(user.email || "No email address").trim() || "No email address";
    }

    applyProfileImage(user);
  }

  if (accountToggle) {
    accountToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleAccountMenu();
    });
  }

  if (accountSignoutBtn) {
    accountSignoutBtn.addEventListener("click", () => {
      showLogoutConfirm("desktop");
    });
  }

  if (mobileAccountSignoutBtn) {
    mobileAccountSignoutBtn.addEventListener("click", () => {
      showLogoutConfirm("mobile");
    });
  }

  if (accountLogoutNo) {
    accountLogoutNo.addEventListener("click", () => {
      hideLogoutConfirm();
    });
  }

  if (mobileAccountLogoutNo) {
    mobileAccountLogoutNo.addEventListener("click", () => {
      hideLogoutConfirm();
    });
  }

  function performLogout() {
    window.localStorage.removeItem(CURRENT_USER_KEY);
    closeAccountMenu();
    renderAccountState();
    window.location.assign(buildLoginUrl());
  }

  if (accountLogoutYes) {
    accountLogoutYes.addEventListener("click", performLogout);
  }

  if (mobileAccountLogoutYes) {
    mobileAccountLogoutYes.addEventListener("click", performLogout);
  }

  if (accountAvatarBtn && accountAvatarInput) {
    accountAvatarBtn.addEventListener("click", () => {
      accountAvatarInput.click();
    });
  }

  if (accountPhotoBtn && accountAvatarInput) {
    accountPhotoBtn.addEventListener("click", () => {
      accountAvatarInput.click();
    });
  }

  if (accountAvatarInput) {
    accountAvatarInput.addEventListener("change", () => {
      const user = getCurrentUserRecord();
      const file = accountAvatarInput.files?.[0] || null;

      if (!isValidSignedInUser(user) || !file) {
        return;
      }

      if (!String(file.type || "").toLowerCase().startsWith("image/")) {
        if (typeof window.showMessage === "function") {
          window.showMessage("Choose an image file.");
        }
        accountAvatarInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        if (!result) {
          return;
        }

        const key = getProfileKey(user);
        if (!key) {
          return;
        }

        const storage = getProfileStorage();
        storage[key] = result;
        saveProfileStorage(storage);
        applyProfileImage(user);

        if (typeof window.showMessage === "function") {
          window.showMessage("Profile image updated.");
        }
      };
      reader.readAsDataURL(file);
      accountAvatarInput.value = "";
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target.closest("#account-shell")) {
      closeAccountMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAccountMenu();
    }
  });

  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === CURRENT_USER_KEY) {
      renderAccountState();
    }
  });

  renderAccountState();
})();

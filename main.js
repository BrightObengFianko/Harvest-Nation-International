document.addEventListener("DOMContentLoaded", function () {
  const API_BASE = String(window.HNI_API_BASE || "/api").trim() || "/api";
  const CURRENT_USER_KEY = "hni_current_user";
  const REMEMBERED_ACCOUNTS_KEY = "hni_remembered_accounts_v1";
  const MAINPAGE_ROOT_PATH = "/bright/mainpage/mainpage.html";

  function showMessage(container, message, type = "error") {
    if (!container) {
      return;
    }
    container.textContent = message;
    container.classList.remove("error", "success");
    container.classList.add(type);
  }

  function clearMessage(container) {
    if (!container) {
      return;
    }
    container.textContent = "";
    container.classList.remove("error", "success");
  }

  function showError(input) {
    if (!input) {
      return;
    }
    input.classList.add("input-error");
  }

  function clearError(input) {
    if (!input) {
      return;
    }
    input.classList.remove("input-error");
  }

  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => clearError(input));
  });

  const emailPattern = /^[^ ]+@[^ ]+\.[a-z]{2,}$/i;
  const authMainLink = document.querySelector("#auth-main-link");
  const authMainLinkLabel = authMainLink?.querySelector(".back-home-label") || null;

  function getDefaultRedirectUrl() {
    const protocol = String(window.location.protocol || "").toLowerCase();
    if (["http:", "https:"].includes(protocol) && window.location.origin) {
      return `${window.location.origin}${MAINPAGE_ROOT_PATH}`;
    }
    return new URL("./mainpage/mainpage.html", window.location.href).toString();
  }

  function getRedirectCandidates() {
    const candidates = [];
    const pushCandidate = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized || candidates.includes(normalized)) {
        return;
      }
      candidates.push(normalized);
    };

    pushCandidate(new URL("./mainpage/mainpage.html", window.location.href).toString());
    pushCandidate(getDefaultRedirectUrl());

    const protocol = String(window.location.protocol || "").toLowerCase();
    if (["http:", "https:"].includes(protocol)) {
      pushCandidate(`${window.location.origin}${MAINPAGE_ROOT_PATH}`);
    }

    return candidates;
  }

  function prepareMainPageLink(label = "Continue to Main Page") {
    if (!authMainLink) {
      return;
    }

    authMainLink.href = getDefaultRedirectUrl();
    authMainLink.classList.add("is-ready");

    if (authMainLinkLabel) {
      authMainLinkLabel.textContent = label;
    }
  }

  function performPostAuthRedirect() {
    const targetUrl = getDefaultRedirectUrl();
    window.location.replace(targetUrl);
  }

  function clearLegacyLocalAuthData() {
    try {
      window.localStorage.removeItem("hni_local_users_v1");
      window.localStorage.removeItem("hni_local_login_events_v1");
    } catch {
      // Ignore storage failures.
    }
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

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function loadRememberedAccounts() {
    try {
      const raw = window.localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
    } catch {
      return [];
    }
  }

  function saveRememberedAccounts(accounts) {
    try {
      window.localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      // Ignore storage failures.
    }
  }

  function rememberAccount(user) {
    const email = normalizeEmail(user?.email);
    if (!email) {
      return;
    }

    const currentAccounts = loadRememberedAccounts();
    const nextAccounts = [
      {
        email,
        fullname: String(user?.fullname || "").trim(),
        updated_at: new Date().toISOString(),
      },
      ...currentAccounts.filter((item) => normalizeEmail(item?.email) !== email),
    ].slice(0, 6);

    saveRememberedAccounts(nextAccounts);
  }

  function getMostRecentRememberedAccount() {
    const accounts = loadRememberedAccounts();
    return accounts.length > 0 ? accounts[0] : null;
  }

  function completeAuthSuccess(user) {
    if (!user) {
      return;
    }

    clearLegacyLocalAuthData();
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    rememberAccount(user);
  }

  async function requestJSON(path, payload) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        return {
          ok: false,
          message: data.message || "Request failed.",
        };
      }

      return {
        ok: true,
        data,
      };
    } catch (error) {
      return {
        ok: false,
        offline: true,
        message: "Service is unreachable right now. Please try again shortly.",
        details: error ? String(error.message || error) : "",
      };
    }
  }

  function bindAuthAction(form, action, options = {}) {
    if (!form || typeof action !== "function") {
      return;
    }

    const submitButton =
      options.submitButton ||
      form.querySelector("button[type='submit'], button[type='button']");

    const runAction = async (event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      await action();
      return false;
    };

    form.addEventListener("submit", runAction);

    if (submitButton) {
      submitButton.addEventListener("click", runAction);
    }

    form.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      const targetTag = String(event.target?.tagName || "").toUpperCase();
      if (targetTag === "TEXTAREA") {
        return;
      }

      void runAction(event);
    });
  }

  function maybeRedirectSignedInUser() {
    const currentUser = getCurrentUserRecord();
    if (!isValidSignedInUser(currentUser)) {
      return false;
    }

    prepareMainPageLink();
    performPostAuthRedirect();
    return true;
  }

  function applyRememberedAccountDefaults() {
    const remembered = getMostRecentRememberedAccount();
    if (!remembered) {
      return;
    }

    const loginEmailInput = document.getElementById("username");
    const signupNameInput = document.getElementById("fullname");
    const signupEmailInput = document.getElementById("signupEmail");
    const forgotEmailInput = document.getElementById("forgotEmail");

    if (loginEmailInput && !String(loginEmailInput.value || "").trim()) {
      loginEmailInput.value = remembered.email || "";
    }

    if (signupEmailInput && !String(signupEmailInput.value || "").trim()) {
      signupEmailInput.value = remembered.email || "";
    }

    if (signupNameInput && !String(signupNameInput.value || "").trim()) {
      signupNameInput.value = String(remembered.fullname || "").trim();
    }

    if (forgotEmailInput && !String(forgotEmailInput.value || "").trim()) {
      forgotEmailInput.value = remembered.email || "";
    }
  }

  prepareMainPageLink();
  applyRememberedAccountDefaults();
  if (maybeRedirectSignedInUser()) {
    return;
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const loginMsg = document.getElementById("loginError");
    const username = document.getElementById("username");
    const loginPassword = document.getElementById("loginPassword");
    const loginSubmitBtn = document.getElementById("login-submit-btn");

    bindAuthAction(loginForm, async () => {
      clearMessage(loginMsg);
      [username, loginPassword].forEach(clearError);

      let hasError = false;
      const identifier = username.value.trim();
      const password = loginPassword.value;

      if (!identifier) {
        showError(username);
        hasError = true;
      }
      if (!password) {
        showError(loginPassword);
        hasError = true;
      }

      if (hasError) {
        showMessage(loginMsg, "Please fill in all fields.");
        return;
      }

      showMessage(loginMsg, "Checking credentials...", "success");

      const result = await requestJSON("/auth/login", {
        identifier,
        password,
      });

      if (!result.ok) {
        showMessage(loginMsg, result.message);
        return;
      }

      const user = result.data.user || null;
      if (user) {
        completeAuthSuccess(user);
      }

      prepareMainPageLink();
      showMessage(loginMsg, "Login successful. Opening Main Page...", "success");
      performPostAuthRedirect();
    }, { submitButton: loginSubmitBtn });
  }

  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("loginPassword");

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      passwordInput.type = passwordInput.type === "password" ? "text" : "password";
      togglePassword.classList.toggle("fa-eye");
      togglePassword.classList.toggle("fa-eye-slash");
    });
  }

  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    const signupMsg = document.getElementById("errorMsg");
    const fullname = document.getElementById("fullname");
    const signupEmail = document.getElementById("signupEmail");
    const signupPassword = document.getElementById("signupPassword");
    const confirmPassword = document.getElementById("confirmPassword");
    const signupSubmitBtn = document.getElementById("signup-submit-btn");

    bindAuthAction(signupForm, async () => {
      clearMessage(signupMsg);
      [fullname, signupEmail, signupPassword, confirmPassword].forEach(clearError);

      let hasError = false;

      const cleanFullname = fullname.value.trim();
      const cleanEmail = signupEmail.value.trim();
      const cleanPassword = signupPassword.value;
      const cleanConfirmPassword = confirmPassword.value;

      if (!cleanFullname) {
        showError(fullname);
        hasError = true;
      }
      if (!cleanEmail || !cleanEmail.match(emailPattern)) {
        showError(signupEmail);
        hasError = true;
      }
      if (cleanPassword.length < 6) {
        showError(signupPassword);
        hasError = true;
      }
      if (!cleanConfirmPassword || cleanPassword !== cleanConfirmPassword) {
        showError(confirmPassword);
        hasError = true;
      }

      if (hasError) {
        showMessage(signupMsg, "Please fix the highlighted fields.");
        return;
      }

      showMessage(signupMsg, "Creating account...", "success");

      const result = await requestJSON("/auth/signup", {
        fullname: cleanFullname,
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!result.ok) {
        showMessage(signupMsg, result.message);
        return;
      }

      const user = result.data.user || null;
      if (user) {
        completeAuthSuccess(user);
      }

      prepareMainPageLink();
      showMessage(signupMsg, "Account created successfully. Opening Main Page...", "success");
      performPostAuthRedirect();
    }, { submitButton: signupSubmitBtn });
  }

  const forgotForm = document.getElementById("forgotForm");
  if (forgotForm) {
    const forgotMsg = document.getElementById("forgotError");
    const forgotEmail = document.getElementById("forgotEmail");
    const forgotPassword = document.getElementById("forgotPassword");
    const forgotConfirmPassword = document.getElementById("forgotConfirmPassword");

    forgotForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearMessage(forgotMsg);
      [forgotEmail, forgotPassword, forgotConfirmPassword].forEach(clearError);

      const cleanEmail = forgotEmail.value.trim();
      const cleanPassword = forgotPassword?.value || "";
      const cleanConfirmPassword = forgotConfirmPassword?.value || "";

      if (!cleanEmail || !cleanEmail.match(emailPattern)) {
        showError(forgotEmail);
        showMessage(forgotMsg, "Please enter a valid email address.");
        return;
      }

      if (cleanPassword.length < 6) {
        showError(forgotPassword);
        showMessage(forgotMsg, "Password must be at least 6 characters.");
        return;
      }

      if (!cleanConfirmPassword || cleanPassword !== cleanConfirmPassword) {
        showError(forgotConfirmPassword);
        showMessage(forgotMsg, "Passwords do not match.");
        return;
      }

      showMessage(forgotMsg, "Resetting password...", "success");

      const result = await requestJSON("/auth/reset-password", {
        email: cleanEmail,
        newPassword: cleanPassword,
      });

      if (!result.ok) {
        showMessage(forgotMsg, result.message);
        return;
      }

      const user = result.data.user || null;
      if (user) {
        completeAuthSuccess(user);
      }

      prepareMainPageLink();
      showMessage(forgotMsg, "Password reset successful. Opening Main Page...", "success");
      performPostAuthRedirect();
    });
  }
});

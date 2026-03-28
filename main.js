document.addEventListener("DOMContentLoaded", function () {
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
  const CURRENT_USER_KEY = "hni_current_user";
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

  async function requestJSON(path, payload) {
    let lastNetworkError = null;

    for (const apiBase of API_BASE_CANDIDATES) {
      try {
        const response = await fetch(`${apiBase}${path}`, {
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
        lastNetworkError = error;
      }
    }

    return {
      ok: false,
      offline: true,
      message: "Backend is unreachable. Start the backend server and try again.",
      details: lastNetworkError ? String(lastNetworkError.message || lastNetworkError) : "",
    };
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
        clearLegacyLocalAuthData();
        window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
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
        clearLegacyLocalAuthData();
        window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
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
        clearLegacyLocalAuthData();
        window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      }

      prepareMainPageLink();
      showMessage(forgotMsg, "Password reset successful. Opening Main Page...", "success");
      performPostAuthRedirect();
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const currentHost = window.location.hostname || "127.0.0.1";
  const API_BASE_CANDIDATES = [
    `http://${currentHost}:3000/api`,
    "http://127.0.0.1:3000/api",
    "http://localhost:3000/api",
  ].filter((value, index, array) => array.indexOf(value) === index);
  const LOCAL_USERS_KEY = "hni_local_users_v1";
  const LOCAL_LOGIN_EVENTS_KEY = "hni_local_login_events_v1";
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
    try {
      window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    } catch {
      // Ignore storage failures.
    }
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
    try {
      window.localStorage.setItem(LOCAL_LOGIN_EVENTS_KEY, JSON.stringify(events));
    } catch {
      // Ignore storage failures.
    }
  }

  function addLocalLoginEvent(user) {
    if (!user) {
      return;
    }

    const events = loadLocalLoginEvents();
    events.unshift({
      id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: user.id,
      email: user.email,
      loggedInAt: new Date().toISOString(),
      source: "local",
    });
    saveLocalLoginEvents(events.slice(0, 1000));
  }

  function localSignup({ fullname, email, password }) {
    const users = loadLocalUsers();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const existing = users.find((user) => user.email === normalizedEmail);
    if (existing) {
      return {
        ok: false,
        message: "An account with this email already exists.",
      };
    }

    const newUser = {
      id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      fullname: String(fullname || "").trim(),
      email: normalizedEmail,
      password,
      isAdmin: false,
      is_admin: 0,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveLocalUsers(users);

    return {
      ok: true,
      data: {
        user: {
          id: newUser.id,
          fullname: newUser.fullname,
          email: newUser.email,
        },
      },
    };
  }

  function localLogin({ identifier, password }) {
    const normalizedEmail = String(identifier || "").trim().toLowerCase();
    const users = loadLocalUsers();
    const user = users.find((item) => item.email === normalizedEmail);

    if (!user || user.password !== password) {
      return {
        ok: false,
        message: "Invalid email or password.",
      };
    }

    return {
      ok: true,
      data: {
        user: {
          id: user.id,
          fullname: user.fullname,
          email: user.email,
        },
      },
    };
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
      message: "Backend is unreachable. Switching to local auth mode.",
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
        if (result.offline) {
          const localResult = localLogin({ identifier, password });
          if (!localResult.ok) {
            showMessage(loginMsg, localResult.message);
            return;
          }

          const localUser = localResult.data.user;
          window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(localUser));
          addLocalLoginEvent(localUser);
          prepareMainPageLink();
          showMessage(loginMsg, "Login successful. Opening Main Page...", "success");
          performPostAuthRedirect();
          return;
        }

        showMessage(loginMsg, result.message);
        return;
      }

      const user = result.data.user || null;
      if (user) {
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
        if (result.offline) {
          const localResult = localSignup({
            fullname: cleanFullname,
            email: cleanEmail,
            password: cleanPassword,
          });

          if (!localResult.ok) {
            showMessage(signupMsg, localResult.message);
            return;
          }

          const localUser = localResult.data.user;
          window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(localUser));
          prepareMainPageLink();
          showMessage(signupMsg, "Account created successfully. Opening Main Page...", "success");
          performPostAuthRedirect();
          return;
        }

        showMessage(signupMsg, result.message);
        return;
      }

      const user = result.data.user || null;
      if (user) {
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

    forgotForm.addEventListener("submit", function (e) {
      e.preventDefault();
      clearMessage(forgotMsg);
      clearError(forgotEmail);

      if (!forgotEmail.value.trim() || !forgotEmail.value.match(emailPattern)) {
        showError(forgotEmail);
        showMessage(forgotMsg, "Please enter a valid email address.");
        return;
      }

      showMessage(forgotMsg, "Password reset link has been sent to your email.", "success");
      forgotForm.reset();
    });
  }
});

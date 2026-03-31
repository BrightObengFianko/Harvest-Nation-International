(function () {
  const STORAGE_KEY = "hni_api_base_override_v1";
  const DEFAULT_API_BASE = "/api";

  function normalizeApiBase(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      return DEFAULT_API_BASE;
    }

    const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
    if (/\/api$/i.test(withoutTrailingSlash)) {
      return withoutTrailingSlash;
    }

    return `${withoutTrailingSlash}/api`;
  }

  function readStoredApiBase() {
    try {
      return String(window.localStorage.getItem(STORAGE_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function writeStoredApiBase(value) {
    try {
      if (!value) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore storage failures.
    }
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryApiBase = String(searchParams.get("apiBase") || "").trim();
  const configuredApiBase = queryApiBase || readStoredApiBase() || DEFAULT_API_BASE;
  const normalizedApiBase = normalizeApiBase(configuredApiBase);

  if (queryApiBase) {
    writeStoredApiBase(normalizedApiBase);
  }

  window.HNI_API_BASE = normalizedApiBase;
  window.HNI_API_BASE_STORAGE_KEY = STORAGE_KEY;
})();

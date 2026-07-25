const GitHubOffers = (() => {
  const API_VERSION = "2026-03-10";
  const STORAGE_KEY = "githubConfig";
  const DEFAULT_CONFIG = {
    owner: "elprofedelabata",
    repo: "busqueda-casa",
    branch: "main",
    path: "data/offers.json",
    token: ""
  };

  class GitHubError extends Error {
    constructor(message, status) {
      super(message);
      this.name = "GitHubError";
      this.status = status;
    }
  }

  function normalizeConfig(config = {}) {
    return {
      owner: String(config.owner || "").trim(),
      repo: String(config.repo || "").trim(),
      branch: String(config.branch || "main").trim(),
      path: String(config.path || "data/offers.json").trim().replace(/^\/+/, ""),
      token: String(config.token || "").trim()
    };
  }

  function isConfigured(config) {
    const value = normalizeConfig(config);
    return Boolean(value.owner && value.repo && value.branch && value.path && value.token);
  }

  async function loadConfig() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeConfig({ ...DEFAULT_CONFIG, ...(stored[STORAGE_KEY] || {}) });
  }

  async function saveConfig(config) {
    const value = normalizeConfig(config);
    await chrome.storage.local.set({ [STORAGE_KEY]: value });
    return value;
  }

  function headers(token) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": API_VERSION
    };
  }

  async function request(config, endpoint, options = {}) {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        ...headers(config.token),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.json();
        detail = body.message ? ` ${body.message}` : "";
      } catch {
        // La respuesta puede no incluir JSON.
      }
      throw new GitHubError(`GitHub respondió con un error (${response.status}).${detail}`, response.status);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  function decodeBase64(value) {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  function contentEndpoint(config) {
    const path = config.path
      .split("/")
      .map(segment => encodeURIComponent(segment))
      .join("/");
    return `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`;
  }

  async function verifyConnection(config) {
    const value = normalizeConfig(config);
    if (!isConfigured(value)) {
      throw new Error("Completa todos los campos, incluido el token.");
    }

    const repo = await request(
      value,
      `/repos/${encodeURIComponent(value.owner)}/${encodeURIComponent(value.repo)}`
    );

    if (repo.permissions && !repo.permissions.push) {
      throw new Error("El token puede leer el repositorio, pero no tiene permiso para escribir contenido.");
    }

    return {
      fullName: repo.full_name,
      private: repo.private,
      canPush: repo.permissions?.push !== false
    };
  }

  async function readOffers(config) {
    try {
      const file = await request(
        config,
        `${contentEndpoint(config)}?ref=${encodeURIComponent(config.branch)}`
      );
      const document = JSON.parse(decodeBase64(file.content));
      if (!document || !Array.isArray(document.offers)) {
        throw new Error("El archivo configurado no contiene una colección offers válida.");
      }
      return { document, sha: file.sha };
    } catch (error) {
      if (error instanceof GitHubError && error.status === 404) {
        return {
          document: {
            schemaVersion: 1,
            updatedAt: null,
            offers: []
          },
          sha: null
        };
      }
      if (error instanceof SyntaxError) {
        throw new Error("El archivo de ofertas de GitHub no contiene JSON válido.");
      }
      throw error;
    }
  }

  function sameOffer(existing, incoming) {
    if (existing.id && incoming.id && existing.id === incoming.id) return true;
    if (
      existing.source === incoming.source &&
      existing.sourceId &&
      incoming.sourceId &&
      existing.sourceId === incoming.sourceId
    ) return true;
    return existing.url === incoming.url;
  }

  function mergeOffer(existing, incoming, now) {
    const priceHistory = Array.isArray(existing.priceHistory)
      ? [...existing.priceHistory]
      : [];

    if (
      existing.price !== null &&
      incoming.price !== null &&
      existing.price !== incoming.price
    ) {
      priceHistory.push({
        price: existing.price,
        recordedAt: existing.updatedAt || existing.savedAt || now
      });
    }

    return {
      ...existing,
      ...incoming,
      savedAt: existing.savedAt || incoming.savedAt || now,
      updatedAt: now,
      ...(priceHistory.length ? { priceHistory } : {})
    };
  }

  async function saveOffer(config, offer) {
    const value = normalizeConfig(config);
    const now = new Date().toISOString();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { document, sha } = await readOffers(value);
      const index = document.offers.findIndex(existing => sameOffer(existing, offer));
      const created = index === -1;

      if (created) {
        document.offers.push({
          ...offer,
          savedAt: offer.savedAt || now,
          updatedAt: now
        });
      } else {
        document.offers[index] = mergeOffer(document.offers[index], offer, now);
      }

      document.updatedAt = now;
      const body = {
        message: created
          ? `Añade vivienda ${offer.id}`
          : `Actualiza vivienda ${offer.id}`,
        content: encodeBase64(`${JSON.stringify(document, null, 2)}\n`),
        branch: value.branch,
        ...(sha ? { sha } : {})
      };

      try {
        const response = await request(value, contentEndpoint(value), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        return {
          created,
          commitSha: response.commit?.sha || null,
          offerCount: document.offers.length
        };
      } catch (error) {
        if (error instanceof GitHubError && error.status === 409 && attempt === 0) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("No se pudo actualizar el archivo porque cambió simultáneamente.");
  }

  return {
    DEFAULT_CONFIG,
    isConfigured,
    loadConfig,
    saveConfig,
    verifyConnection,
    saveOffer
  };
})();

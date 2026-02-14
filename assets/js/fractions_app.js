/* Fractions Arcade - shared behavior (vanilla JS) */

(function () {
  "use strict";

  if (typeof FRACTIONS_ARCADE_GAMES === "undefined") return;

  const PROFILE_STORAGE_KEY = "fractionsArcade_global_profiles_v1";
  const STORAGE_SCOPE_PREFIX = "fractionsArcade_scope_v1_";

  const AVATAR_OPTIONS = ["🦊", "🐼", "🦁", "🐯", "🐨", "🐸", "🐬", "🦄", "🐆", "🐧"];
  const DEFAULT_PLAYER_NAME = "Player";
  const MAX_PLAYER_NAME = 16;

  const SCOPED_KEY_PREFIXES = ["fractions_", "common_multiples_"];
  const SCOPED_EXACT_KEYS = new Set([]);
  // Keep new profiles clean: do not auto-import old pre-profile localStorage records.
  const ENABLE_LEGACY_IMPORT = false;

  // Fractions activities are recorded as score/timing records, not mission-star rows.
  const MISSION_STAR_GAME_IDS = new Set([]);

  const GAME_PAGE_TO_ID = {};
  const RECORD_KEY_TO_GAME_ID = {};
  const RECORD_KEY_TO_QCOUNT = {};

  FRACTIONS_ARCADE_GAMES.forEach((g) => {
    if (!g || typeof g !== "object") return;
    if (typeof g.href === "string") {
      const page = g.href.split("/").pop() || "";
      if (page) GAME_PAGE_TO_ID[page] = g.id;
    }
    if (typeof g.bestKey === "string" && g.bestKey) {
      RECORD_KEY_TO_GAME_ID[g.bestKey] = g.id;
      RECORD_KEY_TO_QCOUNT[g.bestKey] = Number.isFinite(g.qCount) ? g.qCount : null;
    }
  });

  let storageNative = null;
  let profilesCache = null;

  function initStorageNative() {
    if (storageNative || !("Storage" in window)) return;
    storageNative = {
      getItem: Storage.prototype.getItem,
      setItem: Storage.prototype.setItem,
      removeItem: Storage.prototype.removeItem,
      key: Storage.prototype.key
    };
  }

  function safeNativeGet(key) {
    initStorageNative();
    if (!storageNative || !("localStorage" in window)) return null;
    try {
      return storageNative.getItem.call(localStorage, key);
    } catch {
      return null;
    }
  }

  function safeNativeSet(key, value) {
    initStorageNative();
    if (!storageNative || !("localStorage" in window)) return;
    try {
      storageNative.setItem.call(localStorage, key, value);
    } catch {
      // ignore quota/private-mode errors
    }
  }

  function safeNativeRemove(key) {
    initStorageNative();
    if (!storageNative || !("localStorage" in window)) return;
    try {
      storageNative.removeItem.call(localStorage, key);
    } catch {
      // ignore quota/private-mode errors
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function cleanPlayerName(raw) {
    const base = String(raw || "")
      .replace(/[^A-Za-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!base) return DEFAULT_PLAYER_NAME;
    return base.slice(0, MAX_PLAYER_NAME);
  }

  function playerIdFromName(name) {
    const id = cleanPlayerName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return id || "player-1";
  }

  function pickAvatarForId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % AVATAR_OPTIONS.length;
    return AVATAR_OPTIONS[idx];
  }

  function createEmptyUser(name, id) {
    const stamp = nowIso();
    return {
      id: id,
      name: cleanPlayerName(name),
      avatar: pickAvatarForId(id),
      createdAt: stamp,
      updatedAt: stamp,
      adventure: {
        totalLaunches: 0,
        lastPlayedId: "",
        games: {}
      }
    };
  }

  function freshProfilesState() {
    return {
      version: 1,
      activeUserId: "",
      users: {}
    };
  }

  function normalizeProfiles(parsed) {
    const base = (parsed && typeof parsed === "object") ? parsed : freshProfilesState();

    if (!base.users || typeof base.users !== "object") base.users = {};

    const normalizedUsers = {};
    Object.keys(base.users).forEach((rawId) => {
      const u = base.users[rawId];
      if (!u || typeof u !== "object") return;

      const cleanName = cleanPlayerName(u.name || rawId);
      const id = playerIdFromName(cleanName);
      const existing = normalizedUsers[id] || createEmptyUser(cleanName, id);

      existing.name = cleanName;
      existing.avatar = AVATAR_OPTIONS.includes(u.avatar) ? u.avatar : existing.avatar;
      existing.createdAt = typeof u.createdAt === "string" ? u.createdAt : existing.createdAt;
      existing.updatedAt = typeof u.updatedAt === "string" ? u.updatedAt : existing.updatedAt;

      const adv = (u.adventure && typeof u.adventure === "object") ? u.adventure : {};
      const games = (adv.games && typeof adv.games === "object") ? adv.games : {};

      const normalizedGames = {};
      Object.keys(games).forEach((gid) => {
        const g = games[gid];
        if (!g || typeof g !== "object") return;
        normalizedGames[gid] = {
          plays: Number.isFinite(g.plays) ? Math.max(0, Math.floor(g.plays)) : 0,
          stars: Number.isFinite(g.stars) ? Math.max(0, Math.min(3, Math.floor(g.stars))) : 0,
          bestCorrect: Number.isFinite(g.bestCorrect) ? g.bestCorrect : null,
          bestTotal: Number.isFinite(g.bestTotal) ? g.bestTotal : null,
          bestTimeMs: Number.isFinite(g.bestTimeMs) ? g.bestTimeMs : null,
          lastPlayedAt: typeof g.lastPlayedAt === "string" ? g.lastPlayedAt : "",
          recordText: typeof g.recordText === "string" ? g.recordText : "",
          scoreValue: Number.isFinite(g.scoreValue) ? g.scoreValue : null,
          scoreLabel: typeof g.scoreLabel === "string" ? g.scoreLabel : ""
        };
      });

      existing.adventure = {
        totalLaunches: Number.isFinite(adv.totalLaunches) ? Math.max(0, Math.floor(adv.totalLaunches)) : 0,
        lastPlayedId: typeof adv.lastPlayedId === "string" ? adv.lastPlayedId : "",
        games: normalizedGames
      };

      normalizedUsers[id] = existing;
    });

    let active = typeof base.activeUserId === "string" ? base.activeUserId : "";
    if (!normalizedUsers[active]) {
      active = Object.keys(normalizedUsers)[0] || "";
    }

    return {
      version: 1,
      activeUserId: active,
      users: normalizedUsers
    };
  }

  function loadProfiles() {
    if (profilesCache) return profilesCache;

    const raw = safeNativeGet(PROFILE_STORAGE_KEY);
    if (!raw) {
      profilesCache = freshProfilesState();
      safeNativeSet(PROFILE_STORAGE_KEY, JSON.stringify(profilesCache));
      return profilesCache;
    }

    try {
      profilesCache = normalizeProfiles(JSON.parse(raw));
    } catch {
      profilesCache = freshProfilesState();
    }

    safeNativeSet(PROFILE_STORAGE_KEY, JSON.stringify(profilesCache));
    return profilesCache;
  }

  function saveProfiles() {
    if (!profilesCache) return;
    safeNativeSet(PROFILE_STORAGE_KEY, JSON.stringify(profilesCache));
  }

  function getActiveUser() {
    const state = loadProfiles();
    if (!state.activeUserId || !state.users[state.activeUserId]) return null;
    return state.users[state.activeUserId];
  }

  function touchUser(user) {
    user.updatedAt = nowIso();
  }

  function getCurrentGameId() {
    const path = window.location.pathname;
    const page = path.split("/").pop() || "";
    if (GAME_PAGE_TO_ID[page]) return GAME_PAGE_TO_ID[page];

    const hit = FRACTIONS_ARCADE_GAMES.find((g) => {
      if (!g || typeof g.href !== "string") return false;
      return g.href.split("/").pop() === page;
    });
    return hit ? hit.id : "";
  }

  function ensureGameStats(user, gameId) {
    if (!gameId) return null;
    if (!user.adventure || typeof user.adventure !== "object") {
      user.adventure = { totalLaunches: 0, lastPlayedId: "", games: {} };
    }
    if (!user.adventure.games || typeof user.adventure.games !== "object") {
      user.adventure.games = {};
    }
    if (!user.adventure.games[gameId]) {
      user.adventure.games[gameId] = {
        plays: 0,
        stars: 0,
        bestCorrect: null,
        bestTotal: null,
        bestTimeMs: null,
        lastPlayedAt: "",
        recordText: "",
        scoreValue: null,
        scoreLabel: ""
      };
    }
    return user.adventure.games[gameId];
  }

  function fmtDuration(ms) {
    if (!Number.isFinite(ms)) return "";
    const totalSec = Math.max(0, ms) / 1000;
    if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec - mins * 60;
    return `${mins}m ${secs.toFixed(1)}s`;
  }

  function safeParseJson(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function parseFractionsBest(raw, qCount) {
    const obj = safeParseJson(raw);
    if (!obj || typeof obj !== "object") return null;

    const hasGreen = Number.isFinite(obj.greens) || Number.isFinite(obj.g);
    const hasYellow = Number.isFinite(obj.yellows) || Number.isFinite(obj.y);
    const hasScore = Number.isFinite(obj.score);
    const timeMs = Number(obj.timeMs);

    if (hasGreen && Number.isFinite(timeMs)) {
      let g = Number(obj.greens ?? obj.g);
      if (!Number.isFinite(g)) g = 0;

      let y = 0;
      if (hasYellow) {
        y = Number(obj.yellows ?? obj.y);
        if (!Number.isFinite(y)) y = 0;
      }

      if (Number.isFinite(qCount) && qCount > 0) {
        g = Math.max(0, Math.min(qCount, g));
        y = Math.max(0, Math.min(qCount - g, y));
        const r = qCount - g - y;

        return {
          scoreValue: g,
          scoreLabel: `${g}/${qCount}`,
          bestCorrect: g,
          bestTotal: qCount,
          bestTimeMs: timeMs,
          recordText: hasYellow
            ? `${g}G ${y}Y ${r}R in ${fmtDuration(timeMs)}`
            : `${g}G ${r}R in ${fmtDuration(timeMs)}`
        };
      }

      return {
        scoreValue: g,
        scoreLabel: String(g),
        bestCorrect: g,
        bestTotal: null,
        bestTimeMs: timeMs,
        recordText: hasYellow
          ? `${g}G ${y}Y in ${fmtDuration(timeMs)}`
          : `${g}G in ${fmtDuration(timeMs)}`
      };
    }

    if (hasScore) {
      const s = Number(obj.score);
      return {
        scoreValue: s,
        scoreLabel: String(s),
        recordText: `Score ${s}`
      };
    }

    return null;
  }

  function patchGameProgress(gameId, patch) {
    if (!gameId || !patch || typeof patch !== "object") return;
    const user = getActiveUser();
    if (!user) return;
    const game = ensureGameStats(user, gameId);
    if (!game) return;

    if (typeof patch.recordText === "string" && patch.recordText.trim()) {
      game.recordText = patch.recordText.trim();
    }

    if (Number.isFinite(patch.scoreValue)) {
      const betterScore = (game.scoreValue === null) || (patch.scoreValue > game.scoreValue);
      if (betterScore) {
        game.scoreValue = patch.scoreValue;
        game.scoreLabel = typeof patch.scoreLabel === "string" && patch.scoreLabel.trim()
          ? patch.scoreLabel.trim()
          : String(patch.scoreValue);
      }
    }

    if (Number.isFinite(patch.bestCorrect) && Number.isFinite(patch.bestTimeMs)) {
      const betterByScore = (game.bestCorrect === null) || (patch.bestCorrect > game.bestCorrect);
      const tiedScore = (game.bestCorrect !== null) && (patch.bestCorrect === game.bestCorrect);
      const betterByTime = (game.bestTimeMs === null || patch.bestTimeMs < game.bestTimeMs);

      if (betterByScore || (tiedScore && betterByTime)) {
        game.bestCorrect = patch.bestCorrect;
        game.bestTotal = Number.isFinite(patch.bestTotal) ? patch.bestTotal : game.bestTotal;
        game.bestTimeMs = patch.bestTimeMs;
      }
    }

    game.lastPlayedAt = nowIso();
    user.adventure.lastPlayedId = gameId;

    touchUser(user);
    saveProfiles();
  }

  function clearGameRecord(gameId) {
    if (!gameId) return;
    const user = getActiveUser();
    if (!user) return;
    const game = ensureGameStats(user, gameId);
    if (!game) return;

    game.recordText = "";
    game.bestCorrect = null;
    game.bestTotal = null;
    game.bestTimeMs = null;
    game.scoreValue = null;
    game.scoreLabel = "";
    game.stars = 0;

    touchUser(user);
    saveProfiles();
  }

  function patchFromStorageKey(key, value) {
    if (typeof key !== "string") return null;
    const qCount = RECORD_KEY_TO_QCOUNT[key];
    if (!(key in RECORD_KEY_TO_GAME_ID)) return null;
    return parseFractionsBest(value, qCount);
  }

  function recordGameLaunch(gameId) {
    if (!gameId) return;
    const user = getActiveUser();
    if (!user) return;
    const game = ensureGameStats(user, gameId);
    if (!game) return;

    game.plays += 1;
    game.lastPlayedAt = nowIso();

    user.adventure.totalLaunches = (user.adventure.totalLaunches || 0) + 1;
    user.adventure.lastPlayedId = gameId;

    touchUser(user);
    saveProfiles();
  }

  function shouldScopeKey(key) {
    if (typeof key !== "string" || !key) return false;
    if (key === PROFILE_STORAGE_KEY) return false;
    if (key.startsWith("fractionsArcade_global_")) return false;
    if (key.startsWith(STORAGE_SCOPE_PREFIX)) return false;
    if (SCOPED_EXACT_KEYS.has(key)) return true;
    return SCOPED_KEY_PREFIXES.some((p) => key.startsWith(p));
  }

  function scopedStorageKey(key) {
    if (!shouldScopeKey(key)) return key;
    const active = getActiveUser();
    const id = active && active.id ? active.id : "";
    if (!id) return key;
    return `${STORAGE_SCOPE_PREFIX}${id}::${key}`;
  }

  function installUserScopedStorage() {
    initStorageNative();
    if (!storageNative || !("Storage" in window)) return;

    const proto = Storage.prototype;
    if (proto.__fractionsArcadeScopedV1) return;

    proto.getItem = function (key) {
      return storageNative.getItem.call(this, scopedStorageKey(key));
    };

    proto.setItem = function (key, value) {
      const scoped = scopedStorageKey(key);
      storageNative.setItem.call(this, scoped, value);

      const gameId = RECORD_KEY_TO_GAME_ID[String(key)] || "";
      const patch = patchFromStorageKey(String(key), String(value));
      if (gameId && patch) {
        patchGameProgress(gameId, patch);
      }
    };

    proto.removeItem = function (key) {
      storageNative.removeItem.call(this, scopedStorageKey(key));
      const gameId = RECORD_KEY_TO_GAME_ID[String(key)] || "";
      if (gameId) clearGameRecord(gameId);
    };

    Object.defineProperty(proto, "__fractionsArcadeScopedV1", {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }

  function maybeMigrateLegacyDataForUser(userId) {
    if (!ENABLE_LEGACY_IMPORT) return;
    if (!userId || !("localStorage" in window)) return;
    initStorageNative();
    if (!storageNative) return;

    const scopePrefix = `${STORAGE_SCOPE_PREFIX}${userId}::`;
    const toMove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = storageNative.key.call(localStorage, i);
      if (!k) continue;
      if (k === PROFILE_STORAGE_KEY) continue;
      if (k.startsWith("fractionsArcade_global_")) continue;
      if (k.startsWith(scopePrefix)) continue;

      const isRecordKey = !!RECORD_KEY_TO_GAME_ID[k];
      const isLegacyPrefix = SCOPED_KEY_PREFIXES.some((p) => k.startsWith(p));
      if (isRecordKey || isLegacyPrefix) {
        toMove.push(k);
      }
    }

    toMove.forEach((k) => {
      const scoped = `${scopePrefix}${k}`;
      const existingScoped = safeNativeGet(scoped);
      if (existingScoped !== null && existingScoped !== undefined) return;

      const val = safeNativeGet(k);
      if (val === null || val === undefined) return;

      safeNativeSet(scoped, val);

      const gameId = RECORD_KEY_TO_GAME_ID[k] || "";
      const patch = patchFromStorageKey(k, val);
      if (gameId && patch) patchGameProgress(gameId, patch);
    });
  }

  function switchOrCreateUserByName(rawName) {
    const state = loadProfiles();
    const name = cleanPlayerName(rawName);
    const id = playerIdFromName(name);

    if (!state.users[id]) {
      state.users[id] = createEmptyUser(name, id);
    } else {
      state.users[id].name = name;
    }

    state.activeUserId = id;
    touchUser(state.users[id]);
    saveProfiles();
    maybeMigrateLegacyDataForUser(id);
    return state.users[id];
  }

  function switchUserById(id) {
    const state = loadProfiles();
    if (!state.users[id]) return null;
    state.activeUserId = id;
    touchUser(state.users[id]);
    saveProfiles();
    maybeMigrateLegacyDataForUser(id);
    return state.users[id];
  }

  function purgeUserScopedData(userId) {
    if (!userId || !("localStorage" in window)) return 0;
    initStorageNative();
    if (!storageNative) return 0;

    const prefix = `${STORAGE_SCOPE_PREFIX}${userId}::`;
    const toRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = storageNative.key.call(localStorage, i);
      if (!k) continue;
      if (k.startsWith(prefix)) toRemove.push(k);
    }

    toRemove.forEach((k) => safeNativeRemove(k));
    return toRemove.length;
  }

  function deleteUserById(userId) {
    const state = loadProfiles();
    if (!state.users[userId]) return { ok: false, reason: "not-found", removedKeys: 0 };

    delete state.users[userId];
    const removedKeys = purgeUserScopedData(userId);

    const remaining = Object.keys(state.users);
    if (state.activeUserId === userId) {
      state.activeUserId = remaining[0] || "";
      if (state.activeUserId) maybeMigrateLegacyDataForUser(state.activeUserId);
    }

    saveProfiles();
    return { ok: true, reason: "", removedKeys: removedKeys };
  }

  function setActiveAvatar(avatar) {
    if (!AVATAR_OPTIONS.includes(avatar)) return;
    const user = getActiveUser();
    if (!user) return;
    user.avatar = avatar;
    touchUser(user);
    saveProfiles();
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getUsersSorted() {
    const state = loadProfiles();
    return Object.values(state.users)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  function listOrderedGameIds(games) {
    return [...games]
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map((g) => g.id);
  }

  function getUserGameState(user, gameId) {
    const games = user && user.adventure && user.adventure.games;
    if (!games || !games[gameId]) {
      return {
        plays: 0,
        stars: 0,
        bestCorrect: null,
        bestTotal: null,
        bestTimeMs: null,
        recordText: "",
        scoreValue: null,
        scoreLabel: ""
      };
    }
    return games[gameId];
  }

  function countUserStats(user, gameIds) {
    if (!user) {
      return {
        explored: 0,
        stars: 0,
        totalGames: gameIds.length,
        maxStars: 0,
        completionPct: 0,
        totalScore: 0,
        scoredGames: 0
      };
    }

    let explored = 0;
    let totalScore = 0;
    let scoredGames = 0;

    gameIds.forEach((id) => {
      const g = getUserGameState(user, id);
      if (g.plays > 0) explored += 1;
      if (Number.isFinite(g.scoreValue)) {
        totalScore += g.scoreValue;
        scoredGames += 1;
      }
    });

    const totalGames = gameIds.length;
    const pct = totalGames ? Math.round((explored / totalGames) * 100) : 0;

    return {
      explored,
      stars: 0,
      totalGames,
      maxStars: 0,
      completionPct: pct,
      totalScore,
      scoredGames
    };
  }

  function gameRecordLine(gameState) {
    if (!gameState) return "Not started";
    if (typeof gameState.recordText === "string" && gameState.recordText.trim()) {
      return gameState.recordText.trim();
    }
    if (Number.isFinite(gameState.bestCorrect) && Number.isFinite(gameState.bestTotal)) {
      if (Number.isFinite(gameState.bestTimeMs)) {
        return `Best ${gameState.bestCorrect}/${gameState.bestTotal} in ${fmtDuration(gameState.bestTimeMs)}`;
      }
      return `Best ${gameState.bestCorrect}/${gameState.bestTotal}`;
    }
    if (gameState.plays > 0) {
      return `Played ${gameState.plays} time${gameState.plays === 1 ? "" : "s"}`;
    }
    return "Not started";
  }

  function gameScoreLine(gameState) {
    if (!gameState) return "—";
    if (typeof gameState.scoreLabel === "string" && gameState.scoreLabel.trim()) {
      return gameState.scoreLabel.trim();
    }
    if (Number.isFinite(gameState.scoreValue)) {
      return String(gameState.scoreValue);
    }
    return "—";
  }

  function setupTileLaunchAnimation(host) {
    const runner = host.querySelector("#trackAvatar");

    host.querySelectorAll("a.arcade-tile").forEach((tile) => {
      tile.addEventListener("click", (ev) => {
        if (ev.defaultPrevented) return;
        if (ev.button !== 0) return;
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

        const href = tile.getAttribute("href");
        if (!href) return;

        ev.preventDefault();

        const icon = tile.querySelector(".tile-icon") || tile;
        const from = (runner || host.querySelector(".arcade-adventure-title")).getBoundingClientRect();
        const to = icon.getBoundingClientRect();

        const bubble = document.createElement("div");
        bubble.className = "arcade-launch-avatar";
        bubble.textContent = runner ? runner.textContent : "🚀";

        const startX = from.left + from.width / 2;
        const startY = from.top + from.height / 2;
        const dx = (to.left + to.width / 2) - startX;
        const dy = (to.top + to.height / 2) - startY;

        bubble.style.left = `${startX}px`;
        bubble.style.top = `${startY}px`;
        document.body.appendChild(bubble);

        requestAnimationFrame(() => {
          bubble.style.transform = `translate(${dx}px, ${dy}px) scale(0.82)`;
          bubble.style.opacity = "0";
        });

        window.setTimeout(() => {
          bubble.remove();
          window.location.href = href;
        }, 420);
      });
    });
  }

  function bindHomeControls(host, games) {
    const modal = host.querySelector("#recordModal");
    const openRecordBtn = host.querySelector("#openPlayerRecord");
    const closeRecordBtn = host.querySelector("#closeRecordModal");

    const profileModal = host.querySelector("#profileModal");
    const profileTitle = host.querySelector("#profileModalTitle");
    const profileNameInput = host.querySelector("#profileNameInput");
    const saveProfileBtn = host.querySelector("#saveProfileBtn");
    const cancelProfileBtn = host.querySelector("#cancelProfileBtn");
    const closeProfileBtn = host.querySelector("#closeProfileModal");
    const newPlayerBtn = host.querySelector("#newPlayerBtn");
    const editPlayerBtn = host.querySelector("#editPlayerBtn");

    let selectedAvatar = (getActiveUser() && getActiveUser().avatar) ? getActiveUser().avatar : AVATAR_OPTIONS[0];

    function refreshProfileAvatarSelection() {
      host.querySelectorAll("button[data-profile-avatar]").forEach((btn) => {
        const avatar = btn.getAttribute("data-profile-avatar");
        if (avatar === selectedAvatar) btn.classList.add("is-active");
        else btn.classList.remove("is-active");
      });
    }

    function openProfileModal(mode) {
      if (!profileModal || !profileNameInput || !profileTitle) return;
      const active = getActiveUser();

      if (mode === "new") {
        profileTitle.textContent = "Create New Player";
        profileNameInput.value = "";
        selectedAvatar = AVATAR_OPTIONS[0];
      } else {
        if (!active) {
          profileTitle.textContent = "Create New Player";
          profileNameInput.value = "";
          selectedAvatar = AVATAR_OPTIONS[0];
        } else {
          profileTitle.textContent = `Edit ${active.name}`;
          profileNameInput.value = active.name;
          selectedAvatar = active.avatar;
        }
      }

      refreshProfileAvatarSelection();
      profileModal.removeAttribute("hidden");
      window.setTimeout(() => profileNameInput.focus(), 0);
    }

    function closeProfileModal() {
      if (!profileModal) return;
      profileModal.setAttribute("hidden", "");
    }

    function saveProfile() {
      if (!profileNameInput) return;
      let name = profileNameInput.value.trim();
      if (!name) {
        name = `Player ${getUsersSorted().length + 1}`;
      }
      switchOrCreateUserByName(name);
      setActiveAvatar(selectedAvatar);
      closeProfileModal();
      renderHome();
    }

    host.querySelectorAll("button[data-user-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-user-id");
        if (!id) return;
        switchUserById(id);
        renderHome();
      });
    });

    host.querySelectorAll("button[data-profile-avatar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const avatar = btn.getAttribute("data-profile-avatar");
        if (!avatar) return;
        selectedAvatar = avatar;
        refreshProfileAvatarSelection();
      });
    });

    if (newPlayerBtn) newPlayerBtn.addEventListener("click", () => openProfileModal("new"));
    if (editPlayerBtn) editPlayerBtn.addEventListener("click", () => openProfileModal("edit"));
    if (saveProfileBtn) saveProfileBtn.addEventListener("click", saveProfile);
    if (cancelProfileBtn) cancelProfileBtn.addEventListener("click", closeProfileModal);
    if (closeProfileBtn) closeProfileBtn.addEventListener("click", closeProfileModal);

    if (profileNameInput) {
      profileNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveProfile();
        }
      });
    }

    if (profileModal) {
      profileModal.addEventListener("click", (e) => {
        if (e.target === profileModal) closeProfileModal();
      });
    }

    function closeRecord() {
      if (!modal) return;
      modal.setAttribute("hidden", "");
    }

    if (openRecordBtn && modal) {
      openRecordBtn.addEventListener("click", () => {
        modal.removeAttribute("hidden");
      });
    }

    if (closeRecordBtn) closeRecordBtn.addEventListener("click", closeRecord);

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeRecord();
      });
    }

    setupTileLaunchAnimation(host);

    const trackNodes = host.querySelectorAll(".arcade-track-node");
    if (trackNodes.length) {
      const active = getActiveUser();
      const gameOrder = listOrderedGameIds(games);
      const idx = Math.max(0, gameOrder.indexOf((active && active.adventure.lastPlayedId) || ""));
      const node = trackNodes[idx] || trackNodes[0];
      if (node) node.classList.add("is-current");
    }
  }

  function sectionId(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function renderHome() {
    const host = document.getElementById("arcadeHome");
    if (!host) return;

    const games = [...FRACTIONS_ARCADE_GAMES];
    const byId = new Map(games.map((g) => [g.id, g]));

    const active = getActiveUser();
    const users = getUsersSorted();
    const gameIds = listOrderedGameIds(games);
    const stats = countUserStats(active, gameIds);

    if (!active) {
      const profileAvatarButtons = AVATAR_OPTIONS
        .map((a, idx) => {
          const cls = idx === 0 ? "arcade-avatar-btn is-active" : "arcade-avatar-btn";
          return `<button class="${cls}" type="button" data-profile-avatar="${escapeHtml(a)}" aria-label="Choose avatar ${escapeHtml(a)}">${escapeHtml(a)}</button>`;
        })
        .join("");

      host.innerHTML = `
        <section class="arcade-adventure-card" aria-label="Adventure HQ">
          <div class="arcade-adventure-head">
            <div>
              <h2 class="arcade-adventure-title">Adventure HQ</h2>
              <div class="arcade-adventure-sub">No players yet. Create your player to begin.</div>
            </div>
            <div class="arcade-summary-badge">0% explored</div>
          </div>

          <div class="arcade-players-head">
            <div class="arcade-players-title">Players</div>
            <div class="arcade-players-actions">
              <button class="arcade-btn primary" id="newPlayerBtn" type="button">Create First Player</button>
            </div>
          </div>

          <div class="arcade-summary-grid">
            <div class="arcade-summary-item"><div class="k">Explorer</div><div class="v">Not set</div></div>
            <div class="arcade-summary-item"><div class="k">Activities Played</div><div class="v">0/${stats.totalGames}</div></div>
            <div class="arcade-summary-item"><div class="k">Stars</div><div class="v">0/0</div></div>
            <div class="arcade-summary-item"><div class="k">Score</div><div class="v">0 (0)</div></div>
          </div>
        </section>

        <div class="arcade-profile-modal" id="profileModal" hidden>
          <div class="arcade-profile-dialog">
            <button class="arcade-record-close" id="closeProfileModal" type="button" aria-label="Close profile editor">✕</button>
            <h3 class="arcade-profile-title" id="profileModalTitle">Create New Player</h3>
            <label class="arcade-profile-label" for="profileNameInput">Player Name</label>
            <input class="arcade-profile-input" id="profileNameInput" maxlength="${MAX_PLAYER_NAME}" autocomplete="off" />
            <div class="arcade-profile-avatar-grid" aria-label="Avatar choices">
              ${profileAvatarButtons}
            </div>
            <div class="arcade-profile-actions">
              <button class="arcade-btn primary" id="saveProfileBtn" type="button">Save Player</button>
            </div>
          </div>
        </div>
      `;

      bindHomeControls(host, games);
      return;
    }

    const userChips = users
      .map((u) => {
        const cls = u.id === active.id ? "arcade-user-chip is-active" : "arcade-user-chip";
        return `<button class="${cls}" type="button" data-user-id="${escapeHtml(u.id)}">${escapeHtml(u.name)}</button>`;
      })
      .join("");

    const profileAvatarButtons = AVATAR_OPTIONS
      .map((a) => {
        const cls = a === active.avatar ? "arcade-avatar-btn is-active" : "arcade-avatar-btn";
        return `<button class="${cls}" type="button" data-profile-avatar="${escapeHtml(a)}" aria-label="Choose avatar ${escapeHtml(a)}">${escapeHtml(a)}</button>`;
      })
      .join("");

    const trackNodes = gameIds
      .map((id) => {
        const g = getUserGameState(active, id);
        const stateCls = g.plays > 0 ? "arcade-track-node is-done" : "arcade-track-node";
        const label = byId.get(id) ? byId.get(id).title : id;
        return `<div class="${stateCls}" title="${escapeHtml(label)}"></div>`;
      })
      .join("");

    const recordRows = gameIds
      .map((id) => {
        const meta = byId.get(id);
        const title = meta ? meta.title : id;
        const g = getUserGameState(active, id);
        const score = gameScoreLine(g);
        const record = gameRecordLine(g);
        return `
          <div class="arcade-record-row">
            <div class="arcade-record-row-head">
              <div class="arcade-record-title">${escapeHtml(title)}</div>
              <div class="arcade-record-metrics">
                <div class="arcade-record-stars arcade-record-stars-muted">No stars</div>
                <div class="arcade-record-score">Score ${escapeHtml(score)}</div>
              </div>
            </div>
            <div class="arcade-record-meta">Plays: ${g.plays}</div>
            <div class="arcade-record-best">${escapeHtml(record)}</div>
          </div>
        `;
      })
      .join("");

    const sectionsHtml = FRACTIONS_ARCADE_SECTIONS
      .map((section) => {
        const sid = `grid-${sectionId(section.section)}`;
        return `
          <section class="arcade-sect" aria-label="${escapeHtml(section.section)}">
            <h2>${escapeHtml(section.section)}</h2>
            <div class="arcade-grid" id="${sid}"></div>
          </section>
        `;
      })
      .join("");

    host.innerHTML = `
      <section class="arcade-adventure-card" aria-label="Adventure HQ">
        <div class="arcade-adventure-head">
          <div>
            <h2 class="arcade-adventure-title">Adventure HQ</h2>
            <div class="arcade-adventure-sub">Pick an existing player. Create a new one only when needed.</div>
          </div>
          <div class="arcade-summary-badge">${stats.completionPct}% explored</div>
        </div>

        <div class="arcade-players-head">
          <div class="arcade-players-title">Players</div>
          <div class="arcade-players-actions">
            <button class="arcade-btn" id="editPlayerBtn" type="button">Edit Active</button>
            <button class="arcade-btn primary" id="newPlayerBtn" type="button">+ New Player</button>
          </div>
        </div>

        <div class="arcade-user-chip-row" aria-label="Players">
          ${userChips}
        </div>

        <div class="arcade-summary-grid">
          <div class="arcade-summary-item"><div class="k">Explorer</div><div class="v">${escapeHtml(active.name)}</div></div>
          <div class="arcade-summary-item"><div class="k">Activities Played</div><div class="v">${stats.explored}/${stats.totalGames}</div></div>
          <div class="arcade-summary-item"><div class="k">Stars</div><div class="v">0/0</div></div>
          <div class="arcade-summary-item"><div class="k">Score</div><div class="v">${stats.totalScore} (${stats.scoredGames})</div></div>
        </div>

        <div class="arcade-progress" aria-label="Adventure progress">
          <div class="arcade-progress-fill" style="width:${stats.completionPct}%"></div>
        </div>

        <div class="arcade-track" aria-label="Adventure track">
          <button class="arcade-track-avatar-wrap" id="openPlayerRecord" type="button" aria-label="Open ${escapeHtml(active.name)} record">
            <div class="arcade-track-avatar-name">${escapeHtml(active.name)}</div>
            <div class="arcade-track-avatar" id="trackAvatar">${escapeHtml(active.avatar)}</div>
          </button>
          ${trackNodes}
        </div>
      </section>

      ${sectionsHtml}

      <section class="arcade-sect" aria-label="Parents">
        <h2>Parents</h2>
        <a class="arcade-btn" href="settings.html">⚙️ Manage Progress</a>
      </section>

      <div class="arcade-record-modal" id="recordModal" hidden>
        <div class="arcade-record-dialog">
          <button class="arcade-record-close" id="closeRecordModal" type="button" aria-label="Close record">✕</button>
          <div class="arcade-record-header">
            <div class="arcade-record-avatar">${escapeHtml(active.avatar)}</div>
            <div>
              <div class="arcade-record-name">${escapeHtml(active.name)}</div>
              <div class="arcade-record-subtitle">Adventure Record Book</div>
            </div>
          </div>
          <div class="arcade-record-summary">
            <div class="arcade-record-pill">Activities ${stats.explored}/${stats.totalGames}</div>
            <div class="arcade-record-pill">Stars 0/0</div>
            <div class="arcade-record-pill">Score ${stats.totalScore}</div>
            <div class="arcade-record-pill">Launches ${active.adventure.totalLaunches || 0}</div>
          </div>
          <div class="arcade-record-list">
            ${recordRows}
          </div>
        </div>
      </div>

      <div class="arcade-profile-modal" id="profileModal" hidden>
        <div class="arcade-profile-dialog">
          <button class="arcade-record-close" id="closeProfileModal" type="button" aria-label="Close profile editor">✕</button>
          <h3 class="arcade-profile-title" id="profileModalTitle">Edit Player</h3>
          <label class="arcade-profile-label" for="profileNameInput">Player Name</label>
          <input class="arcade-profile-input" id="profileNameInput" maxlength="${MAX_PLAYER_NAME}" autocomplete="off" />
          <div class="arcade-profile-avatar-grid" aria-label="Avatar choices">
            ${profileAvatarButtons}
          </div>
          <div class="arcade-profile-actions">
            <button class="arcade-btn" id="cancelProfileBtn" type="button">Cancel</button>
            <button class="arcade-btn primary" id="saveProfileBtn" type="button">Save Player</button>
          </div>
        </div>
      </div>
    `;

    function tileHtml(g) {
      const s = getUserGameState(active, g.id);
      const played = s.plays > 0;
      const score = gameScoreLine(s);

      const classes = ["arcade-tile"];
      if (played) classes.push("is-played");

      const progressText = played
        ? `Played ${s.plays} time${s.plays === 1 ? "" : "s"}`
        : (g.tag || "New activity");

      return `
        <a class="${classes.join(" ")}" href="${g.href}" data-kind="${g.kind || "game"}" data-game-id="${g.id}">
          <div class="arcade-badge" aria-hidden="true">${g.badge || "📘"}</div>
          <div class="tile-icon" aria-hidden="true">${g.icon || "🎲"}</div>
          <div class="tile-name">${g.title}</div>
          <div class="tile-desc">${g.desc || ""}</div>
          <div class="tile-performance">
            <div class="tile-stars tile-stars-muted">No stars</div>
            <div class="tile-score">Score ${escapeHtml(score)}</div>
          </div>
          <div class="tile-progress">${progressText}</div>
        </a>
      `;
    }

    function fill(gridId, ids) {
      const grid = document.getElementById(gridId);
      if (!grid) return;
      grid.innerHTML = ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map(tileHtml)
        .join("");
    }

    FRACTIONS_ARCADE_SECTIONS.forEach((section) => {
      fill(
        `grid-${sectionId(section.section)}`,
        section.items.map((item) => item.id)
      );
    });

    bindHomeControls(host, games);
  }

  function resetActiveUserProgress() {
    const user = getActiveUser();
    if (!user || !user.id) return 0;
    const id = user.id;
    const scopePrefix = `${STORAGE_SCOPE_PREFIX}${id}::`;

    const keys = [];
    if ("localStorage" in window) {
      initStorageNative();
      for (let i = 0; i < localStorage.length; i++) {
        const k = storageNative.key.call(localStorage, i);
        if (!k) continue;
        if (k === PROFILE_STORAGE_KEY || k.startsWith("fractionsArcade_global_")) continue;

        if (k.startsWith(scopePrefix)) {
          keys.push(k);
          continue;
        }

        if (SCOPED_KEY_PREFIXES.some((p) => k.startsWith(p)) || RECORD_KEY_TO_GAME_ID[k]) {
          keys.push(k);
        }
      }
    }

    keys.forEach((k) => safeNativeRemove(k));

    user.adventure = {
      totalLaunches: 0,
      lastPlayedId: "",
      games: {}
    };
    touchUser(user);
    saveProfiles();

    return keys.length;
  }

  function setupParentalGate() {
    const qEl = document.getElementById("gateQuestion");
    const ansEl = document.getElementById("gateAnswer");
    const unlockBtn = document.getElementById("gateUnlock");
    const resetBtn = document.getElementById("resetProgress");
    const msgEl = document.getElementById("gateMsg");
    const playerListEl = document.getElementById("playerList");

    if (!qEl || !ansEl || !unlockBtn || !resetBtn) return;
    let unlocked = false;

    const active = getActiveUser();
    const activeNameEl = document.getElementById("activePlayerName");
    if (activeNameEl) {
      activeNameEl.textContent = active ? `${active.avatar} ${active.name}` : "None";
    }

    const a = 3 + Math.floor(Math.random() * 7);
    const b = 2 + Math.floor(Math.random() * 7);
    const correct = a + b;

    qEl.textContent = `To unlock, answer: ${a} + ${b} = ?`;

    function setMsg(txt) {
      if (msgEl) msgEl.textContent = txt || "";
    }

    function renderPlayerManager() {
      if (!playerListEl) return;
      const users = getUsersSorted();
      const activeNow = getActiveUser();
      const activeId = activeNow ? activeNow.id : "";

      if (!users.length) {
        playerListEl.innerHTML = `<div class="note">No players found.</div>`;
        return;
      }

      playerListEl.innerHTML = users.map((u) => {
        const activeTag = u.id === activeId ? " (active)" : "";
        const disabled = (!unlocked) ? "disabled" : "";
        return `
          <div class="arcade-user-chip${u.id === activeId ? " is-active" : ""}" style="display:flex;align-items:center;gap:8px;">
            <span>${escapeHtml(u.avatar)} ${escapeHtml(u.name)}${activeTag}</span>
            <button class="arcade-btn" type="button" data-delete-user="${escapeHtml(u.id)}" ${disabled} style="height:36px;padding:0 10px;font-size:13px;">Delete</button>
          </div>
        `;
      }).join("");

      playerListEl.querySelectorAll("button[data-delete-user]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!unlocked) return;
          const id = btn.getAttribute("data-delete-user");
          if (!id) return;
          const state = loadProfiles();
          const name = (state.users[id] && state.users[id].name) ? state.users[id].name : "this player";
          const ok = window.confirm(`Delete player ${name}? This removes that player's saved progress on this device.`);
          if (!ok) return;

          const res = deleteUserById(id);
          if (!res.ok) {
            setMsg("Could not delete that player.");
            return;
          }

          const current = getActiveUser();
          const activeText = current ? `Active player is now ${current.name}.` : "No active player.";
          setMsg(`Deleted player. ${activeText} Removed ${res.removedKeys} saved item${res.removedKeys === 1 ? "" : "s"}.`);
          renderPlayerManager();
          const activeNameAgain = document.getElementById("activePlayerName");
          if (activeNameAgain) activeNameAgain.textContent = current ? `${current.avatar} ${current.name}` : "None";
        });
      });
    }

    unlockBtn.addEventListener("click", () => {
      const v = parseInt(ansEl.value.trim(), 10);
      if (!Number.isFinite(v)) { setMsg("Type a number."); return; }
      if (v === correct) {
        unlocked = true;
        resetBtn.disabled = false;
        setMsg("Unlocked.");
        renderPlayerManager();
      } else {
        setMsg("Not correct.");
      }
    });

    resetBtn.addEventListener("click", () => {
      const removed = resetActiveUserProgress();
      const current = getActiveUser();
      if (!current) {
        setMsg("No active player to reset.");
      } else {
        setMsg(`Progress reset for ${current.name} (${removed} item${removed === 1 ? "" : "s"}).`);
      }
      resetBtn.disabled = true;
      ansEl.value = "";
      unlocked = false;
      renderPlayerManager();
    });

    renderPlayerManager();
  }

  function publishProgressApi() {
    const api = {
      getActiveUserName: () => {
        const u = getActiveUser();
        return u ? u.name : "";
      },
      setActiveUserName: (name) => switchOrCreateUserByName(name).name,
      getActiveAvatar: () => {
        const u = getActiveUser();
        return u ? u.avatar : "";
      },
      setActiveAvatar: setActiveAvatar,
      recordGameLaunch: recordGameLaunch
    };

    // Expose both names for compatibility with existing activities.
    window.FractionsArcadeProgress = api;
    window.MathArcadeProgress = api;
  }

  function currentPageName() {
    return (window.location.pathname.split("/").pop() || "").toLowerCase();
  }

  function isGamePage() {
    const page = currentPageName();
    return !!page && page !== "index.html" && page !== "settings.html";
  }

  function injectArcadeBackButton() {
    if (!isGamePage()) return;

    const attach = () => {
      if (!document.body) return;
      if (document.querySelector("[data-arcade-back-button]")) return;

      const styleId = "fractionsArcadeBackButtonStyle";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          .arcade-game-back-btn{
            position:fixed;
            left:14px;
            top:14px;
            z-index:9999;
            display:inline-flex;
            align-items:center;
            gap:6px;
            border-radius:999px;
            padding:9px 14px;
            text-decoration:none;
            font:800 14px/1.1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
            letter-spacing:.2px;
            color:#ffffff;
            background:rgba(11, 49, 130, 0.92);
            border:2px solid rgba(255,255,255,0.28);
            box-shadow:0 8px 18px rgba(6,20,60,0.25);
            backdrop-filter:blur(4px);
          }
          .arcade-game-back-btn:hover{
            transform:translateY(-1px);
            background:rgba(15, 66, 170, 0.95);
          }
          .arcade-game-back-btn:focus-visible{
            outline:3px solid #ffd54f;
            outline-offset:2px;
          }
          @media (max-width:640px){
            .arcade-game-back-btn{
              left:10px;
              top:10px;
              padding:8px 12px;
              font-size:13px;
            }
          }
        `;
        document.head.appendChild(style);
      }

      const link = document.createElement("a");
      link.href = "index.html";
      link.className = "arcade-game-back-btn";
      link.setAttribute("data-arcade-back-button", "1");
      link.setAttribute("aria-label", "Back to Arcade home");
      link.textContent = "← Arcade";
      document.body.appendChild(link);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", attach, { once: true });
      return;
    }
    attach();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  function trackCurrentGameLaunch() {
    if (!isGamePage()) return;
    if (!getActiveUser()) return;

    const gameId = getCurrentGameId();
    if (!gameId) return;
    recordGameLaunch(gameId);
  }

  // Init
  loadProfiles();
  installUserScopedStorage();

  const activeNow = getActiveUser();
  if (activeNow && activeNow.id) {
    maybeMigrateLegacyDataForUser(activeNow.id);
  }

  publishProgressApi();
  registerServiceWorker();
  injectArcadeBackButton();
  renderHome();
  setupParentalGate();
  trackCurrentGameLaunch();

})();

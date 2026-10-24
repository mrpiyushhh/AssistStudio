/*
 * AssistStudio site chatbot
 * Logic mirrored from dummy_chatbot_ui/app.js (WebSocket streaming, sessions, markdown, book_call).
 * UI classes match the official site widget only.
 */

(function () {
  const API_PORT = 8765;
  const pageHost = window.location.hostname || "localhost";
  const defaultApiBase = `http://${pageHost}:${API_PORT}`;
  const defaultWsBase = `${window.location.protocol === "https:" ? "wss" : "ws"}://${pageHost}:${API_PORT}`;

  const CONFIG = {
    transport: "websocket", // "websocket" | "rest" | "dummy"
    apiBaseUrl: null,
    websocketBase: null,
    dummyResponseDelay: 900,
    sessionStorageKey: "assiststudio_session_id",
  };

  CONFIG.apiBaseUrl = CONFIG.apiBaseUrl || defaultApiBase;
  CONFIG.websocketBase = CONFIG.websocketBase || defaultWsBase;

  const state = {
    sessionId: null,
    messages: [],
    isSending: false,
    socket: null,
    socketReady: false,
    pendingResolve: null,
    pendingReject: null,
    streamBuffer: "",
    streamBubbleEl: null,
  };

  const root = document.querySelector("[data-chatbot]");
  if (!root) return;

  const elements = {
    root,
    panel: document.getElementById("chatbot-panel"),
    toggle: document.querySelector("[data-chatbot-toggle]"),
    close: document.querySelector("[data-chatbot-close]"),
    clear: document.querySelector("[data-chatbot-clear]"),
    messages: document.querySelector("[data-chatbot-messages]"),
    form: document.querySelector("[data-chatbot-form]"),
    input: document.getElementById("chatbot-input"),
    send: document.querySelector(".chatbot-send"),
    typing: document.querySelector("[data-chatbot-typing]"),
  };

  if (!elements.messages || !elements.form || !elements.input) return;

  // ---------------------------------------------------------------------------
  // Panel open / close (keeps existing site behaviour)
  // ---------------------------------------------------------------------------

  function setPanelOpen(open) {
    elements.root.classList.toggle("is-open", open);
    if (elements.panel) elements.panel.hidden = !open;
    elements.toggle?.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("chatbot-open", open);
    if (open) {
      setTimeout(() => elements.input?.focus(), 50);
    } else {
      elements.toggle?.focus();
    }
  }

  elements.toggle?.addEventListener("click", () => {
    const willOpen = !!(elements.panel && elements.panel.hidden);
    setPanelOpen(willOpen);
  });
  elements.close?.addEventListener("click", () => setPanelOpen(false));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && elements.panel && !elements.panel.hidden) {
      setPanelOpen(false);
    }
  });

  // ---------------------------------------------------------------------------
  // Session helpers
  // ---------------------------------------------------------------------------

  function persistSessionId(sessionId) {
    try {
      if (sessionId) sessionStorage.setItem(CONFIG.sessionStorageKey, sessionId);
      else sessionStorage.removeItem(CONFIG.sessionStorageKey);
    } catch {
      /* ignore */
    }
  }

  function readStoredSessionId() {
    try {
      return sessionStorage.getItem(CONFIG.sessionStorageKey);
    } catch {
      return null;
    }
  }

  function endSessionBeacon(sessionId) {
    if (!sessionId || CONFIG.transport === "dummy") return;
    const url = `${CONFIG.apiBaseUrl}/chat/sessions/${sessionId}/end`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([], { type: "application/json" }));
    } else {
      fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    }
  }

  async function endSessionOnServer(sessionId) {
    if (!sessionId || CONFIG.transport === "dummy") return;
    try {
      await fetch(`${CONFIG.apiBaseUrl}/chat/sessions/${sessionId}/end`, {
        method: "POST",
        headers: { Accept: "application/json" },
        keepalive: true,
      });
    } catch {
      /* best-effort */
    }
  }

  async function createServerSession() {
    const previousId = readStoredSessionId();
    if (previousId) {
      await endSessionOnServer(previousId);
      persistSessionId(null);
    }

    const response = await fetch(`${CONFIG.apiBaseUrl}/chat/sessions`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const detail = await safeErrorDetail(response);
      throw new Error(`Failed to create session (${response.status}): ${detail}`);
    }

    const data = await response.json();
    state.sessionId = data.session_id;
    persistSessionId(state.sessionId);
    return state.sessionId;
  }

  async function ensureSession() {
    if (state.sessionId) return state.sessionId;
    return createServerSession();
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  function scrollToBottom() {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function renderMarkdown(text) {
    if (!text) return "";
    if (typeof marked === "undefined") {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    }
    marked.setOptions({ gfm: true, breaks: true });
    const rawHtml = marked.parse(text);
    if (typeof DOMPurify !== "undefined") {
      return DOMPurify.sanitize(rawHtml);
    }
    return rawHtml;
  }

  function setBubbleContent(el, content, { markdown = false } = {}) {
    if (!el) return;
    if (markdown) {
      el.classList.add("markdown-body");
      el.classList.remove("streaming");
      el.innerHTML = renderMarkdown(content);
    } else {
      el.classList.remove("markdown-body");
      el.textContent = content;
    }
  }

  function addMessage(role, content) {
    const message = {
      role: role === "bot" ? "assistant" : role,
      content,
      timestamp: new Date().toISOString(),
    };
    state.messages.push(message);

    const uiRole = role === "assistant" ? "bot" : role === "bot" ? "bot" : "user";
    const el = document.createElement("div");
    el.className = `chatbot-msg chatbot-msg--${uiRole}`;
    setBubbleContent(el, content, { markdown: uiRole === "bot" });
    elements.messages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function beginStreamBubble() {
    const el = document.createElement("div");
    el.className = "chatbot-msg chatbot-msg--bot streaming";
    elements.messages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function appendStreamToken(token) {
    if (!state.streamBubbleEl) {
      state.streamBubbleEl = beginStreamBubble();
    }
    state.streamBuffer += token;
    state.streamBubbleEl.classList.add("streaming");
    state.streamBubbleEl.textContent = state.streamBuffer;
    scrollToBottom();
  }

  function finalizeStreamMessage() {
    const content = state.streamBuffer;
    if (content && state.streamBubbleEl) {
      setBubbleContent(state.streamBubbleEl, content, { markdown: true });
      state.messages.push({
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
      });
    }
    state.streamBuffer = "";
    state.streamBubbleEl = null;
    return content;
  }

  function discardStreamBubble() {
    if (state.streamBubbleEl) {
      state.streamBubbleEl.remove();
    }
    state.streamBuffer = "";
    state.streamBubbleEl = null;
  }

  /** Booking card — UI-owned; server only signals type: "book_call". */
  function addBookCallCard() {
    const email = "contactus@assiststudio.in";
    const label = "Book a Discovery Call";
    const contactUrl = "#contact";
    const message = "You can simply book a call by clicking the button below:";

    state.messages.push({
      role: "assistant",
      content: `[Book a Discovery Call] ${message} ${email}`,
      timestamp: new Date().toISOString(),
    });

    const el = document.createElement("div");
    el.className = "chatbot-msg chatbot-msg--bot book-call-card";
    el.innerHTML = `
      <p class="book-call-text"></p>
      <a class="book-call-button"></a>
      <p class="book-call-email">
        or else you can directly connect us at
        <a class="book-call-email-link"></a>
      </p>
    `;
    el.querySelector(".book-call-text").textContent = message;
    const btn = el.querySelector(".book-call-button");
    btn.textContent = label;
    btn.href = contactUrl;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setPanelOpen(false);
      const target = document.getElementById("contact");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#contact");
      } else {
        window.location.hash = "contact";
      }
    });
    const mailLink = el.querySelector(".book-call-email-link");
    mailLink.textContent = email;
    mailLink.href = `mailto:${email}`;

    elements.messages.appendChild(el);
    scrollToBottom();
  }

  function setTyping(visible) {
    if (!elements.typing) return;
    elements.typing.hidden = !visible;
    if (visible) {
      elements.messages.appendChild(elements.typing);
      scrollToBottom();
    }
  }

  function setSending(sending) {
    state.isSending = sending;
    if (elements.send) elements.send.disabled = sending;
    if (elements.input) elements.input.disabled = sending;
  }

  function resetMessagesUI() {
    elements.messages.innerHTML = `
      <div class="chatbot-msg chatbot-msg--bot">
        <p>Hi — ask anything about our services or process. I'm here to help.</p>
      </div>
    `;
    if (elements.typing) {
      elements.messages.appendChild(elements.typing);
      elements.typing.hidden = true;
    }
  }

  async function safeErrorDetail(response) {
    try {
      const data = await response.json();
      return data.detail || JSON.stringify(data);
    } catch {
      return response.statusText || "Unknown error";
    }
  }

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------

  function wsUrlForSession(sessionId) {
    return `${CONFIG.websocketBase}/ws/chat/${sessionId}`;
  }

  function closeSocket() {
    if (state.socket) {
      try {
        state.socket.onopen = null;
        state.socket.onmessage = null;
        state.socket.onerror = null;
        state.socket.onclose = null;
        state.socket.close();
      } catch {
        /* ignore */
      }
    }
    state.socket = null;
    state.socketReady = false;
  }

  function connectWebSocket(sessionId) {
    return new Promise((resolve, reject) => {
      closeSocket();

      const url = wsUrlForSession(sessionId);
      const socket = new WebSocket(url);
      state.socket = socket;
      let opened = false;

      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timed out."));
        closeSocket();
      }, 10000);

      socket.onopen = () => {
        clearTimeout(timeout);
        opened = true;
        state.socketReady = true;
        resolve(socket);
      };

      socket.onmessage = (event) => {
        handleWsMessage(event);
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        if (!opened) {
          reject(new Error("WebSocket connection failed."));
        }
      };

      socket.onclose = (event) => {
        state.socketReady = false;
        state.socket = null;

        if (state.pendingReject) {
          state.pendingReject(new Error("WebSocket closed during response."));
          state.pendingResolve = null;
          state.pendingReject = null;
        }

        if (event.code === 4004) {
          state.sessionId = null;
          persistSessionId(null);
        }
      };
    });
  }

  async function ensureWebSocket() {
    if (
      state.socket &&
      state.socketReady &&
      state.socket.readyState === WebSocket.OPEN
    ) {
      return state.socket;
    }

    let sessionId = await ensureSession();

    try {
      await connectWebSocket(sessionId);
      return state.socket;
    } catch (err) {
      console.warn("[ws] connect failed, recreating session…", err);
      state.sessionId = null;
      persistSessionId(null);
      sessionId = await createServerSession();
      await connectWebSocket(sessionId);
      return state.socket;
    }
  }

  function handleWsMessage(event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    const type = data.type;

    if (type === "token") {
      if (!state.streamBubbleEl) setTyping(false);
      appendStreamToken(data.content || "");
      return;
    }

    if (type === "book_call") {
      setTyping(false);
      discardStreamBubble();
      addBookCallCard();
      setSending(false);
      if (state.pendingResolve) {
        state.pendingResolve("");
        state.pendingResolve = null;
        state.pendingReject = null;
      }
      elements.input.focus();
      return;
    }

    if (type === "end") {
      setTyping(false);
      const full = finalizeStreamMessage();
      setSending(false);
      if (state.pendingResolve) {
        state.pendingResolve(full || "");
        state.pendingResolve = null;
        state.pendingReject = null;
      }
      elements.input.focus();
      return;
    }

    if (type === "error") {
      setTyping(false);

      if (data.code === "session_not_found") {
        state.sessionId = null;
        persistSessionId(null);
        discardStreamBubble();
        setSending(false);
        if (state.pendingReject) {
          state.pendingReject(new Error("Session expired. Please send again."));
          state.pendingResolve = null;
          state.pendingReject = null;
        }
        createServerSession()
          .then((id) => connectWebSocket(id))
          .catch((err) => console.error("[ws] recovery failed", err));
        addMessage(
          "assistant",
          "Your session was reset (server may have restarted). Please send your message again."
        );
        elements.input.focus();
        return;
      }

      if (!state.streamBuffer) {
        addMessage(
          "assistant",
          data.message || "Something went wrong. Please try again."
        );
      } else {
        finalizeStreamMessage();
      }
      setSending(false);
      if (state.pendingReject) {
        state.pendingReject(new Error(data.message || "Server error"));
        state.pendingResolve = null;
        state.pendingReject = null;
      }
      elements.input.focus();
    }
  }

  function sendViaWebSocket(message) {
    return new Promise(async (resolve, reject) => {
      try {
        const socket = await ensureWebSocket();
        state.streamBuffer = "";
        state.streamBubbleEl = null;
        state.pendingResolve = resolve;
        state.pendingReject = reject;
        socket.send(
          JSON.stringify({
            type: "message",
            content: message,
          })
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  async function sendViaRest(message) {
    const sessionId = await ensureSession();
    const response = await fetch(
      `${CONFIG.apiBaseUrl}/chat/sessions/${sessionId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ content: message }),
      }
    );
    if (!response.ok) {
      const detail = await safeErrorDetail(response);
      throw new Error(`Chat request failed (${response.status}): ${detail}`);
    }
    const data = await response.json();
    return data.content ?? "";
  }

  async function sendMessageToBackend(message) {
    if (CONFIG.transport === "websocket") {
      return sendViaWebSocket(message);
    }
    if (CONFIG.transport === "rest") {
      return sendViaRest(message);
    }
    await new Promise((r) => setTimeout(r, CONFIG.dummyResponseDelay));
    return `Dummy response: I received your message — “${message}”`;
  }

  // ---------------------------------------------------------------------------
  // Log / restart / end
  // ---------------------------------------------------------------------------

  async function logConversationToServer() {
    if (!state.sessionId || state.messages.length === 0) return;
    const payload = {
      messages: state.messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      metadata: {
        user_agent: navigator.userAgent,
        page_url: window.location.href,
      },
    };
    try {
      await fetch(`${CONFIG.apiBaseUrl}/chat/sessions/${state.sessionId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      /* ignore */
    }
  }

  function logAndEndBeacon() {
    if (!state.sessionId || CONFIG.transport === "dummy") return;

    if (state.messages.length > 0) {
      const payload = JSON.stringify({
        messages: state.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        metadata: {
          user_agent: navigator.userAgent,
          page_url: window.location.href,
        },
      });
      const logUrl = `${CONFIG.apiBaseUrl}/chat/sessions/${state.sessionId}/log`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          logUrl,
          new Blob([payload], { type: "application/json" })
        );
      }
    }
    endSessionBeacon(state.sessionId);
  }

  async function restartConversation() {
    closeSocket();

    if (state.sessionId && CONFIG.transport !== "dummy") {
      await logConversationToServer();
      try {
        await fetch(
          `${CONFIG.apiBaseUrl}/chat/sessions/${state.sessionId}/restart`,
          { method: "POST", headers: { Accept: "application/json" } }
        );
      } catch (error) {
        console.warn("Restart request failed:", error);
      }
    }

    state.messages = [];
    state.streamBuffer = "";
    state.streamBubbleEl = null;
    resetMessagesUI();
    setTyping(false);
    setSending(false);
    elements.input.value = "";
    elements.input.focus();

    if (CONFIG.transport === "websocket" && state.sessionId) {
      try {
        await connectWebSocket(state.sessionId);
      } catch (error) {
        console.warn("WebSocket reconnect after restart failed:", error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  async function handleSubmit(event) {
    event.preventDefault();
    const message = elements.input.value.trim();
    if (!message || state.isSending) return;

    addMessage("user", message);
    elements.input.value = "";
    setSending(true);
    setTyping(true);

    try {
      const response = await sendMessageToBackend(message);
      if (CONFIG.transport !== "websocket") {
        setTyping(false);
        addMessage(
          "assistant",
          response || "The assistant returned an empty response."
        );
        setSending(false);
        elements.input.focus();
      }
    } catch (error) {
      setTyping(false);
      if (!state.streamBuffer) {
        addMessage(
          "assistant",
          `Sorry, something went wrong while contacting the server.\n\n${error.message}`
        );
      } else {
        finalizeStreamMessage();
      }
      setSending(false);
      elements.input.focus();
    }
  }

  elements.form.addEventListener("submit", handleSubmit);
  elements.clear?.addEventListener("click", () => {
    restartConversation();
  });

  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });

  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    closeSocket();
    logAndEndBeacon();
  });

  // Boot: create session, then open WebSocket
  (async function boot() {
    if (CONFIG.transport === "dummy") return;
    try {
      await createServerSession();
      if (CONFIG.transport === "websocket") {
        await connectWebSocket(state.sessionId);
      }
    } catch (error) {
      console.error("Could not initialize chat:", error);
    }
  })();
})();

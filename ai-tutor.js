// =====================================
// SMART EDUCATION AI - AI PERSONAL TUTOR
// =====================================

let activeUser = null;
let activeChatId = null;
let activeMessages = [];
let isProcessing = false;

document.addEventListener("DOMContentLoaded", () => {
    initUser();
    loadRecentChats();
    setupEventListeners();
});

function initUser() {
    try {
        const studentStr = localStorage.getItem("student");
        if (studentStr) activeUser = JSON.parse(studentStr);
        else {
            const userStr = localStorage.getItem("currentUser");
            if (userStr) activeUser = JSON.parse(userStr);
        }
    } catch (e) {
        console.error("Error reading stored user:", e);
    }

    if (!activeUser || !activeUser.id) {
        alert("Please login first to access your AI Personal Tutor.");
        window.location.href = "login.html";
        return;
    }

    const nameEl = document.getElementById("welcomeUserName");
    const initialEl = document.getElementById("userInitial");
    const greetingEl = document.getElementById("emptyStateGreeting");

    if (nameEl) nameEl.textContent = activeUser.name || "Student";
    if (initialEl) initialEl.textContent = (activeUser.name ? activeUser.name[0] : "S").toUpperCase();
    if (greetingEl) greetingEl.textContent = `Hello ${activeUser.name || 'Student'} 👋`;

    activeChatId = Date.now().toString();
}

function setupEventListeners() {
    const input = document.getElementById("tutorInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

function updateContext() {
    const subj = document.getElementById("contextSubject")?.value || "General";
    const diff = document.getElementById("contextDifficulty")?.value || "Intermediate";
    const topic = document.getElementById("contextTopic")?.value || "";

    const badge = document.getElementById("activeContextBadge");
    if (badge) {
        badge.textContent = `${subj}${topic ? ' (' + topic + ')' : ''} • ${diff}`;
    }
}

function startNewChat() {
    activeChatId = Date.now().toString();
    activeMessages = [];
    const container = document.getElementById("chatMessagesBox");
    const emptyState = document.getElementById("emptyState");

    if (container) {
        container.innerHTML = "";
        if (emptyState) container.appendChild(emptyState);
    }
    if (emptyState) emptyState.style.display = "block";

    // Highlight active chat in sidebar
    document.querySelectorAll(".chat-thread-item").forEach(el => el.classList.remove("active"));
}

async function loadRecentChats() {
    if (!activeUser || !activeUser.id) return;
    const sidebarList = document.getElementById("recentChatsList");
    if (!sidebarList) return;

    try {
        const res = await fetch(`/api/chats/${activeUser.id}`);
        if (!res.ok) throw new Error("Failed to load user chats.");

        const chats = await res.json();
        if (chats.length === 0) {
            sidebarList.innerHTML = `<p style="font-size: 12px; color: #94a3b8; padding: 6px;">No recent chats. Start your first session!</p>`;
            return;
        }

        sidebarList.innerHTML = chats.map(c => `
            <div class="chat-thread-item ${c.id === activeChatId ? 'active' : ''}" onclick="loadChatThread('${c.id}')">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                    <span style="font-weight: 600; color: #fff;">${escapeHtml(c.title || "Study Session")}</span>
                    <div style="font-size: 11px; color: #64748b;">${c.subject || 'General'} • ${c.messageCount} msgs</div>
                </div>
                <button onclick="event.stopPropagation(); deleteChat('${c.id}')" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 12px; padding: 2px 6px;">🗑️</button>
            </div>
        `).join("");
    } catch (e) {
        console.error("Load recent chats error:", e);
        sidebarList.innerHTML = `<p style="font-size: 12px; color: #f87171; padding: 6px;">Failed to load history.</p>`;
    }
}

async function loadChatThread(chatId) {
    if (!activeUser || !activeUser.id) return;

    try {
        const res = await fetch(`/api/chats/${activeUser.id}/${chatId}`);
        if (!res.ok) throw new Error("Failed to fetch thread.");

        const chat = await res.json();
        activeChatId = chat.id;
        activeMessages = Array.isArray(chat.messages) ? chat.messages : [];

        const container = document.getElementById("chatMessagesBox");
        const emptyState = document.getElementById("emptyState");

        if (container) {
            container.innerHTML = "";
            if (activeMessages.length === 0 && emptyState) {
                container.appendChild(emptyState);
                emptyState.style.display = "block";
            } else {
                if (emptyState) emptyState.style.display = "none";
                activeMessages.forEach(m => {
                    renderBubble(m.role === "user" ? "user" : "ai", m.text, m.time || "Just now");
                });
            }
        }

        loadRecentChats();
    } catch (e) {
        console.error("Load thread error:", e);
        alert("Failed to load conversation thread.");
    }
}

async function deleteChat(chatId) {
    if (!confirm("Are you sure you want to delete this conversation thread?")) return;

    try {
        const res = await fetch(`/api/chats/${activeUser.id}/${chatId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed.");

        if (activeChatId === chatId) {
            startNewChat();
        }
        loadRecentChats();
    } catch (e) {
        console.error("Delete chat error:", e);
        alert("Failed to delete chat.");
    }
}

function clearCurrentConversation() {
    if (confirm("Clear all messages in this conversation session?")) {
        startNewChat();
    }
}

function useSuggestion(promptText) {
    const input = document.getElementById("tutorInput");
    if (input) {
        input.value = promptText;
        sendMessage();
    }
}

function triggerQuickAction(actionName) {
    if (isProcessing) return;

    let targetTopic = document.getElementById("contextTopic")?.value || "";
    if (!targetTopic && activeMessages.length > 0) {
        // Grab context from last user message
        const lastUser = [...activeMessages].reverse().find(m => m.role === "user");
        if (lastUser) targetTopic = lastUser.text;
    }

    if (!targetTopic) {
        targetTopic = prompt(`Enter topic for "${actionName}":`) || "General Study Topic";
    }

    const promptMessage = `Action request: ${actionName} for topic: "${targetTopic}"`;
    sendMessage(promptMessage, actionName);
}

async function sendMessage(overrideText, quickActionName) {
    if (isProcessing) return;

    const input = document.getElementById("tutorInput");
    const text = overrideText || (input ? input.value.trim() : "");

    if (!text) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Hide Empty state
    const emptyState = document.getElementById("emptyState");
    if (emptyState) emptyState.style.display = "none";

    // Add user message
    activeMessages.push({ role: "user", text: text, time: timestamp });
    renderBubble("user", text, timestamp);

    if (input && !overrideText) input.value = "";

    // Set Loading UI
    setLoadingState(true);

    try {
        const lang = document.getElementById("contextLanguage")?.value || "English";
        const subject = document.getElementById("contextSubject")?.value || "General";
        const topic = document.getElementById("contextTopic")?.value || "";
        const difficulty = document.getElementById("contextDifficulty")?.value || "Intermediate";

        const res = await fetch("/api/ai/tutor-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: activeUser.id,
                userName: activeUser.name,
                messages: activeMessages,
                language: lang,
                subject: subject,
                topic: topic,
                difficulty: difficulty,
                quickAction: quickActionName,
                chatId: activeChatId
            })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.error || `AI Request failed with status ${res.status}`);
        }

        const aiAnswer = data.answer || "No response received.";
        const aiTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        activeMessages.push({ role: "model", text: aiAnswer, time: aiTimestamp });
        renderBubble("ai", aiAnswer, aiTimestamp);

        // Save conversation thread to backend DB
        const threadTitle = activeMessages.find(m => m.role === "user")?.text.slice(0, 40) || "Study Session";
        await fetch("/api/chats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: activeUser.id,
                chatId: activeChatId,
                title: threadTitle,
                messages: activeMessages,
                subject: subject,
                topic: topic,
                difficulty: difficulty
            })
        });

        loadRecentChats();
    } catch (e) {
        console.error("Send Message error:", e);
        const errTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        renderBubble("ai", `⚠️ **Error**: ${e.message || "Failed to reach AI Tutor server."}\n\nPlease verify your connection and click **🔄 Regenerate** to retry.`, errTimestamp);
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(loading) {
    isProcessing = loading;
    const sendBtn = document.getElementById("sendBtn");
    const input = document.getElementById("tutorInput");
    const indicator = document.getElementById("typingIndicator");

    if (sendBtn) {
        sendBtn.disabled = loading;
        sendBtn.textContent = loading ? "⏳ Thinking..." : "🚀 Send";
    }
    if (input) input.disabled = loading;
    if (indicator) indicator.style.display = loading ? "block" : "none";
}

function renderBubble(role, text, time) {
    const container = document.getElementById("chatMessagesBox");
    if (!container) return;

    const div = document.createElement("div");
    div.className = `msg-bubble ${role}`;

    const senderName = role === "user" ? (activeUser ? activeUser.name : "Student") : "🤖 AI Personal Tutor";
    const parsedContent = role === "ai" ? renderMarkdownSafe(text) : escapeHtml(text).replace(/\n/g, "<br>");

    let actionBar = "";
    if (role === "ai") {
        actionBar = `
            <div class="msg-actions-bar">
                <button class="action-chip-btn" onclick="copyText(this)">📋 Copy</button>
                <button class="action-chip-btn" onclick="regenerateLastResponse()">🔄 Regenerate</button>
                <button class="action-chip-btn" onclick="askFollowUp()">💬 Ask Follow-up</button>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="msg-header">
            <span class="msg-sender">${escapeHtml(senderName)}</span>
            <span class="msg-time">${time}</span>
        </div>
        <div class="msg-body">${parsedContent}</div>
        ${actionBar}
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function copyText(btn) {
    const body = btn.closest(".msg-bubble").querySelector(".msg-body");
    if (!body) return;

    navigator.clipboard.writeText(body.innerText);
    btn.textContent = "✅ Copied!";
    setTimeout(() => { btn.textContent = "📋 Copy"; }, 2000);
}

function regenerateLastResponse() {
    if (isProcessing || activeMessages.length === 0) return;

    // If last message was from AI, pop it
    if (activeMessages[activeMessages.length - 1].role === "model") {
        activeMessages.pop();
    }

    // Re-render UI
    const container = document.getElementById("chatMessagesBox");
    if (container) {
        container.innerHTML = "";
        activeMessages.forEach(m => renderBubble(m.role === "user" ? "user" : "ai", m.text, m.time));
    }

    const lastUser = [...activeMessages].reverse().find(m => m.role === "user");
    if (lastUser) {
        sendMessage(lastUser.text);
    }
}

function askFollowUp() {
    const input = document.getElementById("tutorInput");
    if (input) {
        input.value = "Can you explain this further or provide another example?";
        input.focus();
    }
}

// Voice STT Integration
let voiceActive = false;
let recognition = null;

function toggleVoiceInput() {
    const btn = document.getElementById("voiceBtn");
    const input = document.getElementById("tutorInput");

    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        alert("Speech recognition is not supported in your browser.");
        return;
    }

    if (voiceActive && recognition) {
        recognition.stop();
        voiceActive = false;
        if (btn) {
            btn.classList.remove("listening");
            btn.textContent = "🎙️ Voice";
        }
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    const langSelect = document.getElementById("contextLanguage");
    const lang = langSelect ? langSelect.value : "English";
    recognition.lang = lang === "Hindi" ? "hi-IN" : "en-US";

    recognition.onstart = () => {
        voiceActive = true;
        if (btn) {
            btn.classList.add("listening");
            btn.textContent = "🛑 Listening...";
        }
    };

    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        if (input) input.value = transcript;
    };

    recognition.onend = () => {
        voiceActive = false;
        if (btn) {
            btn.classList.remove("listening");
            btn.textContent = "🎙️ Voice";
        }
    };

    recognition.start();
}

// Safe XSS-Free Markdown Renderer
function renderMarkdownSafe(rawText) {
    if (!rawText) return "";

    // Step 1: Escape HTML entities to prevent XSS
    let escaped = escapeHtml(rawText);

    // Step 2: Code blocks
    escaped = escaped.replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Step 3: Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Step 4: Headers
    escaped = escaped.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    escaped = escaped.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    escaped = escaped.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Step 5: Bold and Italic
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Step 6: Lists
    escaped = escaped.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
    escaped = escaped.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li>$2</li>');

    // Wrap consecutive <li> into <ul>
    escaped = escaped.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    escaped = escaped.replace(/<\/ul>\s*<ul>/g, ''); // merge adjacent lists

    // Step 7: Paragraph breaks
    escaped = escaped.replace(/\n\n/g, '<br><br>');
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.startNewChat = startNewChat;
window.loadChatThread = loadChatThread;
window.deleteChat = deleteChat;
window.clearCurrentConversation = clearCurrentConversation;
window.useSuggestion = useSuggestion;
window.triggerQuickAction = triggerQuickAction;
window.sendMessage = sendMessage;
window.copyText = copyText;
window.regenerateLastResponse = regenerateLastResponse;
window.askFollowUp = askFollowUp;
window.toggleVoiceInput = toggleVoiceInput;
window.updateContext = updateContext;

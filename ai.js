// =====================================
// SMART EDUCATION AI - AI ASSISTANT (TUTOR)
// =====================================

const API_URL = "";
let selectedTone = "encouraging";

function getCurrentUser() {
    try {
        const studentStr = localStorage.getItem("student");
        if (studentStr) return JSON.parse(studentStr);
        const userStr = localStorage.getItem("currentUser");
        if (userStr) return JSON.parse(userStr);
    } catch (e) {
        console.error("Error parsing stored user:", e);
    }
    return { id: "guest", name: "Student" };
}

function setTone(tone, btnElement) {
    selectedTone = tone;
    document.querySelectorAll(".tone-chip").forEach(c => c.classList.remove("active"));
    if (btnElement) btnElement.classList.add("active");
}

function usePrompt(prefix) {
    const input = document.getElementById("questionInput");
    if (input) {
        input.value = prefix + " ";
        input.focus();
    }
}

let voiceRecognitionActive = false;
let recognition = null;

function toggleVoiceInput() {
    const voiceBtn = document.getElementById("voiceAskBtn");
    const input = document.getElementById("questionInput");

    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        alert("Speech recognition is not supported in your browser.");
        return;
    }

    if (voiceRecognitionActive && recognition) {
        recognition.stop();
        voiceRecognitionActive = false;
        if (voiceBtn) {
            voiceBtn.classList.remove("listening");
            voiceBtn.textContent = "🎙️ Voice Ask";
        }
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    const langSelect = document.getElementById("languageSelect");
    const lang = langSelect ? langSelect.value : "English";
    recognition.lang = lang === "Hindi" ? "hi-IN" : "en-US";

    recognition.onstart = () => {
        voiceRecognitionActive = true;
        if (voiceBtn) {
            voiceBtn.classList.add("listening");
            voiceBtn.textContent = "🛑 Listening...";
        }
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (input) {
            input.value = transcript;
        }
    };

    recognition.onerror = (e) => {
        console.error("Speech recognition error:", e);
        voiceRecognitionActive = false;
        if (voiceBtn) {
            voiceBtn.classList.remove("listening");
            voiceBtn.textContent = "🎙️ Voice Ask";
        }
    };

    recognition.onend = () => {
        voiceRecognitionActive = false;
        if (voiceBtn) {
            voiceBtn.classList.remove("listening");
            voiceBtn.textContent = "🎙️ Voice Ask";
        }
    };

    recognition.start();
}

async function askAI() {
    const user = getCurrentUser();
    const input = document.getElementById("questionInput");
    const chatBox = document.getElementById("chatBox");
    const askButton = document.querySelector(".ask-btn");
    const langSelect = document.getElementById("languageSelect");
    const selectedLanguage = langSelect ? langSelect.value : "English";

    if (!input || !chatBox) return;

    const question = input.value.trim();
    if (!question) {
        alert("Please enter a question.");
        return;
    }

    // Append User Message
    appendMessage("👤 " + (user.name || "Student"), question, "user-message");
    input.value = "";

    // Set Loading state
    if (askButton) {
        askButton.disabled = true;
        askButton.innerText = "⏳ Thinking...";
    }

    const thinkingMsg = appendMessage("🤖 AI Study Tutor", "Thinking... 💭", "ai-message");

    try {
        // Fetch student's saved notes for context
        let notesText = "No saved notes available.";
        if (user && user.id && user.id !== "guest") {
            try {
                const notesRes = await fetch(`${API_URL}/api/notes/${user.id}`);
                if (notesRes.ok) {
                    const notes = await notesRes.json();
                    if (notes && notes.length > 0) {
                        notesText = notes.map(n => `Title: ${n.title}\nContent: ${n.content}`).join("\n\n");
                    }
                }
            } catch (e) {
                console.warn("Could not fetch notes context:", e);
            }
        }

        const prompt = `Selected Response Tone: ${selectedTone}\nSelected Response Language: ${selectedLanguage}\nStudent's Saved Notes Context:\n${notesText}\n\nStudent's Question:\n${question}`;

        const response = await fetch(`${API_URL}/api/ask`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: prompt })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || `AI Request failed (${response.status})`);
        }

        const answerText = data.answer || "No response received from Gemini.";
        updateMessageContent(thinkingMsg, answerText);

        // Offer speech read-aloud option if available
        if (window.voiceTutor && typeof window.voiceTutor.speak === "function") {
            // Optional read aloud
        }
    } catch (error) {
        console.error("AI Error:", error);
        updateMessageContent(thinkingMsg, `⚠️ ${error.message || "Unable to connect to AI server."}`);
    } finally {
        if (askButton) {
            askButton.disabled = false;
            askButton.innerText = "🚀 Ask AI";
        }
        input.focus();
    }
}

function appendMessage(sender, text, className) {
    const chatBox = document.getElementById("chatBox");
    if (!chatBox) return null;

    const msgDiv = document.createElement("div");
    msgDiv.className = className;
    msgDiv.style.cssText = "padding: 14px 18px; border-radius: 14px; margin-bottom: 14px; max-width: 85%; line-height: 1.6; white-space: pre-wrap; word-break: break-word; position: relative;";

    if (className === "user-message") {
        msgDiv.style.background = "linear-gradient(135deg, #4f46e5, #2563eb)";
        msgDiv.style.color = "#ffffff";
        msgDiv.style.marginLeft = "auto";
        msgDiv.style.boxShadow = "0 8px 20px -4px rgba(79, 70, 229, 0.4)";
    } else {
        msgDiv.style.background = "rgba(30, 41, 59, 0.7)";
        msgDiv.style.color = "#f1f5f9";
        msgDiv.style.marginRight = "auto";
        msgDiv.style.border = "1px solid rgba(255, 255, 255, 0.12)";
        msgDiv.style.backdropFilter = "blur(10px)";
    }

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "6px";

    const senderText = document.createElement("strong");
    senderText.style.fontSize = "13px";
    senderText.style.color = className === "user-message" ? "#e0e7ff" : "#60a5fa";
    senderText.innerText = sender;
    header.appendChild(senderText);

    if (className !== "user-message") {
        const actionBtnGroup = document.createElement("div");
        actionBtnGroup.style.display = "flex";
        actionBtnGroup.style.gap = "8px";

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "📋 Copy";
        copyBtn.style.cssText = "background: rgba(255,255,255,0.1); border: none; color: #94a3b8; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;";
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(body.innerText);
            copyBtn.textContent = "✅ Copied!";
            setTimeout(() => { copyBtn.textContent = "📋 Copy"; }, 2000);
        };
        actionBtnGroup.appendChild(copyBtn);

        const speakBtn = document.createElement("button");
        speakBtn.textContent = "🔊 Listen";
        speakBtn.style.cssText = "background: rgba(255,255,255,0.1); border: none; color: #94a3b8; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;";
        speakBtn.onclick = () => {
            if (window.voiceTutor) {
                window.voiceTutor.speak(body.innerText);
            } else {
                const utterance = new SpeechSynthesisUtterance(body.innerText);
                window.speechSynthesis.speak(utterance);
            }
        };
        actionBtnGroup.appendChild(speakBtn);

        header.appendChild(actionBtnGroup);
    }

    const body = document.createElement("div");
    body.className = "msg-body";
    body.innerText = text;

    msgDiv.appendChild(header);
    msgDiv.appendChild(body);
    chatBox.appendChild(msgDiv);

    chatBox.scrollTop = chatBox.scrollHeight;
    return body;
}

function updateMessageContent(element, text) {
    if (element) {
        element.innerText = text;
        const chatBox = document.getElementById("chatBox");
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function handleEnter(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        askAI();
    }
}

window.askAI = askAI;
window.usePrompt = usePrompt;
window.handleEnter = handleEnter;
window.setTone = setTone;
window.toggleVoiceInput = toggleVoiceInput;

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("questionInput");
    if (input) input.addEventListener("keydown", handleEnter);

    const askBtn = document.querySelector(".ask-btn");
    if (askBtn) askBtn.onclick = askAI;
});
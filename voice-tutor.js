// =====================================
// SMART EDUCATION AI - VOICE TUTOR ENGINE
// =====================================

let recognition = null;
let isListening = false;

function initVoiceTutor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        const lang = localStorage.getItem("languagePreference") || "English";
        if (lang === "Hindi") recognition.lang = "hi-IN";
        else recognition.lang = "en-US";

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById("questionInput");
            if (input) {
                input.value = transcript;
                askAI();
            }
            stopVoiceInput();
        };

        recognition.onerror = (e) => {
            console.warn("Speech recognition error:", e);
            stopVoiceInput();
        };

        recognition.onend = () => {
            stopVoiceInput();
        };
    }
}

function toggleVoiceInput() {
    if (!recognition) {
        alert("Voice recognition is not supported in this browser. Please use Google Chrome or Edge.");
        return;
    }

    const btn = document.getElementById("voiceInputBtn");

    if (!isListening) {
        try {
            recognition.start();
            isListening = true;
            if (btn) {
                btn.style.background = "#ef4444";
                btn.innerText = "🎙️ Listening... (Click to stop)";
            }
        } catch (e) {
            stopVoiceInput();
        }
    } else {
        stopVoiceInput();
    }
}

function stopVoiceInput() {
    if (recognition && isListening) {
        try { recognition.stop(); } catch (e) {}
    }
    isListening = false;
    const btn = document.getElementById("voiceInputBtn");
    if (btn) {
        btn.style.background = "";
        btn.innerText = "🎤 Voice Ask";
    }
}

function speakText(text) {
    if (!window.speechSynthesis) return;
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text.slice(0, 300));
        const lang = localStorage.getItem("languagePreference") || "English";
        if (lang === "Hindi") utterance.lang = "hi-IN";
        else utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn("Text-to-speech error:", e);
    }
}

window.toggleVoiceInput = toggleVoiceInput;
window.speakText = speakText;

document.addEventListener("DOMContentLoaded", initVoiceTutor);

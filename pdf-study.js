// =====================================
// SMART EDUCATION AI - PDF STUDY ASSISTANT CLIENT ENGINE
// =====================================

let currentStudent = null;
let currentPDF = null;
let currentStudyData = null;
let userSavedPDFs = [];

// Workspace Active State
let currentFlashcardIndex = 0;
let currentFlashcardsList = [];
let activeQuizQuestions = [];
let userQuizAnswers = {};

document.addEventListener("DOMContentLoaded", () => {
    initAuthAndUser();
    initDragAndDrop();
    loadUserPDFLibrary();
});

function initAuthAndUser() {
    const raw = localStorage.getItem("currentUser") || 
                localStorage.getItem("smart_edu_user") || 
                localStorage.getItem("student");
    if (!raw) {
        window.location.href = "login.html";
        return;
    }
    try {
        currentStudent = JSON.parse(raw);
        if (!currentStudent || (!currentStudent.id && !currentStudent.email)) {
            window.location.href = "login.html";
            return;
        }
        // Sync keys for seamless navigation
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("currentUser", JSON.stringify(currentStudent));
        localStorage.setItem("smart_edu_user", JSON.stringify(currentStudent));
        localStorage.setItem("student", JSON.stringify(currentStudent));
    } catch (e) {
        window.location.href = "login.html";
        return;
    }

    const nameEl = document.getElementById("navUserName");
    if (nameEl) nameEl.innerText = currentStudent.name || "Student";

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (typeof window.logout === 'function') {
                window.logout();
            } else {
                localStorage.removeItem("isLoggedIn");
                localStorage.removeItem("currentUser");
                localStorage.removeItem("smart_edu_user");
                localStorage.removeItem("student");
                window.location.href = "login.html";
            }
        });
    }
}

function initDragAndDrop() {
    const dropzone = document.getElementById("pdfDropzone");
    if (!dropzone) return;

    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("dragover");
        }, false);
    });

    dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            processFileObject(files[0]);
        }
    });
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFileObject(file);
    }
}

async function processFileObject(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
        alert("Invalid file type. Please select a valid PDF document (.pdf).");
        return;
    }

    if (file.size > 15 * 1024 * 1024) {
        alert("File size exceeds 15MB limit. Please select a smaller PDF.");
        return;
    }

    showProgressCard("Uploading PDF...", "Validating PDF file structure and magic bytes...", 25);

    const reader = new FileReader();
    reader.onload = async (e) => {
        const fileData = e.target.result;
        try {
            updateProgressCard("Parsing PDF Content...", "Extracting text pages and computing metadata...", 50);

            const uploadRes = await fetch("/api/pdf/upload", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": currentStudent.id
                },
                body: JSON.stringify({
                    userId: currentStudent.id,
                    filename: file.name,
                    fileData: fileData
                })
            });

            const uploadData = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) throw new Error(uploadData.error || "Failed to upload PDF.");

            const pdfMeta = uploadData.pdf;
            updateProgressCard("Generating AI Workspace...", "Analyzing document content with Gemini 2.5 Flash...", 80);

            const processRes = await fetch("/api/pdf/process", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": currentStudent.id
                },
                body: JSON.stringify({
                    userId: currentStudent.id,
                    pdfId: pdfMeta.id
                })
            });

            const processData = await processRes.json().catch(() => ({}));
            if (!processRes.ok) throw new Error(processData.error || "Failed to generate AI study materials.");

            hideProgressCard();
            loadPDFIntoWorkspace({ ...pdfMeta, studyData: processData.studyData });
            loadUserPDFLibrary();
        } catch (err) {
            console.error("PDF Upload Pipeline Error:", err);
            showProgressError(err.message || "An error occurred while parsing the PDF.");
        }
    };

    reader.readAsDataURL(file);
}

function showProgressCard(title, message, progressPct) {
    const card = document.getElementById("uploadStatusCard");
    const icon = document.getElementById("statusIcon");
    const titleEl = document.getElementById("statusTitle");
    const msgEl = document.getElementById("statusMessage");
    const bar = document.getElementById("statusProgressBar");

    if (card) card.style.display = "block";
    if (icon) icon.innerText = "⏳";
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (bar) bar.style.width = `${progressPct}%`;
}

function updateProgressCard(title, message, progressPct) {
    showProgressCard(title, message, progressPct);
}

function showProgressError(errorMessage) {
    const card = document.getElementById("uploadStatusCard");
    const icon = document.getElementById("statusIcon");
    const titleEl = document.getElementById("statusTitle");
    const msgEl = document.getElementById("statusMessage");
    const bar = document.getElementById("statusProgressBar");

    if (card) card.style.display = "block";
    if (icon) icon.innerText = "❌";
    if (titleEl) titleEl.innerText = "Upload Failed";
    if (msgEl) msgEl.innerText = errorMessage;
    if (bar) {
        bar.style.width = "100%";
        bar.style.background = "#ef4444";
    }
}

function hideProgressCard() {
    const card = document.getElementById("uploadStatusCard");
    if (card) card.style.display = "none";
}

// =====================================
// WORKSPACE RENDER & TAB MANAGEMENT
// =====================================

function loadPDFIntoWorkspace(pdfObj) {
    currentPDF = pdfObj;
    currentStudyData = pdfObj.studyData || {};

    const workspace = document.getElementById("studyWorkspace");
    if (workspace) workspace.style.display = "block";

    // Update Header Metadata
    const badge = document.getElementById("docSubjectBadge");
    const title = document.getElementById("docTitle");
    const pages = document.getElementById("docPages");
    const readingTime = document.getElementById("docReadingTime");
    const lastStudied = document.getElementById("docLastStudied");

    if (badge) badge.innerText = pdfObj.subject || "General Study";
    if (title) title.innerText = pdfObj.title || pdfObj.filename;
    if (pages) pages.innerText = pdfObj.pageCount || 1;
    if (readingTime) readingTime.innerText = pdfObj.estReadingMinutes || 5;
    if (lastStudied) lastStudied.innerText = new Date(pdfObj.lastStudiedAt || Date.now()).toLocaleDateString();

    // Render 8 Workspace Panels
    renderSummaryTab();
    renderTopicsTab();
    renderNotesTab();
    renderExamTab();
    renderQuizTab();
    renderFlashcardsTab();
    renderAskTab();
    renderExplainTab();

    // Scroll workspace into view
    workspace.scrollIntoView({ behavior: "smooth" });
}

function closeWorkspace() {
    const workspace = document.getElementById("studyWorkspace");
    if (workspace) workspace.style.display = "none";
    currentPDF = null;
    currentStudyData = null;
}

function switchTab(tabId) {
    document.querySelectorAll(".pdf-tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".pdf-tab-panel").forEach(panel => panel.classList.remove("active"));

    const activePanel = document.getElementById(tabId);
    if (activePanel) activePanel.classList.add("active");

    const activeBtn = Array.from(document.querySelectorAll(".pdf-tab-btn")).find(b => b.getAttribute("onclick")?.includes(tabId));
    if (activeBtn) activeBtn.classList.add("active");
}

// 1. AI Summary Tab
function renderSummaryTab() {
    const summaryBox = document.getElementById("summaryContent");
    if (!summaryBox || !currentStudyData.summary) return;

    const s = currentStudyData.summary;
    let html = `<strong>Short Summary:</strong>\n${s.short || ""}\n\n<strong>Detailed Overview:</strong>\n${s.detailed || ""}`;
    if (Array.isArray(s.mainIdeas) && s.mainIdeas.length > 0) {
        html += `\n\n<strong>Key Takeaways:</strong>\n${s.mainIdeas.map(m => `• ${m}`).join("\n")}`;
    }
    summaryBox.innerHTML = escapeHtml(html);
}

async function updateSummaryLength(len) {
    document.querySelectorAll(".summary-len-btn").forEach(b => b.classList.remove("active"));
    const activeBtn = Array.from(document.querySelectorAll(".summary-len-btn")).find(b => b.innerText === len);
    if (activeBtn) activeBtn.classList.add("active");

    const summaryBox = document.getElementById("summaryContent");
    const lang = document.getElementById("summaryLangSelect")?.value || "English";
    if (summaryBox) summaryBox.innerText = `Generating ${len} summary in ${lang}... ⏳`;

    try {
        const res = await fetch("/api/pdf/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": currentStudent.id },
            body: JSON.stringify({ userId: currentStudent.id, pdfId: currentPDF.id, length: len, language: lang })
        });
        const data = await res.json();
        if (summaryBox) summaryBox.innerText = data.summary || "Summary generated.";
    } catch (e) {
        if (summaryBox) summaryBox.innerText = "Failed to update summary.";
    }
}

async function updateSummaryLanguage(lang) {
    const activeLenBtn = document.querySelector(".summary-len-btn.active");
    const len = activeLenBtn ? activeLenBtn.innerText : "Detailed";
    updateSummaryLength(len);
}

// 2. Important Topics Tab
function renderTopicsTab() {
    const grid = document.getElementById("topicsGrid");
    if (!grid) return;

    const topics = currentStudyData.topics || [];
    if (topics.length === 0) {
        grid.innerHTML = `<p style="color: #94a3b8;">No topics extracted yet.</p>`;
        return;
    }

    grid.innerHTML = topics.map(t => {
        const impClass = t.importance === "High" ? "imp-high" : (t.importance === "Medium" ? "imp-medium" : "imp-low");
        return `
            <div class="glass-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="color: #f8fafc; margin: 0; font-size: 16px;">${escapeHtml(t.name)}</h4>
                        <span class="imp-badge ${impClass}">${t.importance || "Medium"}</span>
                    </div>
                    <p style="color: #cbd5e1; font-size: 13px; line-height: 1.6; margin: 0 0 15px 0;">${escapeHtml(t.explanation)}</p>
                </div>
                <button class="btn btn-secondary" onclick="explainTopicFromCard('${escapeHtml(t.name)}')" style="padding: 6px 12px; font-size: 12px; align-self: flex-start;">🧠 Explain This Topic</button>
            </div>
        `;
    }).join("");
}

function explainTopicFromCard(topicName) {
    switchTab("explainTab");
    const input = document.getElementById("explainTopicInput");
    if (input) input.value = topicName;
    requestExplainSimply();
}

// 3. AI Notes Tab
function renderNotesTab() {
    const container = document.getElementById("notesMarkdownContainer");
    if (!container || !currentStudyData.notes) return;
    container.innerText = currentStudyData.notes;
}

function toggleEditNotes() {
    const editContainer = document.getElementById("notesEditContainer");
    const textarea = document.getElementById("notesEditTextarea");
    const container = document.getElementById("notesMarkdownContainer");
    if (!editContainer || !container || !textarea) return;

    if (editContainer.style.display === "none" || !editContainer.style.display) {
        textarea.value = currentStudyData.notes || container.innerText;
        editContainer.style.display = "block";
        container.style.display = "none";
    } else {
        editContainer.style.display = "none";
        container.style.display = "block";
    }
}

function saveNotesEdit() {
    const textarea = document.getElementById("notesEditTextarea");
    const container = document.getElementById("notesMarkdownContainer");
    if (!textarea || !container) return;

    currentStudyData.notes = textarea.value.trim();
    container.innerText = currentStudyData.notes;
    toggleEditNotes();
    alert("✅ Notes edit saved!");
}

async function regenerateNotes() {
    const container = document.getElementById("notesMarkdownContainer");
    const lang = document.getElementById("summaryLangSelect")?.value || "English";
    if (container) container.innerText = `Regenerating study notes in ${lang}... ⏳`;

    try {
        const res = await fetch("/api/pdf/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": currentStudent.id },
            body: JSON.stringify({ userId: currentStudent.id, pdfId: currentPDF.id, language: lang })
        });
        const data = await res.json();
        if (data.notes) {
            currentStudyData.notes = data.notes;
            if (container) container.innerText = data.notes;
        } else {
            alert("Failed to regenerate notes.");
        }
    } catch (e) {
        alert("Error regenerating notes.");
    }
}

async function saveNotesToLibrary() {
    if (!currentPDF || !currentStudyData.notes) return;
    try {
        const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": currentStudent.id },
            body: JSON.stringify({
                studentId: currentStudent.id,
                title: `Notes: ${currentPDF.title}`,
                subject: currentPDF.subject,
                topic: currentPDF.title,
                content: currentStudyData.notes
            })
        });
        const data = await res.json();
        if (res.ok) alert("✅ Notes saved successfully to your Notes Library!");
        else alert(`Error: ${data.error || "Failed to save notes."}`);
    } catch (e) {
        alert("Failed to save notes.");
    }
}

function copyNotesContent() {
    const container = document.getElementById("notesMarkdownContainer");
    if (!container) return;
    navigator.clipboard.writeText(container.innerText);
    alert("📋 Notes copied to clipboard!");
}

function printNotesContent() {
    const container = document.getElementById("notesMarkdownContainer");
    if (!container) return;
    const printWin = window.open("", "_blank");
    printWin.document.write(`<html><head><title>${currentPDF.title} - Notes</title></head><body style="font-family: sans-serif; padding: 30px; line-height: 1.6;"><pre>${escapeHtml(container.innerText)}</pre></body></html>`);
    printWin.document.close();
    printWin.print();
}

// 4. Exam Focus Tab
function renderExamTab() {
    const ep = currentStudyData.examPoints || {};
    const conceptsList = document.getElementById("examKeyConceptsList");
    const defsList = document.getElementById("examDefinitionsList");
    const questionsList = document.getElementById("examQuestionsList");

    if (conceptsList) {
        const items = Array.isArray(ep.keyConcepts) ? ep.keyConcepts : [];
        conceptsList.innerHTML = items.map(i => `<li>${escapeHtml(i)}</li>`).join("") || "<li>Key exam concepts compiled from PDF.</li>";
    }
    if (defsList) {
        const items = Array.isArray(ep.definitions) ? ep.definitions : [];
        defsList.innerHTML = items.map(i => `<li>${escapeHtml(i)}</li>`).join("") || "<li>Key definitions identified.</li>";
    }
    if (questionsList) {
        const items = Array.isArray(ep.potentialQuestions) ? ep.potentialQuestions : [];
        questionsList.innerHTML = items.map((q, idx) => `<p style="margin-bottom: 8px;"><strong>Q${idx+1}:</strong> ${escapeHtml(q)}</p>`).join("") || "<p>Potential exam questions generated.</p>";
    }
}

// 5. MCQ Quiz Tab
function renderQuizTab() {
    activeQuizQuestions = currentStudyData.quiz || [];
    renderActivePDFQuiz();
}

function renderActivePDFQuiz() {
    const area = document.getElementById("pdfQuizQuestionsArea");
    const submitBtn = document.getElementById("submitPdfQuizBtn");
    const resultsCard = document.getElementById("pdfQuizResultsCard");

    if (resultsCard) resultsCard.style.display = "none";
    userQuizAnswers = {};

    if (!area || activeQuizQuestions.length === 0) {
        if (area) area.innerHTML = `<p style="color: #94a3b8; text-align: center;">Click [Generate New Quiz] to build a custom MCQ test from this PDF.</p>`;
        if (submitBtn) submitBtn.style.display = "none";
        return;
    }

    area.innerHTML = activeQuizQuestions.map((q, idx) => `
        <div class="glass-card" style="padding: 22px; margin-bottom: 18px;" id="pdfQCard_${idx}">
            <h4 style="color: #f8fafc; margin-top: 0; margin-bottom: 14px; font-size: 16px;">${idx + 1}. ${escapeHtml(q.question)}</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
                ${q.options.map((opt, optIdx) => `
                    <button class="btn btn-secondary pdf-opt-btn" onclick="selectPDFQuizOption(${idx}, ${optIdx})" id="pdfOptBtn_${idx}_${optIdx}" style="text-align: left; justify-content: flex-start;">
                        <strong>${String.fromCharCode(65 + optIdx)}.</strong> ${escapeHtml(opt)}
                    </button>
                `).join("")}
            </div>
            <div id="pdfExplainBox_${idx}" style="display: none; margin-top: 15px; padding: 12px 16px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; color: #cbd5e1; font-size: 13.5px; line-height: 1.6;"></div>
        </div>
    `).join("");

    if (submitBtn) submitBtn.style.display = "inline-block";
}

function selectPDFQuizOption(qIdx, optIdx) {
    userQuizAnswers[qIdx] = optIdx;
    const q = activeQuizQuestions[qIdx];
    q.options.forEach((_, i) => {
        const btn = document.getElementById(`pdfOptBtn_${qIdx}_${i}`);
        if (btn) {
            if (i === optIdx) {
                btn.style.background = "rgba(99,102,241,0.3)";
                btn.style.borderColor = "#818cf8";
            } else {
                btn.style.background = "rgba(255,255,255,0.04)";
                btn.style.borderColor = "rgba(255,255,255,0.08)";
            }
        }
    });
}

async function generatePDFQuiz() {
    const count = document.getElementById("pdfQuizCount")?.value || 5;
    const diff = document.getElementById("pdfQuizDiff")?.value || "Medium";
    const lang = document.getElementById("pdfQuizLang")?.value || "English";
    const area = document.getElementById("pdfQuizQuestionsArea");

    if (area) area.innerHTML = `<p style="color: #818cf8; text-align: center;">Generating ${count} ${diff} quiz questions in ${lang}... ⏳</p>`;

    try {
        const res = await fetch("/api/pdf/quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": currentStudent.id },
            body: JSON.stringify({ userId: currentStudent.id, pdfId: currentPDF.id, numQuestions: count, difficulty: diff, language: lang })
        });
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
            activeQuizQuestions = data.questions;
            renderActivePDFQuiz();
        } else {
            if (area) area.innerHTML = `<p style="color: #ef4444; text-align: center;">Failed to generate quiz.</p>`;
        }
    } catch (e) {
        if (area) area.innerHTML = `<p style="color: #ef4444; text-align: center;">Quiz generation error.</p>`;
    }
}

function submitPDFQuiz() {
    if (activeQuizQuestions.length === 0) return;

    let correctCount = 0;
    activeQuizQuestions.forEach((q, idx) => {
        const userSel = userQuizAnswers[idx];
        const explainBox = document.getElementById(`pdfExplainBox_${idx}`);

        q.options.forEach((_, optIdx) => {
            const btn = document.getElementById(`pdfOptBtn_${idx}_${optIdx}`);
            if (!btn) return;
            btn.disabled = true;

            if (optIdx === q.answer) {
                btn.style.background = "rgba(16,185,129,0.3)";
                btn.style.borderColor = "#34d399";
                btn.style.color = "#ffffff";
            } else if (optIdx === userSel && userSel !== q.answer) {
                btn.style.background = "rgba(239,68,68,0.3)";
                btn.style.borderColor = "#f87171";
            }
        });

        if (userSel === q.answer) correctCount++;

        if (explainBox) {
            explainBox.style.display = "block";
            explainBox.innerHTML = `💡 <strong>Explanation:</strong> ${escapeHtml(q.explanation)}`;
        }
    });

    const scorePct = Math.round((correctCount / activeQuizQuestions.length) * 100);
    const scoreText = document.getElementById("pdfQuizScoreText");
    const resultsCard = document.getElementById("pdfQuizResultsCard");
    const submitBtn = document.getElementById("submitPdfQuizBtn");

    if (scoreText) scoreText.innerText = `Score: ${correctCount} / ${activeQuizQuestions.length} (${scorePct}%)`;
    if (resultsCard) resultsCard.style.display = "block";
    if (submitBtn) submitBtn.style.display = "none";

    // Save Quiz Record
    saveQuizResultToBackend(correctCount, activeQuizQuestions.length, scorePct);
}

async function saveQuizResultToBackend(correct, total, pct) {
    try {
        await fetch("/api/quizzes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": currentStudent.id },
            body: JSON.stringify({
                studentId: currentStudent.id,
                subject: currentPDF.subject,
                topic: `PDF: ${currentPDF.title}`,
                difficulty: "Medium",
                numQuestions: total,
                score: correct,
                percentage: pct,
                correctCount: correct,
                incorrectCount: total - correct,
                mode: "PDF Quiz"
            })
        });
    } catch (e) {}
}

// 6. Flashcards Tab
let flashcardStatusMap = {};

function renderFlashcardsTab() {
    currentFlashcardsList = currentStudyData.flashcards || [];
    currentFlashcardIndex = 0;
    updateFlashcardDisplay();
}

function updateFlashcardDisplay() {
    const counter = document.getElementById("flashcardCounter");
    const front = document.getElementById("flashcardFrontText");
    const back = document.getElementById("flashcardBackText");
    const wrapper = document.getElementById("flashcardWidget");
    const statusBadge = document.getElementById("flashcardStatusBadge");

    if (wrapper) wrapper.classList.remove("flipped");

    if (currentFlashcardsList.length === 0) {
        if (counter) counter.innerText = "No Flashcards";
        if (front) front.innerText = "No flashcards generated for this PDF.";
        if (back) back.innerText = "";
        if (statusBadge) statusBadge.style.display = "none";
        return;
    }

    const card = currentFlashcardsList[currentFlashcardIndex];
    if (counter) counter.innerText = `Card ${currentFlashcardIndex + 1} of ${currentFlashcardsList.length}`;
    if (front) front.innerText = card.front || "Question";
    if (back) back.innerText = card.back || "Answer";

    if (statusBadge) {
        const cardKey = card.id || currentFlashcardIndex;
        const status = flashcardStatusMap[cardKey];
        if (status === "known") {
            statusBadge.style.display = "inline-block";
            statusBadge.style.background = "rgba(16,185,129,0.2)";
            statusBadge.style.color = "#34d399";
            statusBadge.style.border = "1px solid rgba(16,185,129,0.4)";
            statusBadge.innerText = "Known ✅";
        } else if (status === "review") {
            statusBadge.style.display = "inline-block";
            statusBadge.style.background = "rgba(245,158,11,0.2)";
            statusBadge.style.color = "#fbbf24";
            statusBadge.style.border = "1px solid rgba(245,158,11,0.4)";
            statusBadge.innerText = "Needs Review ⭐";
        } else {
            statusBadge.style.display = "none";
        }
    }
}

function markFlashcardKnown() {
    if (currentFlashcardsList.length === 0) return;
    const card = currentFlashcardsList[currentFlashcardIndex];
    flashcardStatusMap[card.id || currentFlashcardIndex] = "known";
    updateFlashcardDisplay();
    nextFlashcard();
}

function markFlashcardReview() {
    if (currentFlashcardsList.length === 0) return;
    const card = currentFlashcardsList[currentFlashcardIndex];
    flashcardStatusMap[card.id || currentFlashcardIndex] = "review";
    updateFlashcardDisplay();
    nextFlashcard();
}

function flipFlashcard() {
    const wrapper = document.getElementById("flashcardWidget");
    if (wrapper) wrapper.classList.toggle("flipped");
}

function nextFlashcard() {
    if (currentFlashcardsList.length === 0) return;
    currentFlashcardIndex = (currentFlashcardIndex + 1) % currentFlashcardsList.length;
    updateFlashcardDisplay();
}

function prevFlashcard() {
    if (currentFlashcardsList.length === 0) return;
    currentFlashcardIndex = (currentFlashcardIndex - 1 + currentFlashcardsList.length) % currentFlashcardsList.length;
    updateFlashcardDisplay();
}

function shuffleFlashcards() {
    if (currentFlashcardsList.length < 2) return;
    for (let i = currentFlashcardsList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentFlashcardsList[i], currentFlashcardsList[j]] = [currentFlashcardsList[j], currentFlashcardsList[i]];
    }
    currentFlashcardIndex = 0;
    updateFlashcardDisplay();
}

// 7. Grounded Ask PDF Tab
function renderAskTab() {
    // Initial welcome message ready
}

function askQuickPrompt(promptText) {
    const input = document.getElementById("askPdfInput");
    if (input) {
        input.value = promptText;
        sendAskPDFQuestion();
    }
}

async function sendAskPDFQuestion() {
    const input = document.getElementById("askPdfInput");
    const container = document.getElementById("askChatMessages");
    if (!input || !input.value.trim() || !container) return;

    const questionText = input.value.trim();
    input.value = "";

    // Append User Message
    container.innerHTML += `
        <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; padding: 12px 16px; border-radius: 14px; align-self: flex-end; max-width: 80%; font-size: 14px;">
            👤 ${escapeHtml(questionText)}
        </div>
    `;

    // Append Thinking Indicator
    const thinkingId = `think_${Date.now()}`;
    container.innerHTML += `
        <div id="${thinkingId}" style="background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #cbd5e1; padding: 12px 16px; border-radius: 14px; align-self: flex-start; max-width: 85%; font-size: 14px;">
            🤖 Searching PDF document... ⏳
        </div>
    `;
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch("/api/pdf/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": currentStudent.id },
            body: JSON.stringify({ userId: currentStudent.id, pdfId: currentPDF.id, question: questionText })
        });
        const data = await res.json();
        const thinkEl = document.getElementById(thinkingId);

        if (thinkEl) {
            thinkEl.innerHTML = `
                🤖 <strong>Grounded Answer:</strong><br>${escapeHtml(data.answer)}
                <div style="margin-top: 8px; font-size: 12px; color: #818cf8; font-weight: 600;">📍 ${escapeHtml(data.citation || "")}</div>
            `;
        }
    } catch (e) {
        const thinkEl = document.getElementById(thinkingId);
        if (thinkEl) thinkEl.innerHTML = `🤖 Error querying document.`;
    }
    container.scrollTop = container.scrollHeight;
}

// 8. Explain Simply Tab
function renderExplainTab() {
    // Ready for user selection
}

async function requestExplainSimply() {
    const input = document.getElementById("explainTopicInput");
    const lang = document.getElementById("explainLangSelect")?.value || "English";
    const outputCard = document.getElementById("explainOutputCard");

    const topic = input && input.value.trim() ? input.value.trim() : (currentPDF ? currentPDF.title : "Document Core Concept");

    if (outputCard) outputCard.innerText = `Simplifying "${topic}" in ${lang}... ⏳`;

    try {
        const res = await fetch("/api/pdf/explain-simply", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": currentStudent.id },
            body: JSON.stringify({ userId: currentStudent.id, pdfId: currentPDF.id, topic: topic, language: lang })
        });
        const data = await res.json();
        if (outputCard) outputCard.innerText = data.explanation || "Explanation completed.";
    } catch (e) {
        if (outputCard) outputCard.innerText = "Error generating simple explanation.";
    }
}

// 9. In-Document PDF Text Search Tab
function executePDFSearch() {
    const input = document.getElementById("pdfSearchInput");
    const summary = document.getElementById("pdfSearchResultsSummary");
    const list = document.getElementById("pdfSearchResultsList");
    if (!input || !list) return;

    const query = input.value.trim();
    if (!query) {
        list.innerHTML = `<p style="color: #94a3b8; text-align: center;">Please enter a search query.</p>`;
        if (summary) summary.innerText = "";
        return;
    }

    const docText = (currentPDF && currentPDF.extractedText) ? currentPDF.extractedText : (JSON.stringify(currentStudyData || {}));
    if (!docText || docText.length < 5) {
        list.innerHTML = `<p style="color: #ef4444; text-align: center;">No searchable text content available in this PDF.</p>`;
        if (summary) summary.innerText = "0 matches found.";
        return;
    }

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
    const matches = [];
    let match;

    while ((match = regex.exec(docText)) !== null && matches.length < 25) {
        const start = Math.max(0, match.index - 80);
        const end = Math.min(docText.length, match.index + match[0].length + 80);
        const snippet = docText.slice(start, end).replace(/\n/g, " ");

        const totalLen = docText.length;
        const totalPages = (currentPDF && currentPDF.pageCount) ? currentPDF.pageCount : 1;
        const estPage = Math.max(1, Math.min(totalPages, Math.ceil((match.index / totalLen) * totalPages)));

        matches.push({
            snippet: snippet,
            query: query,
            page: estPage
        });
    }

    if (summary) summary.innerText = `Found ${matches.length} matching snippet(s) for "${query}"`;

    if (matches.length === 0) {
        list.innerHTML = `<p style="color: #94a3b8; text-align: center;">No occurrences of "${escapeHtml(query)}" found in document text.</p>`;
        return;
    }

    list.innerHTML = matches.map((m, idx) => {
        const safeQuery = escapeHtml(m.query);
        const highlightedSnippet = escapeHtml(m.snippet).replace(
            new RegExp(safeQuery, "gi"),
            `<mark style="background: #fbbf24; color: #000; padding: 2px 4px; border-radius: 4px;">$&</mark>`
        );

        return `
            <div class="glass-card" style="padding: 16px; border-left: 3px solid #818cf8;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #818cf8; font-size: 13px; font-weight: 700;">Result #${idx + 1} (Approx Page ${m.page})</span>
                    <button class="btn btn-secondary" onclick="askQuickPrompt('Explain section regarding: ${safeQuery}')" style="padding: 4px 10px; font-size: 11px;">💬 Ask AI About This</button>
                </div>
                <p style="color: #cbd5e1; font-size: 13.5px; line-height: 1.6; margin: 0;">...${highlightedSnippet}...</p>
            </div>
        `;
    }).join("");
}

// =====================================
// SAVED PDF LIBRARY MANAGEMENT
// =====================================

async function loadUserPDFLibrary() {
    if (!currentStudent) return;
    try {
        const res = await fetch(`/api/pdf/list/${currentStudent.id}`, {
            headers: { "x-user-id": currentStudent.id }
        });
        const pdfs = await res.json();
        if (Array.isArray(pdfs)) {
            userSavedPDFs = pdfs;
            renderPDFLibraryGrid(userSavedPDFs);
        }
    } catch (e) {
        console.error("Failed to load user PDF library:", e);
    }
}

function renderPDFLibraryGrid(pdfs) {
    const grid = document.getElementById("savedPdfGrid");
    if (!grid) return;

    if (pdfs.length === 0) {
        grid.innerHTML = `
            <div class="glass-card" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
                <div style="font-size: 36px; margin-bottom: 10px;">📄</div>
                <h4 style="color: #f8fafc; margin-bottom: 6px;">No Saved Study PDFs Yet</h4>
                <p style="color: #94a3b8; font-size: 14px; max-width: 400px; margin: 0 auto 15px;">Upload your first PDF above to turn your study material into interactive notes, quizzes, and flashcards.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = pdfs.map(p => `
        <div class="glass-card" style="padding: 22px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span class="badge-tag badge-cs">${escapeHtml(p.subject || "General")}</span>
                    <span style="font-size: 12px; color: #94a3b8;">${p.pageCount || 1} Pages</span>
                </div>
                <h4 style="color: #60a5fa; margin: 0 0 8px 0; font-size: 17px; word-break: break-word;">${escapeHtml(p.title || p.filename)}</h4>
                <p style="color: #94a3b8; font-size: 12.5px; margin: 0 0 15px 0;">
                    Uploaded: ${new Date(p.createdAt).toLocaleDateString()}<br>
                    Est. Read: ${p.estReadingMinutes || 5} mins
                </p>
            </div>
            <div style="display: flex; gap: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 15px;">
                <button class="btn btn-primary" onclick="openSavedPDF('${p.id}')" style="flex: 1; padding: 8px; font-size: 13px;">📖 Open Workspace</button>
                <button class="btn btn-secondary" onclick="deletePDFRecord('${p.id}')" style="padding: 8px 12px; font-size: 13px; border-color: rgba(239,68,68,0.4); color: #f87171;" title="Delete PDF">🗑️</button>
            </div>
        </div>
    `).join("");
}

function filterSavedPDFs() {
    const search = document.getElementById("searchPdfInput")?.value.toLowerCase().trim() || "";
    const sort = document.getElementById("sortPdfSelect")?.value || "recent";

    let filtered = userSavedPDFs.filter(p => {
        return (p.title && p.title.toLowerCase().includes(search)) ||
               (p.filename && p.filename.toLowerCase().includes(search)) ||
               (p.subject && p.subject.toLowerCase().includes(search));
    });

    if (sort === "recent") {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === "oldest") {
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sort === "subject") {
        filtered.sort((a, b) => (a.subject || "").localeCompare(b.subject || ""));
    }

    renderPDFLibraryGrid(filtered);
}

async function openSavedPDF(pdfId) {
    try {
        const res = await fetch(`/api/pdf/${currentStudent.id}/${pdfId}`, {
            headers: { "x-user-id": currentStudent.id }
        });
        const pdf = await res.json();
        if (res.ok) {
            loadPDFIntoWorkspace(pdf);
        } else {
            alert(`Error loading PDF: ${pdf.error || "Access denied."}`);
        }
    } catch (e) {
        alert("Failed to load PDF workspace.");
    }
}

async function deletePDFRecord(pdfId) {
    if (!confirm("Are you sure you want to delete this PDF and all associated AI study materials?")) return;

    try {
        const res = await fetch(`/api/pdf/${currentStudent.id}/${pdfId}`, {
            method: "DELETE",
            headers: { "x-user-id": currentStudent.id }
        });
        const data = await res.json();
        if (res.ok) {
            if (currentPDF && String(currentPDF.id) === String(pdfId)) {
                closeWorkspace();
            }
            loadUserPDFLibrary();
        } else {
            alert(`Delete failed: ${data.error || "Unauthorized."}`);
        }
    } catch (e) {
        alert("Error deleting PDF.");
    }
}

function deleteCurrentPDF() {
    if (currentPDF) deletePDFRecord(currentPDF.id);
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

// Global functions for inline HTML event handlers
window.handleFileSelect = handleFileSelect;
window.switchTab = switchTab;
window.updateSummaryLength = updateSummaryLength;
window.updateSummaryLanguage = updateSummaryLanguage;
window.explainTopicFromCard = explainTopicFromCard;
window.saveNotesToLibrary = saveNotesToLibrary;
window.toggleEditNotes = toggleEditNotes;
window.saveNotesEdit = saveNotesEdit;
window.regenerateNotes = regenerateNotes;
window.copyNotesContent = copyNotesContent;
window.printNotesContent = printNotesContent;
window.generatePDFQuiz = generatePDFQuiz;
window.submitPDFQuiz = submitPDFQuiz;
window.selectPDFQuizOption = selectPDFQuizOption;
window.flipFlashcard = flipFlashcard;
window.nextFlashcard = nextFlashcard;
window.prevFlashcard = prevFlashcard;
window.shuffleFlashcards = shuffleFlashcards;
window.markFlashcardKnown = markFlashcardKnown;
window.markFlashcardReview = markFlashcardReview;
window.askQuickPrompt = askQuickPrompt;
window.sendAskPDFQuestion = sendAskPDFQuestion;
window.requestExplainSimply = requestExplainSimply;
window.executePDFSearch = executePDFSearch;
window.filterSavedPDFs = filterSavedPDFs;
window.openSavedPDF = openSavedPDF;
window.deletePDFRecord = deletePDFRecord;
window.deleteCurrentPDF = deleteCurrentPDF;
window.closeWorkspace = closeWorkspace;

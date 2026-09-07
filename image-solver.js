// =====================================
// SMART EDUCATION AI - VISUAL QUESTION SOLVER ENGINE
// =====================================

let currentStudent = null;
let selectedBase64Image = "";
let currentSolutionRecord = null;
let userHistoryList = [];
let activeQuestionIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
    initAuthAndUser();
    initDragDropAndPaste();
    loadUserHistory();
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

function initDragDropAndPaste() {
    const dropzone = document.getElementById("imageDropzone");
    if (dropzone) {
        ["dragenter", "dragover"].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add("dragover");
            });
        });

        ["dragleave", "drop"].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove("dragover");
            });
        });

        dropzone.addEventListener("drop", (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                processImageFile(files[0]);
            }
        });
    }

    // Clipboard Paste Listener
    window.addEventListener("paste", (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) processImageFile(file);
                break;
            }
        }
    });
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processImageFile(file);
}

function processImageFile(file) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
        alert("Invalid file type. Please select a .jpg, .png, or .webp image.");
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert("Image size exceeds 10MB limit. Please upload a smaller image.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        selectedBase64Image = e.target.result;
        displayImagePreviewCard(selectedBase64Image, file.name);
    };
    reader.readAsDataURL(file);
}

function displayImagePreviewCard(base64Data, filename) {
    const previewCard = document.getElementById("imagePreviewCard");
    const previewImg = document.getElementById("imagePreviewImg");

    if (previewImg) previewImg.src = base64Data;
    if (previewCard) {
        previewCard.style.display = "block";
        previewCard.scrollIntoView({ behavior: "smooth" });
    }
}

function removeSelectedImage() {
    selectedBase64Image = "";
    const previewCard = document.getElementById("imagePreviewCard");
    const previewImg = document.getElementById("imagePreviewImg");
    const fileInput = document.getElementById("fileInput");
    const cameraInput = document.getElementById("cameraInput");

    if (previewImg) previewImg.src = "";
    if (previewCard) previewCard.style.display = "none";
    if (fileInput) fileInput.value = "";
    if (cameraInput) cameraInput.value = "";
}

function openZoomModal() {
    if (!selectedBase64Image) return;
    const modal = document.getElementById("zoomModal");
    const img = document.getElementById("zoomModalImg");
    if (img) img.src = selectedBase64Image;
    if (modal) modal.style.display = "flex";
}

function closeZoomModal() {
    const modal = document.getElementById("zoomModal");
    if (modal) modal.style.display = "none";
}

// =====================================
// AI VISION QUESTION SOLVER PIPELINE
// =====================================

async function solveQuestion() {
    const questionText = document.getElementById("questionTextInput")?.value.trim() || "";
    const language = document.getElementById("languageSelect")?.value || "English";
    const subjectOverride = document.getElementById("subjectSelect")?.value || "Mathematics";
    const mode = document.getElementById("modeSelect")?.value || "Step-by-Step";

    if (!selectedBase64Image && !questionText) {
        alert("Please select an image or enter a question statement to solve.");
        return;
    }

    showProgressCard("Analyzing Image...", "Extracting parameters and running vision AI solver...", 35);
    const solveBtn = document.getElementById("solveQuestionBtn");
    if (solveBtn) solveBtn.disabled = true;

    try {
        updateProgressCard(`Processing (${mode})...`, "Computing formulas, analogies, and exam points...", 70);

        const res = await fetch("/api/image-solver/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": currentStudent.id
            },
            body: JSON.stringify({
                userId: currentStudent.id,
                imageBase64: selectedBase64Image,
                questionText: questionText,
                language: language,
                subjectOverride: subjectOverride,
                mode: mode
            })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to analyze question image.");

        hideProgressCard();
        if (solveBtn) solveBtn.disabled = false;

        currentSolutionRecord = data.solutionRecord;
        renderSolutionWorkspace(data.solutionRecord);

        // Auto switch tab if specific non-default mode selected
        if (mode === "Explain Simply") switchModeTab("simpleTab");
        else if (mode === "Exam Answer") switchModeTab("examTab");

        loadUserHistory();
    } catch (err) {
        console.error("Solver Error:", err);
        showProgressError(err.message || "Question analysis error.");
        if (solveBtn) solveBtn.disabled = false;
    }
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
    if (titleEl) titleEl.innerText = "Analysis Failed";
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
// WORKSPACE RENDER & MODES
// =====================================

function renderSolutionWorkspace(record) {
    const workspace = document.getElementById("solutionWorkspace");
    if (workspace) workspace.style.display = "block";

    const solData = record.solutionData || {};

    // Header Metadata
    const badge = document.getElementById("solutionSubjectBadge");
    const diffBadge = document.getElementById("solutionDifficultyBadge");
    const typeBadge = document.getElementById("solutionTypeBadge");
    const title = document.getElementById("solutionTitle");

    if (badge) badge.innerText = record.subject || solData.detectedSubject || "Mathematics";
    if (diffBadge) diffBadge.innerText = solData.difficulty || "Medium";
    if (typeBadge) typeBadge.innerText = solData.questionType || "Numerical";
    if (title) title.innerText = record.title || "Visual Question Solution";

    // Multi-Question Selector
    const multiBox = document.getElementById("multiQuestionSelector");
    const qPills = document.getElementById("questionPillsContainer");
    const detectedQs = Array.isArray(solData.detectedQuestions) ? solData.detectedQuestions : [];

    if (multiBox && qPills) {
        if (detectedQs.length > 1) {
            multiBox.style.display = "block";
            qPills.innerHTML = detectedQs.map((q, idx) => `
                <span class="q-num-pill ${idx === 0 ? 'active' : ''}" onclick="selectMultiQuestion(${idx})">
                    Question ${idx + 1}: ${escapeHtml(q.preview || `Q${idx+1}`)}
                </span>
            `).join("");
        } else {
            multiBox.style.display = "none";
        }
    }

    // Blurry / Unreadable Warning
    const blurryWarn = document.getElementById("blurryWarningCard");
    if (blurryWarn) {
        blurryWarn.style.display = solData.isBlurryOrUnreadable ? "block" : "none";
    }

    // Render 4 Solution Panels
    renderStepByStepPanel(solData.solutionModes?.stepByStep || {});
    renderSimpleExplanationPanel(solData.solutionModes?.simpleExplanation || {});
    renderExamAnswerPanel(solData.solutionModes?.examAnswer || "");
    renderConceptPanel(solData.solutionModes?.conceptExplanation || {});

    // Code / Diagram Analysis
    renderSpecialAnalysisCard(solData);

    // Practice Similar Questions
    renderSimilarQuestions(solData.similarQuestions || []);

    // Reset Chat
    const chatContainer = document.getElementById("followupChatMessages");
    if (chatContainer) {
        chatContainer.innerHTML = `
            <div style="background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #cbd5e1; padding: 12px 16px; border-radius: 14px; font-size: 13.5px; line-height: 1.6;">
                🤖 <strong>Question Assistant:</strong> Ask any follow-up question about this solution.
            </div>
        `;
    }

    workspace.scrollIntoView({ behavior: "smooth" });
}

function closeSolutionWorkspace() {
    const workspace = document.getElementById("solutionWorkspace");
    if (workspace) workspace.style.display = "none";
    currentSolutionRecord = null;
}

function switchModeTab(tabId) {
    document.querySelectorAll(".mode-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".mode-tab-panel").forEach(p => p.classList.remove("active"));

    const activePanel = document.getElementById(tabId);
    if (activePanel) activePanel.classList.add("active");

    const activeBtn = Array.from(document.querySelectorAll(".mode-tab-btn")).find(b => b.getAttribute("onclick")?.includes(tabId));
    if (activeBtn) activeBtn.classList.add("active");
}

function selectMultiQuestion(idx) {
    activeQuestionIndex = idx;
    document.querySelectorAll(".q-num-pill").forEach((pill, i) => {
        if (i === idx) pill.classList.add("active");
        else pill.classList.remove("active");
    });
}

// 1. Step-by-Step Panel
function renderStepByStepPanel(sbs) {
    const given = document.getElementById("givenText");
    const required = document.getElementById("requiredText");
    const formula = document.getElementById("formulaText");
    const stepsContainer = document.getElementById("stepsListContainer");
    const finalAnswer = document.getElementById("finalAnswerBox");

    if (given) given.innerText = sbs.given || "Parameters extracted from image analysis.";
    if (required) required.innerText = sbs.required || "Target problem solution.";
    if (formula) formula.innerText = sbs.formula || "Applicable theorem formula.";

    if (stepsContainer) {
        const steps = Array.isArray(sbs.steps) ? sbs.steps : [sbs.steps || "Step-by-step calculations."];
        stepsContainer.innerHTML = steps.map((stepStr, idx) => `
            <div style="margin-bottom: 12px; padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 10px; border-left: 3px solid #818cf8;">
                ${escapeHtml(stepStr)}
            </div>
        `).join("");
    }

    if (finalAnswer) finalAnswer.innerText = sbs.finalAnswer || "Verified solution result.";
}

// 2. Simple Explanation Panel
function renderSimpleExplanationPanel(simpleObj) {
    const breakdown = document.getElementById("simpleBreakdownText");
    const analogy = document.getElementById("simpleAnalogyText");
    const takeaway = document.getElementById("simpleTakeawayText");

    if (breakdown) breakdown.innerText = simpleObj.simpleText || "Simple beginner explanation.";
    if (analogy) analogy.innerText = simpleObj.analogy || "Real-world analogy.";
    if (takeaway) takeaway.innerText = simpleObj.keyTakeaway || "Core takeaway point.";
}

// 3. Exam Answer Panel
function renderExamAnswerPanel(examStr) {
    const container = document.getElementById("examAnswerContainer");
    if (!container) return;
    container.innerText = typeof examStr === "string" ? examStr : JSON.stringify(examStr, null, 2);
}

function copyExamAnswer() {
    const container = document.getElementById("examAnswerContainer");
    if (!container) return;
    navigator.clipboard.writeText(container.innerText);
    alert("📋 Exam answer copied to clipboard!");
}

// 4. Concept Panel
function renderConceptPanel(conceptObj) {
    const name = document.getElementById("conceptNameText");
    const breakdown = document.getElementById("conceptBreakdownText");

    if (name) name.innerText = conceptObj.conceptName || "Theoretical Principle";
    if (breakdown) breakdown.innerText = conceptObj.breakdown || "Explanation of underlying model.";
}

// Special Code / Diagram Analysis Card
function renderSpecialAnalysisCard(solData) {
    const card = document.getElementById("specialAnalysisCard");
    const title = document.getElementById("specialAnalysisTitle");
    const content = document.getElementById("specialAnalysisContent");

    if (!card || !content) return;

    if (solData.codeAnalysis && solData.codeAnalysis.language) {
        card.style.display = "block";
        if (title) title.innerText = `💻 Code Inspection (${solData.codeAnalysis.language})`;
        content.innerText = `Explanation:\n${solData.codeAnalysis.explanation}\n\nIdentified Bugs:\n${(solData.codeAnalysis.bugs || []).join("\n")}\n\nCorrected Code:\n${solData.codeAnalysis.correctedCode}`;
    } else if (solData.diagramAnalysis && solData.diagramAnalysis.figureDescription) {
        card.style.display = "block";
        if (title) title.innerText = "📐 Diagram & Figure Inspection";
        content.innerText = `Figure Description:\n${solData.diagramAnalysis.figureDescription}\n\nKey Elements:\n${(solData.diagramAnalysis.keyElements || []).join("\n")}`;
    } else {
        card.style.display = "none";
    }
}

// Practice Similar Questions
function renderSimilarQuestions(questions) {
    const container = document.getElementById("similarQuestionsContainer");
    if (!container) return;

    if (questions.length === 0) {
        container.innerHTML = `<p style="color: #94a3b8;">No practice questions generated.</p>`;
        return;
    }

    container.innerHTML = questions.map((q, idx) => `
        <div class="glass-card" style="padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #f8fafc; font-weight: 700; font-size: 14.5px;">Question ${idx + 1}</span>
                <span class="imp-badge ${q.difficulty === 'Easy' ? 'imp-low' : (q.difficulty === 'Hard' ? 'imp-high' : 'imp-medium')}">${q.difficulty || 'Medium'}</span>
            </div>
            <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 12px 0; line-height: 1.6;">${escapeHtml(q.question)}</p>
            <button class="btn btn-secondary" onclick="togglePracticeSolution('pracSol_${idx}')" style="padding: 5px 12px; font-size: 12px;">👁️ Show Solution</button>
            <div id="pracSol_${idx}" style="display: none; margin-top: 12px; padding: 12px 15px; background: rgba(99,102,241,0.12); border-radius: 10px; color: #cbd5e1; font-size: 13.5px; line-height: 1.6;">
                💡 <strong>Solution:</strong> ${escapeHtml(q.solution)}
            </div>
        </div>
    `).join("");
}

function togglePracticeSolution(elemId) {
    const el = document.getElementById(elemId);
    if (el) {
        el.style.display = el.style.display === "none" ? "block" : "none";
    }
}

// Grounded Follow-Up AI Chat
async function sendFollowupQuestion() {
    const input = document.getElementById("followupInput");
    const container = document.getElementById("followupChatMessages");

    if (!input || !input.value.trim() || !container || !currentSolutionRecord) return;

    const questionText = input.value.trim();
    input.value = "";

    // User Message
    container.innerHTML += `
        <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; padding: 10px 14px; border-radius: 12px; align-self: flex-end; max-width: 80%; font-size: 13.5px;">
            👤 ${escapeHtml(questionText)}
        </div>
    `;

    // Thinking Message
    const thinkId = `think_${Date.now()}`;
    container.innerHTML += `
        <div id="${thinkId}" style="background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #cbd5e1; padding: 10px 14px; border-radius: 12px; align-self: flex-start; max-width: 85%; font-size: 13.5px;">
            🤖 Thinking... ⏳
        </div>
    `;
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch("/api/image-solver/followup", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": currentStudent.id },
            body: JSON.stringify({ userId: currentStudent.id, solutionId: currentSolutionRecord.id, question: questionText })
        });
        const data = await res.json();
        const thinkEl = document.getElementById(thinkId);
        if (thinkEl) {
            thinkEl.innerHTML = `🤖 <strong>Assistant:</strong><br>${escapeHtml(data.answer)}`;
        }
    } catch (e) {
        const thinkEl = document.getElementById(thinkId);
        if (thinkEl) thinkEl.innerHTML = `🤖 Error generating follow-up answer.`;
    }
    container.scrollTop = container.scrollHeight;
}

// =====================================
// SAVED QUESTION HISTORY MANAGEMENT
// =====================================

async function loadUserHistory() {
    if (!currentStudent) return;
    try {
        const res = await fetch(`/api/image-solver/history/${currentStudent.id}`, {
            headers: { "x-user-id": currentStudent.id }
        });
        const history = await res.json();
        if (Array.isArray(history)) {
            userHistoryList = history;
            renderHistoryGrid(userHistoryList);
        }
    } catch (e) {
        console.error("Failed to load history:", e);
    }
}

function renderHistoryGrid(list) {
    const grid = document.getElementById("historyGrid");
    if (!grid) return;

    if (list.length === 0) {
        grid.innerHTML = `
            <div class="glass-card" style="grid-column: 1 / -1; padding: 35px; text-align: center;">
                <div style="font-size: 34px; margin-bottom: 8px;">🖼️</div>
                <h4 style="color: #f8fafc; margin-bottom: 4px;">No Solved Questions Yet</h4>
                <p style="color: #94a3b8; font-size: 13.5px; max-width: 400px; margin: 0 auto;">Upload your first math, physics, or code question above to view step-by-step AI solutions.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = list.map(item => `
        <div class="glass-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span class="badge-tag badge-cs">${escapeHtml(item.subject || "General")}</span>
                    <span style="font-size: 11.5px; color: #94a3b8;">${new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <h4 style="color: #60a5fa; margin: 0 0 6px 0; font-size: 16px; word-break: break-word;">${escapeHtml(item.title)}</h4>
                <p style="color: #94a3b8; font-size: 12.5px; margin: 0 0 14px 0;">Language: ${item.language || "English"}</p>
            </div>
            <div style="display: flex; gap: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
                <button class="btn btn-primary" onclick="openHistorySolution('${item.id}')" style="flex: 1; padding: 7px; font-size: 12.5px;">📖 View Solution</button>
                <button class="btn btn-secondary" onclick="deleteHistorySolution('${item.id}')" style="padding: 7px 10px; font-size: 12.5px; border-color: rgba(239,68,68,0.4); color: #f87171;" title="Delete Solution">🗑️</button>
            </div>
        </div>
    `).join("");
}

function filterHistoryGrid() {
    const search = document.getElementById("searchHistoryInput")?.value.toLowerCase().trim() || "";
    const sort = document.getElementById("sortHistorySelect")?.value || "recent";

    let filtered = userHistoryList.filter(item => {
        return (item.title && item.title.toLowerCase().includes(search)) ||
               (item.subject && item.subject.toLowerCase().includes(search));
    });

    if (sort === "recent") {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === "oldest") {
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sort === "subject") {
        filtered.sort((a, b) => (a.subject || "").localeCompare(b.subject || ""));
    }

    renderHistoryGrid(filtered);
}

async function openHistorySolution(solutionId) {
    try {
        const res = await fetch(`/api/image-solver/${currentStudent.id}/${solutionId}`, {
            headers: { "x-user-id": currentStudent.id }
        });
        const record = await res.json();
        if (res.ok) {
            currentSolutionRecord = record;
            renderSolutionWorkspace(record);
        } else {
            alert(`Error loading solution: ${record.error || "Access denied."}`);
        }
    } catch (e) {
        alert("Failed to load solution.");
    }
}

async function deleteHistorySolution(solutionId) {
    if (!confirm("Are you sure you want to delete this saved solution?")) return;

    try {
        const res = await fetch(`/api/image-solver/${currentStudent.id}/${solutionId}`, {
            method: "DELETE",
            headers: { "x-user-id": currentStudent.id }
        });
        const data = await res.json();
        if (res.ok) {
            if (currentSolutionRecord && String(currentSolutionRecord.id) === String(solutionId)) {
                closeSolutionWorkspace();
            }
            loadUserHistory();
        } else {
            alert(`Delete failed: ${data.error || "Unauthorized."}`);
        }
    } catch (e) {
        alert("Error deleting solution.");
    }
}

function deleteCurrentSolution() {
    if (currentSolutionRecord) deleteHistorySolution(currentSolutionRecord.id);
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

async function saveSolutionToNotes() {
    if (!currentSolutionRecord) return;
    const solData = currentSolutionRecord.solutionData || {};
    const sbs = solData.solutionModes?.stepByStep || {};
    
    const noteContent = `# Visual Question Solution: ${currentSolutionRecord.title}

## Subject: ${currentSolutionRecord.subject}

### Given Parameters
${sbs.given || '-'}

### Required Target
${sbs.required || '-'}

### Formula / Theorem Used
${sbs.formula || '-'}

### Step-by-Step Calculation
${Array.isArray(sbs.steps) ? sbs.steps.map(s => `- ${s}`).join('\n') : (sbs.steps || '-')}

### Final Answer
**${sbs.finalAnswer || '-'}**

---
*Derived automatically using Smart Education AI Visual Question Solver.*`;

    try {
        const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": currentStudent.id },
            body: JSON.stringify({
                studentId: currentStudent.id,
                title: `Solution: ${currentSolutionRecord.title}`,
                subject: currentSolutionRecord.subject,
                topic: currentSolutionRecord.topic || currentSolutionRecord.title,
                content: noteContent
            })
        });
        const data = await res.json();
        if (res.ok) alert("✅ Solution saved successfully to your Notes Library!");
        else alert(`Error: ${data.error || "Failed to save solution to notes."}`);
    } catch (e) {
        alert("Failed to save solution to notes.");
    }
}

function printSolutionContent() {
    if (!currentSolutionRecord) return;
    const workspace = document.getElementById("solutionWorkspace");
    if (!workspace) return;
    const printWin = window.open("", "_blank");
    printWin.document.write(`<html><head><title>${currentSolutionRecord.title} - Solution</title></head><body style="font-family: sans-serif; padding: 30px; line-height: 1.6;"><h2>${escapeHtml(currentSolutionRecord.title)}</h2><div>${workspace.innerHTML}</div></body></html>`);
    printWin.document.close();
    printWin.print();
}

function askFollowupQuick(promptText) {
    const input = document.getElementById("followupInput");
    if (input) {
        input.value = promptText;
        sendFollowupQuestion();
    }
}

// Global Exports for Inline HTML Handlers
window.handleFileSelect = handleFileSelect;
window.removeSelectedImage = removeSelectedImage;
window.openZoomModal = openZoomModal;
window.closeZoomModal = closeZoomModal;
window.solveQuestion = solveQuestion;
window.closeSolutionWorkspace = closeSolutionWorkspace;
window.switchModeTab = switchModeTab;
window.selectMultiQuestion = selectMultiQuestion;
window.copyExamAnswer = copyExamAnswer;
window.togglePracticeSolution = togglePracticeSolution;
window.sendFollowupQuestion = sendFollowupQuestion;
window.askFollowupQuick = askFollowupQuick;
window.saveSolutionToNotes = saveSolutionToNotes;
window.printSolutionContent = printSolutionContent;
window.filterHistoryGrid = filterHistoryGrid;
window.openHistorySolution = openHistorySolution;
window.deleteHistorySolution = deleteHistorySolution;
window.deleteCurrentSolution = deleteCurrentSolution;

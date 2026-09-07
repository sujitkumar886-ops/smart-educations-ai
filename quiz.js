// ==========================================================================
// SMART EDUCATION AI - SMART QUIZ ENGINE & ANALYTICS
// ==========================================================================

const API_URL = "";

let activeQuiz = null; // { questions, userAnswers, currentIdx, timerInterval, timeRemaining, totalTime, startTime, mode, subject, topic, difficulty, numQuestions }
let quizHistory = [];

function getCurrentUser() {
    try {
        const studentStr = localStorage.getItem("student");
        if (studentStr) return JSON.parse(studentStr);
        const userStr = localStorage.getItem("currentUser");
        if (userStr) return JSON.parse(userStr);
    } catch (e) {
        console.error("Error parsing user:", e);
    }
    return null;
}

function escapeHTML(str) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// --------------------------------------------------------------------------
// 1. AI QUIZ GENERATION & SETUP
// --------------------------------------------------------------------------

async function generateAIQuiz(event) {
    if (event) event.preventDefault();

    const user = getCurrentUser();
    if (!user || !user.id) {
        alert("Please log in first to generate an AI Quiz.");
        window.location.href = "login.html";
        return;
    }

    const subject = document.getElementById("quizSubject")?.value || "General";
    const topic = (document.getElementById("quizTopic")?.value || "").trim();
    const difficulty = document.getElementById("quizDifficulty")?.value || "Medium";
    const numQuestions = parseInt(document.getElementById("quizNumQuestions")?.value) || 10;
    const language = document.getElementById("quizLanguage")?.value || "English";
    const mode = document.getElementById("quizMode")?.value || "Practice";

    if (!topic) {
        alert("Please enter a study topic.");
        return;
    }

    const genBtn = document.getElementById("aiGenerateBtn");
    if (genBtn) {
        genBtn.disabled = true;
        genBtn.innerHTML = `⏳ AI is generating questions...`;
    }

    try {
        const response = await fetch("/api/ai/generate-quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject, topic, difficulty, numQuestions, language })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to generate AI quiz.");
        }

        const questions = Array.isArray(data.questions) ? data.questions : [];
        if (questions.length === 0) {
            throw new Error("No valid questions returned from AI. Please try again.");
        }

        // Time allocation: 30s per question in Exam mode, 45s in Practice/Revision mode
        const secPerQuestion = mode === "Exam" ? 30 : 45;
        const totalTimerSeconds = questions.length * secPerQuestion;

        activeQuiz = {
            questions: questions,
            userAnswers: new Array(questions.length).fill(-1),
            currentIdx: 0,
            timerInterval: null,
            timeRemaining: totalTimerSeconds,
            totalTime: totalTimerSeconds,
            startTime: Date.now(),
            mode: mode,
            subject: data.subject || subject,
            topic: data.topic || topic,
            difficulty: data.difficulty || difficulty,
            numQuestions: questions.length
        };

        // UI View Swap
        document.getElementById("quizSetupArea").style.display = "none";
        document.getElementById("resultArea").style.display = "none";
        document.getElementById("quizArea").style.display = "block";

        renderQuestion();
        startQuizTimer();
    } catch (error) {
        console.error("AI Quiz Gen Error:", error);
        alert(error.message || "Could not generate AI Quiz.");
    } finally {
        if (genBtn) {
            genBtn.disabled = false;
            genBtn.innerHTML = `✨ Generate AI Quiz`;
        }
    }
}

// --------------------------------------------------------------------------
// 2. QUIZ EXECUTION ENGINE & TIMER
// --------------------------------------------------------------------------

function startQuizTimer() {
    if (!activeQuiz) return;
    if (activeQuiz.timerInterval) clearInterval(activeQuiz.timerInterval);

    const timerDisplay = document.getElementById("timerDisplay");

    activeQuiz.timerInterval = setInterval(() => {
        if (!activeQuiz) return;

        activeQuiz.timeRemaining--;

        if (timerDisplay) {
            timerDisplay.textContent = `⏱️ ${formatTime(activeQuiz.timeRemaining)}`;
            if (activeQuiz.timeRemaining <= 15) {
                timerDisplay.classList.add("warning");
            } else {
                timerDisplay.classList.remove("warning");
            }
        }

        if (activeQuiz.timeRemaining <= 0) {
            clearInterval(activeQuiz.timerInterval);
            alert("⏰ Time is up! Submitting your quiz now.");
            submitQuiz(true);
        }
    }, 1000);
}

function renderQuestion() {
    if (!activeQuiz) return;

    const qIdx = activeQuiz.currentIdx;
    const q = activeQuiz.questions[qIdx];
    const total = activeQuiz.questions.length;
    const pct = Math.round(((qIdx + 1) / total) * 100);

    const qNumEl = document.getElementById("questionNumber");
    const modeBadge = document.getElementById("quizModeBadge");
    const diffBadge = document.getElementById("difficultyBadge");
    const barEl = document.getElementById("quizProgressBar");
    const qTextEl = document.getElementById("questionText");
    const optionsContainer = document.getElementById("optionsContainer");

    if (qNumEl) qNumEl.innerText = `Question ${qIdx + 1} of ${total}`;
    if (modeBadge) modeBadge.innerText = `${activeQuiz.mode} Mode`;
    if (diffBadge) diffBadge.innerText = activeQuiz.difficulty;
    if (barEl) barEl.style.width = `${pct}%`;
    if (qTextEl) qTextEl.innerText = q.question;

    if (optionsContainer) {
        optionsContainer.innerHTML = "";
        q.options.forEach((optText, optIdx) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "option-btn";
            if (activeQuiz.userAnswers[qIdx] === optIdx) {
                btn.classList.add("selected");
            }

            const prefixLetter = String.fromCharCode(65 + optIdx);
            btn.innerHTML = `<strong style="color: var(--accent-indigo); min-width: 24px;">${prefixLetter}.</strong> ${escapeHTML(optText)}`;
            btn.onclick = () => selectOption(optIdx);
            optionsContainer.appendChild(btn);
        });
    }

    // Navigation Button States
    const prevBtn = document.getElementById("prevQuestionBtn");
    const nextBtn = document.getElementById("nextQuestionBtn");
    const submitBtn = document.getElementById("submitQuizBtn");

    if (prevBtn) prevBtn.disabled = qIdx === 0;
    if (nextBtn) nextBtn.style.display = qIdx === total - 1 ? "none" : "inline-flex";
    if (submitBtn) submitBtn.style.display = qIdx === total - 1 ? "inline-flex" : "none";
}

function selectOption(optionIndex) {
    if (!activeQuiz) return;
    activeQuiz.userAnswers[activeQuiz.currentIdx] = optionIndex;
    renderQuestion();
}

function navigateQuestion(direction) {
    if (!activeQuiz) return;
    const newIdx = activeQuiz.currentIdx + direction;
    if (newIdx >= 0 && newIdx < activeQuiz.questions.length) {
        activeQuiz.currentIdx = newIdx;
        renderQuestion();
    }
}

function confirmSubmitQuiz() {
    if (!activeQuiz) return;

    const unansweredCount = activeQuiz.userAnswers.filter(a => a === -1).length;
    if (unansweredCount > 0) {
        if (!confirm(`You have ${unansweredCount} unanswered question(s). Are you sure you want to submit?`)) {
            return;
        }
    }
    submitQuiz(false);
}

// --------------------------------------------------------------------------
// 3. QUIZ SUBMISSION, RESULTS & ANSWER REVIEW
// --------------------------------------------------------------------------

async function submitQuiz(isAutoTimeout = false) {
    if (!activeQuiz) return;
    if (activeQuiz.timerInterval) clearInterval(activeQuiz.timerInterval);

    const user = getCurrentUser();
    const timeTakenSeconds = Math.max(1, Math.round((Date.now() - activeQuiz.startTime) / 1000));

    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    const questionBreakdown = activeQuiz.questions.map((q, idx) => {
        const userChoice = activeQuiz.userAnswers[idx];
        const isCorrect = userChoice === q.answer;
        const isSkipped = userChoice === -1;

        if (isCorrect) correctCount++;
        else if (isSkipped) skippedCount++;
        else incorrectCount++;

        return {
            questionId: q.id,
            questionText: q.question,
            options: q.options,
            userAnswerIndex: userChoice,
            correctAnswerIndex: q.answer,
            isCorrect: isCorrect,
            isSkipped: isSkipped,
            explanation: q.explanation
        };
    });

    const totalQuestions = activeQuiz.questions.length;
    const score = correctCount;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    const xpEarned = correctCount * 20;

    // Save Quiz Record to Backend
    if (user && user.id) {
        try {
            await fetch("/api/quizzes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: user.id,
                    subject: activeQuiz.subject,
                    topic: activeQuiz.topic,
                    difficulty: activeQuiz.difficulty,
                    numQuestions: totalQuestions,
                    score: score,
                    percentage: percentage,
                    correctCount: correctCount,
                    incorrectCount: incorrectCount,
                    skippedCount: skippedCount,
                    timeTaken: timeTakenSeconds,
                    mode: activeQuiz.mode,
                    completedAt: new Date().toISOString(),
                    questionBreakdown: questionBreakdown
                })
            });

            // Post XP
            const actionType = percentage === 100 ? "perfect_quiz" : "quiz";
            await fetch("/api/user/add-xp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id, amount: xpEarned, action: actionType })
            });

            // Save last score locally for dashboard stat sync
            localStorage.setItem(`lastQuizScore_${user.id}`, JSON.stringify({
                score, total: totalQuestions, percentage, date: new Date().toISOString()
            }));
        } catch (e) {
            console.error("Failed to save quiz result:", e);
        }
    }

    // Render Results View
    document.getElementById("quizArea").style.display = "none";
    document.getElementById("resultArea").style.display = "block";

    const emojiEl = document.getElementById("resultEmoji");
    const msgEl = document.getElementById("feedbackMessage");
    const scoreEl = document.getElementById("scoreDisplay");
    const pctEl = document.getElementById("percentageDisplay");
    const breakdownEl = document.getElementById("breakdownDisplay");
    const timeEl = document.getElementById("timeTakenDisplay");
    const xpEl = document.getElementById("xpAwardedDisplay");
    const recoEl = document.getElementById("recommendationText");

    if (scoreEl) scoreEl.innerText = `${score} / ${totalQuestions}`;
    if (pctEl) pctEl.innerText = `${percentage}%`;
    if (breakdownEl) breakdownEl.innerText = `${correctCount} ✓ / ${incorrectCount} ✗`;
    if (timeEl) timeEl.innerText = formatTime(timeTakenSeconds);
    if (xpEl) xpEl.innerText = `+${xpEarned} XP`;

    if (percentage >= 80) {
        if (emojiEl) emojiEl.innerText = "🏆";
        if (msgEl) msgEl.innerText = "🌟 Outstanding Performance! You have mastered this topic.";
        if (recoEl) recoEl.innerText = `Great work on ${activeQuiz.topic}! Challenge yourself with an Advanced quiz or explore related study notes in AI Notes.`;
    } else if (percentage >= 60) {
        if (emojiEl) emojiEl.innerText = "👍";
        if (msgEl) msgEl.innerText = "👍 Good Effort! Review incorrect answers below to polish your score.";
        if (recoEl) recoEl.innerText = `You have a solid foundation in ${activeQuiz.topic}. Read the AI explanations below and retry for a 100% score!`;
    } else {
        if (emojiEl) emojiEl.innerText = "📚";
        if (msgEl) msgEl.innerText = "📚 Needs Practice! Detailed revision recommended before retrying.";
        if (recoEl) recoEl.innerText = `We detected difficulty in ${activeQuiz.topic}. We recommend generating a Detailed Note in AI Notes Workspace before attempting another test.`;
    }

    // Render Detailed Answer Review
    renderAnswerReview(questionBreakdown);

    // Refresh history & weak topic analytics
    await loadHistory();
    await loadWeakTopics();
}

function renderAnswerReview(breakdown) {
    const container = document.getElementById("answerReviewContainer");
    if (!container) return;

    container.innerHTML = "";

    breakdown.forEach((item, idx) => {
        const card = document.createElement("div");

        let statusClass = "review-card status-correct";
        let statusBadge = `<span style="background: rgba(34,197,94,0.2); color: #86efac; border: 1px solid rgba(34,197,94,0.4); padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 700;">Correct ✓</span>`;

        if (item.isSkipped) {
            statusClass = "review-card status-skipped";
            statusBadge = `<span style="background: rgba(245,158,11,0.2); color: #fde047; border: 1px solid rgba(245,158,11,0.4); padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 700;">Skipped ⏱️</span>`;
        } else if (!item.isCorrect) {
            statusClass = "review-card status-incorrect";
            statusBadge = `<span style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 700;">Incorrect ✗</span>`;
        }

        const userAnsText = item.isSkipped ? "None (Skipped)" : `${String.fromCharCode(65 + item.userAnswerIndex)}. ${item.options[item.userAnswerIndex]}`;
        const correctAnsText = `${String.fromCharCode(65 + item.correctAnswerIndex)}. ${item.options[item.correctAnswerIndex]}`;

        card.className = statusClass;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                <span style="font-weight: 700; color: var(--accent-indigo); font-size: 14px;">Q${idx + 1}</span>
                ${statusBadge}
            </div>
            <h4 style="color: #ffffff; font-size: 16px; margin-bottom: 14px; font-weight: 600;">${escapeHTML(item.questionText)}</h4>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 14px; margin-bottom: 12px;">
                <div><span style="color: var(--text-sub);">Your Answer:</span> <strong style="color: ${item.isCorrect ? '#86efac' : '#fca5a5'};">${escapeHTML(userAnsText)}</strong></div>
                ${!item.isCorrect ? `<div><span style="color: var(--text-sub);">Correct Answer:</span> <strong style="color: #86efac;">${escapeHTML(correctAnsText)}</strong></div>` : ''}
            </div>
            <div class="explanation-box">
                <strong style="color: var(--accent-blue); display: block; margin-bottom: 4px;">💡 AI Explanation & Exam Tip:</strong>
                ${escapeHTML(item.explanation)}
            </div>
        `;

        container.appendChild(card);
    });
}

function retryCurrentQuiz() {
    if (!activeQuiz) return;
    activeQuiz.userAnswers = new Array(activeQuiz.questions.length).fill(-1);
    activeQuiz.currentIdx = 0;
    activeQuiz.timeRemaining = activeQuiz.totalTime;
    activeQuiz.startTime = Date.now();

    document.getElementById("resultArea").style.display = "none";
    document.getElementById("quizArea").style.display = "block";

    renderQuestion();
    startQuizTimer();
}

function resetQuizSetup() {
    if (activeQuiz && activeQuiz.timerInterval) clearInterval(activeQuiz.timerInterval);
    activeQuiz = null;

    document.getElementById("quizSetupArea").style.display = "block";
    document.getElementById("quizArea").style.display = "none";
    document.getElementById("resultArea").style.display = "none";
}

// --------------------------------------------------------------------------
// 4. QUIZ HISTORY, FILTERS & WEAK TOPIC ANALYTICS
// --------------------------------------------------------------------------

async function loadHistory() {
    const user = getCurrentUser();
    if (!user || !user.id) return;

    try {
        const response = await fetch(`${API_URL}/api/quizzes/${user.id}`);
        const data = await response.json().catch(() => ([]));

        if (!response.ok) {
            console.error("Load Quiz History Error:", data.error);
            quizHistory = [];
        } else {
            quizHistory = Array.isArray(data) ? data : [];
        }

        filterHistory();
    } catch (error) {
        console.error("Load Quiz History Exception:", error);
        quizHistory = [];
        filterHistory();
    }
}

function filterHistory() {
    const searchVal = (document.getElementById("historySearchInput")?.value || "").toLowerCase().trim();
    const subjectVal = document.getElementById("historySubjectFilter")?.value || "ALL";
    const diffVal = document.getElementById("historyDifficultyFilter")?.value || "ALL";
    const sortVal = document.getElementById("historySortSelect")?.value || "NEWEST";

    let filtered = quizHistory.filter(q => {
        const topicMatch = (q.topic || "").toLowerCase().includes(searchVal);
        const subjectMatch = (q.subject || "").toLowerCase().includes(searchVal);

        const matchesSearch = !searchVal || topicMatch || subjectMatch;
        const matchesSubject = subjectVal === "ALL" || (q.subject || "General") === subjectVal;
        const matchesDiff = diffVal === "ALL" || (q.difficulty || "Medium") === diffVal;

        return matchesSearch && matchesSubject && matchesDiff;
    });

    // Sorting
    filtered.sort((a, b) => {
        if (sortVal === "HIGHEST") return (b.percentage || 0) - (a.percentage || 0);
        if (sortVal === "LOWEST") return (a.percentage || 0) - (b.percentage || 0);
        return new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime();
    });

    displayHistory(filtered);
}

function displayHistory(list) {
    const container = document.getElementById("historyContainer");
    const countEl = document.getElementById("quizHistoryCount");

    if (countEl) {
        countEl.innerText = `${list.length} Past Quiz${list.length === 1 ? "" : "zes"}`;
    }

    if (!container) return;
    container.innerHTML = "";

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card" style="grid-column: 1 / -1; padding: 36px; text-align: center; background: rgba(15,23,42,0.6); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
                <h4 style="font-size: 17px; color: #ffffff; margin-bottom: 6px;">No Quiz History Found</h4>
                <p style="color: #94a3b8; font-size: 14px; max-width: 440px; margin: 0 auto;">No completed quizzes match your current search or filter criteria. Configure a new AI quiz session above to start tracking performance!</p>
            </div>
        `;
        return;
    }

    list.forEach(item => {
        const card = document.createElement("div");
        card.className = "glass-card";
        card.style.cssText = "padding: 20px; display: flex; flex-direction: column; justify-content: space-between;";

        const pct = item.percentage || 0;
        let pctColor = "#86efac";
        if (pct < 60) pctColor = "#fca5a5";
        else if (pct < 80) pctColor = "#fde047";

        const formattedDate = item.date || (item.completedAt ? new Date(item.completedAt).toLocaleDateString() : "Saved");

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <span class="badge-tag badge-cs">${escapeHTML(item.subject || "General")}</span>
                    <span style="font-size: 20px; font-weight: 800; color: ${pctColor};">${pct}%</span>
                </div>
                <h3 style="margin: 0 0 6px 0; color: #ffffff; font-size: 16px; font-weight: 700;">${escapeHTML(item.topic || "General Quiz")}</h3>
                <div style="font-size: 12px; color: var(--text-sub); margin-bottom: 16px;">
                    ${item.score} / ${item.numQuestions} Correct • ${escapeHTML(item.difficulty)} • ${formatTime(item.timeTaken || 0)}
                </div>
            </div>
            <div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 10px;">Completed on ${formattedDate}</div>
                <button onclick="deleteHistoryRecord('${item.id}')" style="width: 100%; background: rgba(239,68,68,0.12); color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">🗑️ Delete Record</button>
            </div>
        `;

        container.appendChild(card);
    });
}

async function deleteHistoryRecord(id) {
    const user = getCurrentUser();
    if (!user) return;

    if (!confirm("Delete this quiz history record?")) return;

    try {
        const response = await fetch(`${API_URL}/api/quizzes/${id}`, {
            method: "DELETE",
            headers: { "x-user-id": String(user.id) }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to delete record.");
        }

        await loadHistory();
        await loadWeakTopics();
    } catch (e) {
        console.error("Delete History Record Error:", e);
        alert(e.message || "Failed to delete history record.");
    }
}

async function loadWeakTopics() {
    const user = getCurrentUser();
    if (!user || !user.id) return;

    try {
        const response = await fetch(`${API_URL}/api/quizzes/weak-topics/${user.id}`);
        const data = await response.json().catch(() => ({ hasData: false, weakTopics: [] }));

        const section = document.getElementById("weakTopicsSection");
        const textEl = document.getElementById("weakTopicsText");

        if (!section || !textEl) return;

        if (data.hasData && Array.isArray(data.weakTopics) && data.weakTopics.length > 0) {
            section.style.display = "block";
            const topWeak = data.weakTopics[0];
            textEl.innerHTML = `We identified poor performance in <strong>${escapeHTML(topWeak.topic)}</strong> (${topWeak.accuracy}% accuracy across ${topWeak.attempts} attempt(s)). <a href="notes.html" style="color: var(--accent-blue); text-decoration: underline; font-weight: 700;">Revise in AI Notes →</a>`;
        } else {
            section.style.display = "none";
        }
    } catch (e) {
        console.error("Load Weak Topics Error:", e);
    }
}

// Global Exports
window.generateAIQuiz = generateAIQuiz;
window.navigateQuestion = navigateQuestion;
window.selectOption = selectOption;
window.confirmSubmitQuiz = confirmSubmitQuiz;
window.retryCurrentQuiz = retryCurrentQuiz;
window.resetQuizSetup = resetQuizSetup;
window.filterHistory = filterHistory;
window.deleteHistoryRecord = deleteHistoryRecord;

document.addEventListener("DOMContentLoaded", () => {
    loadHistory();
    loadWeakTopics();
});
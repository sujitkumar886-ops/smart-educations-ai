// =====================================
// SMART EDUCATION AI - PERFORMANCE (USER ISOLATED)
// =====================================

const API_URL = "";

function getCurrentUser() {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) return null;
    try { return JSON.parse(userStr); } catch (e) { return null; }
}

const currentUser = getCurrentUser();
if (!currentUser || !currentUser.id) {
    alert("Please login first to view performance.");
    window.location.href = "login.html";
}

async function loadPerformance() {
    // Quiz score scoped to current user
    const quizData = JSON.parse(localStorage.getItem(`lastQuizScore_${currentUser.id}`));

    let quizScore = 0;
    let quizTotal = 0;
    let quizPercentage = 0;

    if (quizData) {
        quizScore = quizData.score || 0;
        quizTotal = quizData.total || 0;
        quizPercentage = quizData.percentage || 0;
    }

    // Tasks scoped to current user
    let tasks = [];
    try {
        const response = await fetch(`${API_URL}/api/planner/${currentUser.id}`);
        if (response.ok) {
            tasks = await response.json();
        } else {
            tasks = JSON.parse(localStorage.getItem(`studyTasks_${currentUser.id}`)) || [];
        }
    } catch (e) {
        tasks = JSON.parse(localStorage.getItem(`studyTasks_${currentUser.id}`)) || [];
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const pendingTasks = Math.max(0, totalTasks - completedTasks);

    // Update DOM safely
    const setElemText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    setElemText("quizScore", `${quizScore}/${quizTotal}`);
    setElemText("quizPercentage", `${quizPercentage}%`);
    setElemText("totalTasks", totalTasks);
    setElemText("completedTasks", completedTasks);
    setElemText("summaryCompleted", completedTasks);
    setElemText("summaryPending", pendingTasks);

    const perfLevel = document.getElementById("performanceLevel");
    if (perfLevel) {
        if (quizPercentage >= 80 && completedTasks > 0) {
            perfLevel.innerText = "🌟 Excellent (Top Performer)";
            perfLevel.style.color = "#16a34a";
        } else if (quizPercentage >= 50 || completedTasks > 0) {
            perfLevel.innerText = "📈 Steady Progress";
            perfLevel.style.color = "#2563eb";
        } else {
            perfLevel.innerText = "📚 Getting Started";
            perfLevel.style.color = "#d97706";
        }
    }
}

document.addEventListener("DOMContentLoaded", loadPerformance);
// =====================================
// SMART EDUCATION AI - RECOMMENDATIONS (USER ISOLATED)
// =====================================

const API_URL = "";

function getCurrentUser() {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) return null;
    try { return JSON.parse(userStr); } catch (e) { return null; }
}

const currentUser = getCurrentUser();
if (!currentUser || !currentUser.id) {
    alert("Please login first to view AI recommendations.");
    window.location.href = "login.html";
}

async function loadRecommendations() {
    // Isolated data reading
    const quizData = JSON.parse(localStorage.getItem(`lastQuizScore_${currentUser.id}`));
    const quizPercentage = quizData ? (quizData.percentage || 0) : 0;

    let tasks = [];
    try {
        const res = await fetch(`${API_URL}/api/planner/${currentUser.id}`);
        if (res.ok) tasks = await res.json();
        else tasks = JSON.parse(localStorage.getItem(`studyTasks_${currentUser.id}`)) || [];
    } catch (e) {
        tasks = JSON.parse(localStorage.getItem(`studyTasks_${currentUser.id}`)) || [];
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;

    const setElem = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    setElem("quizPercent", `${quizPercentage}%`);
    setElem("totalTask", totalTasks);
    setElem("completedTask", completedTasks);

    const recList = document.getElementById("recommendationList");
    if (!recList) return;

    recList.innerHTML = "";
    const recs = [];

    if (quizPercentage >= 80) {
        recs.push({
            icon: "🏆",
            title: "Advanced Mastery Challenge",
            text: "Your quiz performance is outstanding! Test your knowledge on higher-level DSA, System Design, or Machine Learning topics."
        });
    } else if (quizPercentage >= 60) {
        recs.push({
            icon: "💪",
            title: "Targeted Practice Recommended",
            text: "Good job on recent quizzes! Re-read saved notes on incorrect questions to reach 90%+ mastery."
        });
    } else if (quizData) {
        recs.push({
            icon: "📖",
            title: "Foundational Study Session Needed",
            text: "Take 20 minutes to review key concepts in your Study Notes and retry the Smart Quiz."
        });
    } else {
        recs.push({
            icon: "📝",
            title: "Take Your First Quiz",
            text: "You haven't completed a quiz yet. Head over to Smart Quiz to benchmark your preparation level!"
        });
    }

    if (completedTasks === 0 && totalTasks > 0) {
        recs.push({
            icon: "⏰",
            title: "Task Completion Focus",
            text: "You have planned study tasks waiting! Complete at least one task today to build your streak."
        });
    } else if (totalTasks === 0) {
        recs.push({
            icon: "📅",
            title: "Plan Your Study Schedule",
            text: "Create study tasks in the Study Planner to organize your daily learning effectively."
        });
    } else {
        recs.push({
            icon: "🔥",
            title: "Maintain Study Streak",
            text: "Consistency is key! Remember to record your study session in Study Streak every day."
        });
    }

    recs.forEach(rec => {
        const card = document.createElement("div");
        card.className = "recommendation-card";
        card.style.cssText = "display: flex; gap: 15px; padding: 18px; border-radius: 12px; background: #ffffff; border: 1px solid #e5e7eb; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);";
        card.innerHTML = `
            <div style="font-size: 28px;">${rec.icon}</div>
            <div>
                <h3 style="margin: 0 0 6px 0; color: #1e293b; font-size: 17px;">${rec.title}</h3>
                <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">${rec.text}</p>
            </div>
        `;
        recList.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", loadRecommendations);
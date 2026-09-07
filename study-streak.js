// =====================================
// SMART EDUCATION AI - STUDY STREAK (USER ISOLATED)
// =====================================

function getCurrentUser() {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

const currentUser = getCurrentUser();
if (!currentUser || !currentUser.id) {
    alert("Please login to view your study streak.");
    window.location.href = "login.html";
}

const STORAGE_KEY = `studyStreakData_${currentUser ? currentUser.id : "guest"}`;

let studyData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    dates: [],
    bestStreak: 0
};

function getLocalToday() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData));
}

function calculateCurrentStreak() {
    if (!studyData.dates || studyData.dates.length === 0) return 0;

    const sortedDates = Array.from(new Set(studyData.dates)).sort();
    const todayStr = getLocalToday();
    const todayDate = new Date(todayStr);

    let currentStreak = 0;
    let checkDate = new Date(todayDate);

    // If today is not marked, check if yesterday was marked
    const todayFormatted = todayStr;
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayFormatted = formatDateStr(yesterdayDate);

    if (!sortedDates.includes(todayFormatted) && !sortedDates.includes(yesterdayFormatted)) {
        return 0;
    }

    if (!sortedDates.includes(todayFormatted)) {
        checkDate = yesterdayDate;
    }

    while (true) {
        const formatted = formatDateStr(checkDate);
        if (sortedDates.includes(formatted)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return currentStreak;
}

function formatDateStr(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function markStudyToday() {
    const todayStr = getLocalToday();

    if (!studyData.dates) studyData.dates = [];

    if (!studyData.dates.includes(todayStr)) {
        studyData.dates.push(todayStr);
        studyData.dates.sort();

        const currentStreak = calculateCurrentStreak();
        if (currentStreak > (studyData.bestStreak || 0)) {
            studyData.bestStreak = currentStreak;
        }

        saveData();
        updatePage();
        alert("Awesome work! Today's study session has been logged. 🔥");
    } else {
        alert("You have already recorded your study session for today! ✅");
    }
}

function updatePage() {
    const streak = calculateCurrentStreak();
    const best = studyData.bestStreak || streak;
    const totalDays = studyData.dates ? studyData.dates.length : 0;

    const streakEl = document.getElementById("currentStreak");
    const bestEl = document.getElementById("bestStreak");
    const totalEl = document.getElementById("totalStudyDays");
    const statusMsg = document.getElementById("streakStatusMsg");

    if (streakEl) streakEl.innerText = streak;
    if (bestEl) bestEl.innerText = best;
    if (totalEl) totalEl.innerText = totalDays;

    if (statusMsg) {
        const todayStr = getLocalToday();
        const studiedToday = studyData.dates && studyData.dates.includes(todayStr);
        if (studiedToday) {
            statusMsg.innerText = `🔥 You're on a ${streak}-day streak! Keep up the momentum tomorrow.`;
        } else {
            statusMsg.innerText = `⚡ Mark today as studied to keep your ${streak}-day streak active!`;
        }
    }
}

window.markStudyToday = markStudyToday;

document.addEventListener("DOMContentLoaded", updatePage);
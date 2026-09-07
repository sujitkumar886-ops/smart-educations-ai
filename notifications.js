// =====================================
// SMART EDUCATION AI - NOTIFICATIONS SYSTEM
// =====================================

function toggleNotificationDrawer() {
    const drawer = document.getElementById("notificationDrawer");
    if (drawer) drawer.classList.toggle("open");
}

async function loadNotifications() {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) return;
    const user = JSON.parse(userStr);

    const list = document.getElementById("notificationList");
    if (!list) return;

    // Build notifications from study streak and upcoming tasks
    const streakData = JSON.parse(localStorage.getItem(`studyStreakData_${user.id}`)) || {};
    const todayStr = new Date().toISOString().split("T")[0];
    const studiedToday = streakData.dates && streakData.dates.includes(todayStr);

    const notes = [
        {
            title: studiedToday ? "🔥 Streak Active!" : "⚡ Streak Reminder",
            message: studiedToday ? "Great job! You logged study activity today." : "Don't forget to mark today as studied to keep your streak alive!",
            type: studiedToday ? "success" : "warning"
        },
        {
            title: "🤖 AI Study Tutor Ready",
            message: "Need help preparing for exams? Try asking AI Tutor with prompt chips.",
            type: "info"
        }
    ];

    list.innerHTML = "";
    notes.forEach(note => {
        const item = document.createElement("div");
        item.style.cssText = "padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);";
        item.innerHTML = `
            <strong style="color: #60a5fa; font-size: 14px; display: block; margin-bottom: 4px;">${note.title}</strong>
            <p style="color: #cbd5e1; font-size: 13px; margin: 0;">${note.message}</p>
        `;
        list.appendChild(item);
    });
}

window.toggleNotificationDrawer = toggleNotificationDrawer;
document.addEventListener("DOMContentLoaded", loadNotifications);

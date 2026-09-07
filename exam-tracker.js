// =====================================
// SMART EDUCATION AI - EXAM TRACKER
// =====================================

function getCurrentUser() {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) return null;
    try { return JSON.parse(userStr); } catch (e) { return null; }
}

const currentUser = getCurrentUser();
if (!currentUser || !currentUser.id) {
    alert("Please login first to use Exam Tracker.");
    window.location.href = "login.html";
}

const STORAGE_KEY = `examTrackerData_${currentUser ? currentUser.id : "guest"}`;

let exams = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [
    { id: "1", subject: "Data Structures & Algorithms", date: "2026-10-15", time: "10:00" },
    { id: "2", subject: "Database Management Systems", date: "2026-10-20", time: "14:00" }
];

function saveExams() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exams));
}

function calculateDaysLeft(examDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(examDateStr);
    examDate.setHours(0, 0, 0, 0);

    const diffTime = examDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function renderExams() {
    const container = document.getElementById("examList");
    if (!container) return;

    container.innerHTML = "";

    if (!exams || exams.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #64748b; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;">
                <p>No exams tracked yet. Add your upcoming exams above! 📅</p>
            </div>
        `;
        return;
    }

    // Sort by exam date
    exams.sort((a, b) => new Date(a.date) - new Date(b.date));

    exams.forEach((exam, index) => {
        const daysLeft = calculateDaysLeft(exam.date);
        const card = document.createElement("div");
        card.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 18px 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);";

        let badgeBg = "#2563eb";
        let statusText = `${daysLeft} days remaining`;
        if (daysLeft < 0) {
            badgeBg = "#94a3b8";
            statusText = "Completed";
        } else if (daysLeft === 0) {
            badgeBg = "#dc2626";
            statusText = "TODAY! ⚠️";
        } else if (daysLeft <= 3) {
            badgeBg = "#ea580c";
            statusText = `${daysLeft} days left! ⏳`;
        }

        card.innerHTML = `
            <div>
                <h3 style="margin: 0 0 6px 0; color: #1e293b; font-size: 18px;">📚 ${exam.subject}</h3>
                <p style="margin: 0; color: #64748b; font-size: 14px;">Date: <strong>${exam.date}</strong> ${exam.time ? `at ${exam.time}` : ""}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="background: ${badgeBg}; color: #fff; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 14px;">
                    ${statusText}
                </span>
                <button onclick="deleteExam('${exam.id}')" style="background: #fee2e2; color: #b91c1c; border: 0; padding: 8px 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    Delete
                </button>
            </div>
        `;

        container.appendChild(card);
    });
}

function addExam(e) {
    if (e) e.preventDefault();

    const subject = (document.getElementById("examSubject")?.value || "").trim();
    const date = document.getElementById("examDate")?.value;
    const time = document.getElementById("examTime")?.value || "";

    if (!subject || !date) {
        alert("Please enter both the exam subject and date.");
        return;
    }

    exams.push({
        id: Date.now().toString(),
        subject,
        date,
        time
    });

    saveExams();
    renderExams();

    if (document.getElementById("examSubject")) document.getElementById("examSubject").value = "";
    if (document.getElementById("examDate")) document.getElementById("examDate").value = "";
    if (document.getElementById("examTime")) document.getElementById("examTime").value = "";

    alert("Exam added to tracker! 📅");
}

function deleteExam(id) {
    exams = exams.filter(e => String(e.id) !== String(id));
    saveExams();
    renderExams();
}

window.addExam = addExam;
window.deleteExam = deleteExam;

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("examForm");
    if (form) form.addEventListener("submit", addExam);
    renderExams();
});

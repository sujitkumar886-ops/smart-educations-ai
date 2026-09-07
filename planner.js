// =====================================
// SMART EDUCATION AI - STUDY PLANNER
// =====================================

const API_URL = "";

function getCurrentUser() {
    const userStr = localStorage.getItem("currentUser") || 
                    localStorage.getItem("smart_edu_user") || 
                    localStorage.getItem("student");
    if (!userStr) return null;
    try { return JSON.parse(userStr); } catch (e) { return null; }
}

const currentUser = getCurrentUser();
if (!currentUser || !currentUser.id) {
    alert("Please login first to access the Study Planner.");
    window.location.href = "login.html";
}

let tasks = [];

async function loadPlanner() {
    const list = document.getElementById("plannerList");
    if (!list) return;

    try {
        const response = await fetch(`${API_URL}/api/planner/${currentUser.id}`);
        if (!response.ok) throw new Error("API call failed");
        tasks = await response.json();
    } catch (error) {
        console.warn("Backend load error, reading local fallback:", error);
        const localKey = `studyTasks_${currentUser.id}`;
        tasks = JSON.parse(localStorage.getItem(localKey) || "[]");
    }

    localStorage.setItem(`studyTasks_${currentUser.id}`, JSON.stringify(tasks));
    displayPlans();
}

function displayPlans() {
    const list = document.getElementById("plannerList");
    const barEl = document.getElementById("plannerProgressBar");
    const badgeEl = document.getElementById("plannerProgressBadge");
    if (!list) return;

    list.innerHTML = "";

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (barEl) barEl.style.width = `${pct}%`;
    if (badgeEl) badgeEl.innerText = `${pct}% Completed (${completed}/${total})`;

    if (!tasks || tasks.length === 0) {
        list.innerHTML = `
            <div class="empty-state-card">
                <svg class="empty-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <h4>No Study Tasks Scheduled</h4>
                <p>Create your first study schedule task above to track your daily progress! 📖</p>
            </div>
        `;
        return;
    }

    tasks.forEach(task => {
        const card = document.createElement("div");
        card.className = `task ${task.completed ? "done" : ""}`;
        card.style.cssText = "display: flex; align-items: center; gap: 14px; padding: 18px; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; margin-top: 12px; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(10px); transition: all 0.3s;";

        const check = document.createElement("input");
        check.type = "checkbox";
        check.style.cssText = "width: 20px; height: 20px; cursor: pointer; accent-color: #6366f1;";
        check.checked = Boolean(task.completed);
        check.addEventListener("change", () => togglePlan(task.id, check.checked));

        const priority = task.priority || "Medium";
        let priorityBadge = `<span class="badge-tag badge-medium">${priority}</span>`;
        if (priority === "High") priorityBadge = `<span class="badge-tag badge-high">${priority}</span>`;
        if (priority === "Low") priorityBadge = `<span class="badge-tag badge-low">${priority}</span>`;

        const name = document.createElement("div");
        name.className = "task-name";
        name.style.cssText = "flex: 1;";
        name.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                ${priorityBadge}
                <strong style="color: #ffffff; font-size: 16px; ${task.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHTML(task.subject)}: ${escapeHTML(task.topic || task.name || "Study Task")}</strong>
            </div>
            <div style="color: #64748b; font-size: 13px;">📅 Date: ${task.date || "Today"} | ⏰ Time: ${task.time || "10:00"} (${task.duration || 45} mins)</div>
        `;

        const delBtn = document.createElement("button");
        delBtn.className = "delete-task";
        delBtn.type = "button";
        delBtn.style.cssText = "border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.15); color: #fca5a5; padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;";
        delBtn.innerText = "🗑️ Delete";
        delBtn.onclick = () => deletePlan(task.id);

        card.appendChild(check);
        card.appendChild(name);
        card.appendChild(delBtn);

        list.appendChild(card);
    });
}

async function addPlan(event) {
    if (event) event.preventDefault();

    const subject = (document.getElementById("subjectInput")?.value || "").trim();
    const topic = (document.getElementById("topicInput")?.value || "").trim();
    const priority = document.getElementById("priorityInput")?.value || "Medium";
    const date = document.getElementById("dateInput")?.value || new Date().toISOString().split("T")[0];
    const time = document.getElementById("timeInput")?.value || "10:00";
    const duration = document.getElementById("durationInput")?.value || 45;

    if (!subject && !topic) {
        alert("Please enter a subject or topic for your study task.");
        return;
    }

    const payload = {
        studentId: currentUser.id,
        subject: subject || topic,
        topic: topic || subject,
        priority,
        date,
        time,
        duration: Number(duration)
    };

    try {
        const response = await fetch(`${API_URL}/api/planner`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            tasks.unshift(data.task);
        } else {
            throw new Error("API post failed");
        }
    } catch (e) {
        const newTask = {
            id: Date.now().toString(),
            studentId: currentUser.id,
            ...payload,
            completed: false
        };
        tasks.unshift(newTask);
    }

    localStorage.setItem(`studyTasks_${currentUser.id}`, JSON.stringify(tasks));

    ["subjectInput", "topicInput", "dateInput", "timeInput", "durationInput"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    displayPlans();
}

async function togglePlan(id, completed) {
    const task = tasks.find(t => String(t.id) === String(id));
    if (task) task.completed = completed;

    try {
        await fetch(`${API_URL}/api/planner/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed })
        });
    } catch (e) {}

    localStorage.setItem(`studyTasks_${currentUser.id}`, JSON.stringify(tasks));
    displayPlans();
}

async function deletePlan(id) {
    tasks = tasks.filter(t => String(t.id) !== String(id));

    try {
        await fetch(`${API_URL}/api/planner/${id}`, { method: "DELETE" });
    } catch (e) {}

    localStorage.setItem(`studyTasks_${currentUser.id}`, JSON.stringify(tasks));
    displayPlans();
}

function escapeHTML(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.addPlan = addPlan;
window.togglePlan = togglePlan;
window.deletePlan = deletePlan;

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("plannerForm");
    if (form) form.addEventListener("submit", addPlan);
    loadPlanner();
});
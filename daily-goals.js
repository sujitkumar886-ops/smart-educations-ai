// =====================================
// SMART EDUCATION AI - DAILY GOALS (USER ISOLATED)
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
    alert("Please login to access your daily goals.");
    window.location.href = "login.html";
}

const STORAGE_KEY = `smartEducationDailyGoals_${currentUser ? currentUser.id : "guest"}`;

function getLocalToday() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const today = getLocalToday();

let goals = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    date: today,
    hoursGoal: 0,
    tasksGoal: 0,
    hoursDone: 0,
    tasksDone: 0
};

if (goals.date !== today) {
    goals = {
        date: today,
        hoursGoal: 0,
        tasksGoal: 0,
        hoursDone: 0,
        tasksDone: 0
    };
    saveData();
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

function updatePage() {
    const hoursGoalEl = document.getElementById("hoursGoal");
    const tasksGoalEl = document.getElementById("tasksGoal");
    const displayHoursGoal = document.getElementById("displayHoursGoal");
    const displayTasksGoal = document.getElementById("displayTasksGoal");
    const displayHoursDone = document.getElementById("displayHoursDone");
    const displayTasksDone = document.getElementById("displayTasksDone");
    const hoursBar = document.getElementById("hoursProgress");
    const tasksBar = document.getElementById("tasksProgress");
    const statusBox = document.getElementById("goalStatus");

    if (hoursGoalEl && goals.hoursGoal > 0) hoursGoalEl.value = goals.hoursGoal;
    if (tasksGoalEl && goals.tasksGoal > 0) tasksGoalEl.value = goals.tasksGoal;

    if (displayHoursGoal) displayHoursGoal.innerText = goals.hoursGoal;
    if (displayTasksGoal) displayTasksGoal.innerText = goals.tasksGoal;
    if (displayHoursDone) displayHoursDone.innerText = goals.hoursDone;
    if (displayTasksDone) displayTasksDone.innerText = goals.tasksDone;

    const hoursPct = goals.hoursGoal > 0 ? Math.min(100, Math.round((goals.hoursDone / goals.hoursGoal) * 100)) : 0;
    const tasksPct = goals.tasksGoal > 0 ? Math.min(100, Math.round((goals.tasksDone / goals.tasksGoal) * 100)) : 0;

    if (hoursBar) hoursBar.style.width = `${hoursPct}%`;
    if (tasksBar) tasksBar.style.width = `${tasksPct}%`;

    if (statusBox) {
        if (goals.hoursGoal === 0 && goals.tasksGoal === 0) {
            statusBox.innerText = "Set your goals for today to start tracking!";
            statusBox.className = "status-box warning";
        } else if (hoursPct >= 100 && tasksPct >= 100) {
            statusBox.innerText = "🎉 Fantastic! All daily goals completed!";
            statusBox.className = "status-box success";
        } else {
            statusBox.innerText = `Keep going! Study Progress: ${hoursPct}% | Tasks Progress: ${tasksPct}%`;
            statusBox.className = "status-box info";
        }
    }
}

function saveGoals() {
    const hoursInput = document.getElementById("hoursGoal");
    const tasksInput = document.getElementById("tasksGoal");
    const hours = Number(hoursInput?.value || 0);
    const tasks = Number(tasksInput?.value || 0);

    if (hours <= 0 || tasks <= 0) {
        alert("Please enter valid positive numbers for both goals.");
        return;
    }

    goals.hoursGoal = hours;
    goals.tasksGoal = tasks;
    saveData();
    updatePage();
    alert("Goals saved for today! 🎯");
}

function addHour() {
    if (goals.hoursGoal === 0) {
        alert("Please set your Study Hours Goal first!");
        return;
    }
    goals.hoursDone += 1;
    saveData();
    updatePage();
}

function addTaskDone() {
    if (goals.tasksGoal === 0) {
        alert("Please set your Tasks Goal first!");
        return;
    }
    goals.tasksDone += 1;
    saveData();
    updatePage();
}

function resetGoals() {
    if (confirm("Are you sure you want to reset today's goals?")) {
        goals = {
            date: today,
            hoursGoal: 0,
            tasksGoal: 0,
            hoursDone: 0,
            tasksDone: 0
        };
        saveData();
        updatePage();
    }
}

window.saveGoals = saveGoals;
window.addHour = addHour;
window.addTaskDone = addTaskDone;
window.resetGoals = resetGoals;

document.addEventListener("DOMContentLoaded", updatePage);
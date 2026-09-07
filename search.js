// =====================================
// SMART EDUCATION AI - GLOBAL SEARCH ENGINE
// =====================================

function toggleGlobalSearch() {
    const modal = document.getElementById("searchModal");
    if (modal) {
        modal.classList.toggle("open");
        if (modal.classList.contains("open")) {
            const input = document.getElementById("globalSearchInput");
            if (input) {
                input.value = "";
                input.focus();
            }
            performGlobalSearch("");
        }
    }
}

async function performGlobalSearch(query) {
    const q = (query || "").toLowerCase().trim();
    const resultsContainer = document.getElementById("globalSearchResults");
    if (!resultsContainer) return;

    const userStr = localStorage.getItem("currentUser");
    if (!userStr) return;
    const user = JSON.parse(userStr);

    resultsContainer.innerHTML = "";

    let notes = [];
    try {
        const res = await fetch(`/api/notes/${user.id}`);
        if (res.ok) notes = await res.json();
    } catch (e) {}

    let tasks = [];
    try {
        const res = await fetch(`/api/planner/${user.id}`);
        if (res.ok) tasks = await res.json();
    } catch (e) {}

    const matchingNotes = notes.filter(n => (n.title || "").toLowerCase().includes(q) || (n.content || "").toLowerCase().includes(q));
    const matchingTasks = tasks.filter(t => (t.subject || "").toLowerCase().includes(q) || (t.topic || "").toLowerCase().includes(q));

    if (matchingNotes.length === 0 && matchingTasks.length === 0) {
        resultsContainer.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 20px;">No matching notes or study tasks found.</p>`;
        return;
    }

    matchingNotes.forEach(note => {
        const div = document.createElement("div");
        div.style.cssText = "padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer;";
        div.onclick = () => window.location.href = "notes.html";
        div.innerHTML = `<strong style="color: #60a5fa;">📝 Note: ${note.title}</strong><p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">${(note.content || "").slice(0, 100)}...</p>`;
        resultsContainer.appendChild(div);
    });

    matchingTasks.forEach(task => {
        const div = document.createElement("div");
        div.style.cssText = "padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer;";
        div.onclick = () => window.location.href = "study-planner.html";
        div.innerHTML = `<strong style="color: #4ade80;">📅 Task: ${task.subject} - ${task.topic}</strong><p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">Priority: ${task.priority || "Medium"} | Date: ${task.date}</p>`;
        resultsContainer.appendChild(div);
    });
}

window.toggleGlobalSearch = toggleGlobalSearch;
window.performGlobalSearch = performGlobalSearch;

document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        toggleGlobalSearch();
    }
});

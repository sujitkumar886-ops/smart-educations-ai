document.addEventListener("DOMContentLoaded", () => {
    loadStudentsRoster();
    setupAssignmentForm();
    loadAssignments();
});

function getStoredStudent() {
    try {
        const data = localStorage.getItem("student");
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

async function loadStudentsRoster() {
    const tbody = document.getElementById("studentRosterBody");
    const badge = document.getElementById("studentCountBadge");
    if (!tbody) return;

    try {
        const res = await fetch("/api/teacher/students");
        if (!res.ok) throw new Error("Failed to load students roster");

        const students = await res.json();
        if (badge) badge.textContent = `${students.length} Students`;

        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">No registered students found.</td></tr>`;
            return;
        }

        tbody.innerHTML = students.map(s => `
            <tr>
                <td style="font-weight: 600; color: #fff;">${escapeHtml(s.name)}</td>
                <td style="color: #94a3b8;">${escapeHtml(s.email)}</td>
                <td><span class="badge-tag badge-cs">${escapeHtml(s.course)} (${escapeHtml(s.semester)})</span></td>
                <td>Level ${s.level}</td>
                <td style="color: #60a5fa; font-weight: 700;">${s.xp} XP</td>
            </tr>
        `).join("");
    } catch (e) {
        console.error("Student roster error:", e);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #f87171;">Failed to load roster from server.</td></tr>`;
    }
}

function setupAssignmentForm() {
    const form = document.getElementById("assignmentForm");
    if (!form) return;

    // Set default due date to tomorrow
    const dueDateInput = document.getElementById("assignDueDate");
    if (dueDateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 7);
        dueDateInput.value = tomorrow.toISOString().split("T")[0];
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const teacher = getStoredStudent();
        const teacherId = teacher ? teacher.id : "teacher_1";

        const title = document.getElementById("assignTitle").value;
        const subject = document.getElementById("assignSubject").value;
        const dueDate = document.getElementById("assignDueDate").value;
        const description = document.getElementById("assignDesc").value;

        try {
            const res = await fetch("/api/teacher/assignment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teacherId, title, subject, dueDate, description })
            });

            if (!res.ok) {
                const errData = await res.json();
                alert(errData.error || "Failed to create assignment.");
                return;
            }

            const data = await res.json();
            alert("✅ Assignment created and published to student portals!");
            form.reset();
            loadAssignments();
        } catch (e) {
            console.error("Create assignment error:", e);
            alert("Failed to connect to backend server.");
        }
    });
}

function loadAssignments() {
    const container = document.getElementById("assignmentsListContainer");
    if (!container) return;

    // Retrieve created assignments from local storage fallback or display mock default
    try {
        const local = JSON.parse(localStorage.getItem("teacherAssignments") || "[]");
        if (local.length === 0) {
            container.innerHTML = `
                <div style="background: rgba(15, 23, 42, 0.5); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; color: #60a5fa;">Data Structures Binary Trees Lab</h4>
                        <span style="font-size: 12px; color: #fbbf24;">Due: Next Week</span>
                    </div>
                    <p style="font-size: 13px; color: #94a3b8; margin: 8px 0 0 0;">Implement BST insertion, deletion, and in-order traversal algorithms in C++ or Python.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = local.map(a => `
            <div style="background: rgba(15, 23, 42, 0.5); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0; color: #60a5fa;">${escapeHtml(a.title)}</h4>
                    <span style="font-size: 12px; color: #fbbf24;">Due: ${escapeHtml(a.dueDate)}</span>
                </div>
                <span class="badge-tag badge-cs" style="font-size: 11px; margin-top: 6px; display: inline-block;">${escapeHtml(a.subject)}</span>
                <p style="font-size: 13px; color: #94a3b8; margin: 8px 0 0 0;">${escapeHtml(a.description)}</p>
            </div>
        `).join("");
    } catch (e) {
        console.error("Load assignments error:", e);
    }
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

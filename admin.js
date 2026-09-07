// ==========================================================================
// SMART EDUCATION AI - ADMIN CONTROL CENTER CLIENT ENGINE
// ==========================================================================

let activeAdminUser = null;
let cachedUsers = [];

document.addEventListener("DOMContentLoaded", () => {
    initAdminAccess();
});

function initAdminAccess() {
    // Resolve logged in user from storage using auth helper if available
    if (typeof getAuthenticatedUser === "function") {
        activeAdminUser = getAuthenticatedUser();
    } else {
        try {
            const raw = localStorage.getItem("currentUser") || localStorage.getItem("smart_edu_user") || localStorage.getItem("student");
            if (raw) activeAdminUser = JSON.parse(raw);
        } catch (e) {}
    }

    const deniedBox = document.getElementById("accessDeniedContainer");
    const adminBox = document.getElementById("adminContentContainer");

    if (!activeAdminUser) {
        alert("Please log in first to access the platform.");
        window.location.href = "login.html";
        return;
    }

    // STRICT ROLE ACCESS CONTROL: Only allow role === 'admin'
    if ((activeAdminUser.role || "student") !== "admin") {
        if (deniedBox) deniedBox.style.display = "block";
        if (adminBox) adminBox.style.display = "none";
        return;
    }

    // User is verified ADMIN: Show Admin Interface
    if (deniedBox) deniedBox.style.display = "none";
    if (adminBox) adminBox.style.display = "block";

    // Attach Event Listeners
    setupEventListeners();

    // Initial Data Fetch
    loadAdminStats();
    loadUsersList();
    loadActivityTimeline();
}

function setupEventListeners() {
    const refreshBtn = document.getElementById("refreshUsersBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadAdminStats();
            loadUsersList();
            loadActivityTimeline();
        });
    }

    const searchInput = document.getElementById("adminSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", filterAndRenderUsers);
    }

    const roleFilter = document.getElementById("roleFilterSelect");
    if (roleFilter) {
        roleFilter.addEventListener("change", filterAndRenderUsers);
    }

    const sortSelect = document.getElementById("sortUsersSelect");
    if (sortSelect) {
        sortSelect.addEventListener("change", filterAndRenderUsers);
    }
}

function getAdminAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "x-user-id": activeAdminUser ? String(activeAdminUser.id) : ""
    };
}

async function loadAdminStats() {
    try {
        const res = await fetch("/api/admin/stats", {
            headers: getAdminAuthHeaders()
        });

        if (res.status === 403 || res.status === 401) {
            document.getElementById("accessDeniedContainer").style.display = "block";
            document.getElementById("adminContentContainer").style.display = "none";
            return;
        }

        if (!res.ok) throw new Error("Failed to load stats");

        const stats = await res.json();
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setVal("statUsers", stats.totalUsers || 0);
        setVal("statStudents", stats.totalStudents || 0);
        setVal("statTeachers", stats.totalTeachers || 0);
        setVal("statAdmins", stats.totalAdmins || 0);
        setVal("statNotes", stats.totalNotes || 0);
        setVal("statPDFs", stats.totalPDFs || 0);
        setVal("statImages", stats.totalImageSolutions || 0);

        const uptimeSecs = stats.serverUptime || 0;
        const mins = Math.floor(uptimeSecs / 60);
        const hours = Math.floor(mins / 60);
        setVal("statUptime", hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m ${uptimeSecs % 60}s`);

    } catch (e) {
        console.error("Admin stats fetch error:", e);
    }
}

async function loadUsersList() {
    const tbody = document.getElementById("userAccountsBody");
    if (!tbody) return;

    try {
        const res = await fetch("/api/admin/users", {
            headers: getAdminAuthHeaders()
        });

        if (res.status === 403 || res.status === 401) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #f87171;">Access Denied: HTTP 403 Forbidden. You do not have Admin privileges.</td></tr>`;
            return;
        }

        if (!res.ok) throw new Error("Failed to load users");

        cachedUsers = await res.json();
        filterAndRenderUsers();
    } catch (e) {
        console.error("Load users list error:", e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #f87171;">Failed to connect to backend server.</td></tr>`;
    }
}

function filterAndRenderUsers() {
    const tbody = document.getElementById("userAccountsBody");
    if (!tbody) return;

    const searchTerm = (document.getElementById("adminSearchInput")?.value || "").toLowerCase().trim();
    const roleFilter = document.getElementById("roleFilterSelect")?.value || "all";
    const sortBy = document.getElementById("sortUsersSelect")?.value || "newest";

    let filtered = cachedUsers.filter(u => {
        const matchSearch = (u.name || "").toLowerCase().includes(searchTerm) || (u.email || "").toLowerCase().includes(searchTerm);
        const matchRole = roleFilter === "all" || (u.role || "student") === roleFilter;
        return matchSearch && matchRole;
    });

    // Sorting
    filtered.sort((a, b) => {
        if (sortBy === "newest") return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        if (sortBy === "oldest") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
        if (sortBy === "xp") return (b.xp || 0) - (a.xp || 0);
        return 0;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px; color: #94a3b8;">No matching user accounts found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const stats = u.activityStats || {};
        const isSelf = String(u.id) === String(activeAdminUser.id);
        const isDisabled = Boolean(u.disabled);

        return `
            <tr style="${isDisabled ? 'opacity: 0.6; background: rgba(239,68,68,0.05);' : ''}">
                <td>
                    <div style="font-weight: 700; color: #fff;">${escapeHtml(u.name)} ${isSelf ? '<span class="badge-tag" style="background: rgba(99,102,241,0.2); color:#818cf8; font-size:10px;">YOU</span>' : ''}</div>
                    <div style="font-size: 12px; color: #94a3b8;">${escapeHtml(u.email)}</div>
                </td>
                <td>
                    <span class="badge-tag" style="background: ${u.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : u.role === 'teacher' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(96, 165, 250, 0.2)'}; color: ${u.role === 'admin' ? '#f87171' : u.role === 'teacher' ? '#fbbf24' : '#60a5fa'}; font-weight: 700;">
                        ${(u.role || 'student').toUpperCase()}
                    </span>
                </td>
                <td>
                    <span class="badge-tag" style="background: ${isDisabled ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}; color: ${isDisabled ? '#f87171' : '#34d399'}; font-size: 11px;">
                        ${isDisabled ? '⛔ Suspended' : '🟢 Active'}
                    </span>
                </td>
                <td style="font-size: 12px; color: #cbd5e1;">
                    <div>📝 Notes: <strong>${stats.notesCount || 0}</strong> | 📄 PDFs: <strong>${stats.pdfsCount || 0}</strong></div>
                    <div>🖼️ Solver: <strong>${stats.imageSolutionsCount || 0}</strong> | 🏆 Level: <strong>${u.level || 1}</strong> (${u.xp || 0} XP)</div>
                </td>
                <td style="font-size: 12px; color: #64748b;">${u.createdAt !== 'N/A' ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                        <button onclick="inspectUserDetail('${u.id}')" title="Inspect user activity metrics" style="padding: 5px 9px; font-size: 12px; border-radius: 6px; background: rgba(99,102,241,0.2); color: #818cf8; border: 1px solid rgba(99,102,241,0.4); cursor: pointer;">🔍 Activity</button>
                        
                        <select id="roleSelect_${u.id}" style="padding: 5px 8px; border-radius: 6px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 12px;">
                            <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
                            <option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>Teacher</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        <button onclick="updateUserRole('${u.id}')" style="padding: 5px 9px; font-size: 12px; border-radius: 6px; background: #2563eb; color: #fff; border: none; cursor: pointer;">Role</button>
                        
                        ${!isSelf ? `
                            <button onclick="toggleUserStatus('${u.id}', ${isDisabled})" style="padding: 5px 9px; font-size: 12px; border-radius: 6px; background: ${isDisabled ? '#10b981' : '#f59e0b'}; color: #fff; border: none; cursor: pointer;">
                                ${isDisabled ? 'Reactivate' : 'Suspend'}
                            </button>
                            <button onclick="deleteUserAccount('${u.id}', '${escapeHtml(u.name)}')" style="padding: 5px 9px; font-size: 12px; border-radius: 6px; background: #ef4444; color: #fff; border: none; cursor: pointer;">Delete</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

async function inspectUserDetail(userId) {
    const modal = document.getElementById("userDetailModal");
    const content = document.getElementById("modalContent");
    const title = document.getElementById("modalUserName");
    if (!modal || !content) return;

    modal.style.display = "flex";
    content.innerHTML = `<p style="color: #94a3b8;">Fetching detailed metrics for user ID ${userId}...</p>`;

    try {
        const res = await fetch(`/api/admin/users/${userId}`, {
            headers: getAdminAuthHeaders()
        });

        if (!res.ok) throw new Error("Failed to fetch user details");

        const data = await res.json();
        const u = data.user || {};

        if (title) title.innerText = `User Profile: ${u.name || 'Account'}`;

        content.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px;">
                    <div style="font-size: 12px; color: #94a3b8;">Email Address</div>
                    <div style="font-weight: 600; color: #fff;">${escapeHtml(u.email)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px;">
                    <div style="font-size: 12px; color: #94a3b8;">Role / Course</div>
                    <div style="font-weight: 600; color: #60a5fa;">${(u.role || 'student').toUpperCase()} | ${escapeHtml(u.course || 'B.Tech')}</div>
                </div>
            </div>

            <h4 style="color: #60a5fa; margin: 15px 0 10px;">📊 Platform Study Metrics</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; margin-bottom: 20px;">
                <div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); padding: 12px; border-radius: 10px;">
                    <div style="font-size: 20px; font-weight: 800; color: #818cf8;">${data.notesCount || 0}</div>
                    <div style="font-size: 11px; color: #94a3b8;">Notes Created</div>
                </div>
                <div style="background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2); padding: 12px; border-radius: 10px;">
                    <div style="font-size: 20px; font-weight: 800; color: #38bdf8;">${data.pdfsCount || 0}</div>
                    <div style="font-size: 11px; color: #94a3b8;">PDF Study Files</div>
                </div>
                <div style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2); padding: 12px; border-radius: 10px;">
                    <div style="font-size: 20px; font-weight: 800; color: #34d399;">${data.imageSolutionsCount || 0}</div>
                    <div style="font-size: 11px; color: #94a3b8;">Solved Images</div>
                </div>
                <div style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.2); padding: 12px; border-radius: 10px;">
                    <div style="font-size: 20px; font-weight: 800; color: #fbbf24;">${data.tasksCount || 0}</div>
                    <div style="font-size: 11px; color: #94a3b8;">Planner Tasks</div>
                </div>
            </div>

            <h4 style="color: #60a5fa; margin: 15px 0 10px;">Recent Study Activity Overview</h4>
            <div style="font-size: 13px; color: #94a3b8;">
                ${data.notesCount === 0 && data.pdfsCount === 0 && data.imageSolutionsCount === 0 
                    ? '<p>No study activity recorded yet for this account.</p>' 
                    : `<p>User actively engaged with ${data.notesCount} notes and ${data.pdfsCount} PDF study sessions.</p>`}
            </div>
        `;
    } catch (e) {
        console.error("Inspect user detail error:", e);
        content.innerHTML = `<p style="color: #f87171;">Failed to load user activity details.</p>`;
    }
}

function closeUserModal() {
    const modal = document.getElementById("userDetailModal");
    if (modal) modal.style.display = "none";
}

async function updateUserRole(userId) {
    const select = document.getElementById(`roleSelect_${userId}`);
    if (!select) return;
    const newRole = select.value;

    if (!confirm(`Are you sure you want to change this user's role to ${newRole.toUpperCase()}?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/users/${userId}/role`, {
            method: "PUT",
            headers: getAdminAuthHeaders(),
            body: JSON.stringify({ role: newRole })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            alert(`⚠️ Role Update Failed: ${data.error || "Permission denied."}`);
            return;
        }

        alert(`✅ User role successfully updated to ${newRole.toUpperCase()}`);
        loadAdminStats();
        loadUsersList();
    } catch (e) {
        console.error("Update role error:", e);
        alert("Failed to connect to backend server.");
    }
}

async function toggleUserStatus(userId, isCurrentlyDisabled) {
    const actionName = isCurrentlyDisabled ? "REACTIVATE" : "SUSPEND";
    if (!confirm(`Are you sure you want to ${actionName} this user account?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/users/${userId}/status`, {
            method: "PUT",
            headers: getAdminAuthHeaders(),
            body: JSON.stringify({ disabled: !isCurrentlyDisabled })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            alert(`⚠️ Action Failed: ${data.error || "Permission denied."}`);
            return;
        }

        alert(`✅ User account successfully ${isCurrentlyDisabled ? 'reactivated' : 'suspended'}.`);
        loadUsersList();
    } catch (e) {
        console.error("Toggle status error:", e);
        alert("Failed to connect to backend server.");
    }
}

async function deleteUserAccount(userId, userName) {
    if (!confirm(`⚠️ CRITICAL CONFIRMATION:\nAre you sure you want to PERMANENTLY DELETE the user account for "${userName}"?\nThis action CANNOT be undone.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/users/${userId}`, {
            method: "DELETE",
            headers: getAdminAuthHeaders()
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            alert(`⚠️ Deletion Failed: ${data.error || "Permission denied."}`);
            return;
        }

        alert(`✅ User account "${userName}" has been permanently deleted.`);
        loadAdminStats();
        loadUsersList();
    } catch (e) {
        console.error("Delete user error:", e);
        alert("Failed to connect to backend server.");
    }
}

async function loadActivityTimeline() {
    const container = document.getElementById("activityTimeline");
    if (!container) return;

    try {
        const res = await fetch("/api/admin/activity", {
            headers: getAdminAuthHeaders()
        });

        if (!res.ok) {
            container.innerHTML = `<p style="color: #94a3b8; font-size: 13px;">Activity log unavailable.</p>`;
            return;
        }

        const activities = await res.json();
        if (activities.length === 0) {
            container.innerHTML = `<p style="color: #94a3b8; font-size: 13px;">No recent platform activity logged.</p>`;
            return;
        }

        container.innerHTML = activities.map(a => `
            <div class="activity-item">
                <div>
                    <div style="font-weight: 600; color: #f1f5f9; font-size: 13px;">${escapeHtml(a.detail)}</div>
                    <div style="font-size: 11px; color: #64748b;">User: ${escapeHtml(a.userName)}</div>
                </div>
                <div style="font-size: 11px; color: #94a3b8; white-space: nowrap; margin-left: 10px;">
                    ${a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}
                </div>
            </div>
        `).join("");
    } catch (e) {
        console.error("Activity log error:", e);
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

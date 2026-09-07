document.addEventListener("DOMContentLoaded", () => {
    loadUserGamification();
    loadLeaderboard();
});

function getStoredStudent() {
    try {
        const raw = localStorage.getItem("student") || 
                    localStorage.getItem("currentUser") || 
                    localStorage.getItem("smart_edu_user");
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

async function loadUserGamification() {
    const student = getStoredStudent();
    const userXpDisplay = document.getElementById("userXpDisplay");
    const userLevelBadge = document.getElementById("userLevelBadge");
    const userBadgesList = document.getElementById("userBadgesList");

    if (!student) {
        if (userXpDisplay) userXpDisplay.textContent = "0 XP";
        if (userLevelBadge) userLevelBadge.textContent = "Level 1";
        return;
    }

    try {
        const res = await fetch(`/api/profile/${student.id}`);
        if (res.ok) {
            const profile = await res.json();
            if (userXpDisplay) userXpDisplay.textContent = `${profile.xp || 0} XP`;
            if (userLevelBadge) userLevelBadge.textContent = `Level ${profile.level || 1}`;
            
            if (userBadgesList && Array.isArray(profile.badges)) {
                userBadgesList.innerHTML = profile.badges.map(b => 
                    `<span class="badge-tag badge-cs" style="font-size:12px; padding: 4px 10px;">${escapeHtml(b)}</span>`
                ).join(" ");
            }
        } else {
            // Fallback to localStorage data
            if (userXpDisplay) userXpDisplay.textContent = `${student.xp || 0} XP`;
            if (userLevelBadge) userLevelBadge.textContent = `Level ${student.level || 1}`;
            if (userBadgesList && Array.isArray(student.badges)) {
                userBadgesList.innerHTML = student.badges.map(b => 
                    `<span class="badge-tag badge-cs" style="font-size:12px; padding: 4px 10px;">${escapeHtml(b)}</span>`
                ).join(" ");
            }
        }
    } catch (e) {
        console.error("Failed to load user gamification data:", e);
        if (userXpDisplay) userXpDisplay.textContent = `${student.xp || 0} XP`;
        if (userLevelBadge) userLevelBadge.textContent = `Level ${student.level || 1}`;
    }
}

async function loadLeaderboard() {
    const tbody = document.getElementById("leaderboardBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">Loading top scholars...</td></tr>`;

    try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error("Leaderboard API failed");

        const scholars = await res.json();
        const currentStudent = getStoredStudent();

        if (!scholars || scholars.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">No scholars registered on leaderboard yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = scholars.map((s, idx) => {
            const rank = idx + 1;
            let rankBadge = `${rank}`;
            if (rank === 1) rankBadge = "🥇 1st";
            else if (rank === 2) rankBadge = "🥈 2nd";
            else if (rank === 3) rankBadge = "🥉 3rd";

            const isSelf = currentStudent && String(currentStudent.id) === String(s.id);
            const rowStyle = isSelf ? `style="background: rgba(96, 165, 250, 0.15); font-weight: bold;"` : "";

            return `
                <tr ${rowStyle}>
                    <td style="font-weight: 700; color: ${rank <= 3 ? '#fbbf24' : '#cbd5e1'};">${rankBadge}</td>
                    <td>
                        ${escapeHtml(s.name)} 
                        ${isSelf ? '<span class="badge-tag badge-cs" style="font-size: 10px; margin-left: 6px;">You</span>' : ''}
                    </td>
                    <td>Level ${s.level}</td>
                    <td style="color: #60a5fa; font-weight: 700;">${s.xp} XP</td>
                    <td>🏅 ${s.badgeCount} Badges</td>
                </tr>
            `;
        }).join("");
    } catch (e) {
        console.error("Leaderboard loading error:", e);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#f87171;">Failed to load leaderboard.</td></tr>`;
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

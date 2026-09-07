// ==========================================================================
// SMART EDUCATION AI - AI NOTES WORKSPACE & LIBRARY
// ==========================================================================

const API_URL = "";

let savedNotes = [];
let activeNote = null; // { id, title, subject, topic, language, noteType, difficulty, length, content }
let isEditMode = false;

// Authenticated Student Check
function getCurrentStudent() {
    try {
        const studentStr = localStorage.getItem("student");
        if (studentStr) return JSON.parse(studentStr);
        const userStr = localStorage.getItem("currentUser");
        if (userStr) return JSON.parse(userStr);
    } catch (e) {
        console.error("Error reading student data:", e);
    }
    alert("Please log in first to access your AI Notes Workspace.");
    window.location.href = "login.html";
    return null;
}

// --------------------------------------------------------------------------
// 1. SAFE XSS-FREE MARKDOWN PARSER
// --------------------------------------------------------------------------

function escapeHTML(str) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function renderMarkdown(md) {
    if (!md) return "";

    // Escape raw HTML first to prevent XSS
    let html = escapeHTML(md);

    // Code Blocks ```code```
    html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
        return `<pre><code>${p1.trim()}</code></pre>`;
    });

    // Inline Code `code`
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Blockquotes > text
    html = html.replace(/^&gt;\s?(.*$)/gim, "<blockquote>$1</blockquote>");

    // Headings #, ##, ###
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // Bold & Italic
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Bullet Lists (- item or * item)
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/gms, "<ul>$1</ul>");
    html = html.replace(/<\/ul>\s*<ul>/g, "");

    // Numbered Lists (1. item)
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, "<ol><li>$1</li></ol>");
    html = html.replace(/<\/ol>\s*<ol>/g, "");

    // Paragraphs (double line breaks)
    const paragraphs = html.split(/\n\s*\n/);
    html = paragraphs.map(p => {
        p = p.trim();
        if (p.startsWith("<h") || p.startsWith("<pre") || p.startsWith("<ul") || p.startsWith("<ol") || p.startsWith("<blockquote")) {
            return p;
        }
        return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    }).join("");

    return html;
}

// --------------------------------------------------------------------------
// 2. AI NOTE GENERATION
// --------------------------------------------------------------------------

async function generateNotes(event) {
    if (event) event.preventDefault();

    const student = getCurrentStudent();
    if (!student) return;

    const subject = document.getElementById("noteSubject")?.value || "General";
    const topic = (document.getElementById("noteTopic")?.value || "").trim();
    const language = document.getElementById("noteLanguage")?.value || "English";
    const noteType = document.getElementById("noteType")?.value || "Detailed Notes";
    const difficulty = document.getElementById("noteDifficulty")?.value || "Intermediate";
    const length = document.getElementById("noteLength")?.value || "Medium";

    if (!topic) {
        alert("Please enter a study topic.");
        return;
    }

    const genBtn = document.getElementById("generateBtn");
    const displayArea = document.getElementById("noteDisplayArea");
    const toolbar = document.getElementById("noteActionsToolbar");

    if (genBtn) {
        genBtn.disabled = true;
        genBtn.innerHTML = `⏳ AI is generating study notes...`;
    }

    if (displayArea) {
        displayArea.innerHTML = `
            <div class="skeleton-loader">
                <div style="font-size: 16px; font-weight: 700; color: var(--accent-indigo); margin-bottom: 10px;">✨ Generating "${escapeHTML(topic)}" study material...</div>
                <div class="skeleton-line" style="width: 60%;"></div>
                <div class="skeleton-line" style="width: 90%;"></div>
                <div class="skeleton-line" style="width: 80%;"></div>
                <div class="skeleton-line" style="width: 95%;"></div>
                <div class="skeleton-line" style="width: 70%;"></div>
            </div>
        `;
    }

    try {
        const response = await fetch("/api/ai/generate-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject, topic, language, noteType, difficulty, length })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to generate notes. Please try again.");
        }

        activeNote = {
            id: null,
            title: data.title || topic,
            subject: data.subject || subject,
            topic: topic,
            language: data.language || language,
            noteType: data.noteType || noteType,
            difficulty: data.difficulty || difficulty,
            length: data.length || length,
            content: data.noteContent || ""
        };

        renderActiveNote();

        if (toolbar) toolbar.style.display = "flex";
        const deleteBtn = document.getElementById("deleteActiveBtn");
        if (deleteBtn) deleteBtn.style.display = "none";

        const saveBtn = document.getElementById("saveNoteBtn");
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = "💾 Save to Library";
        }
    } catch (error) {
        console.error("AI Note Generation Error:", error);
        if (displayArea) {
            displayArea.innerHTML = `
                <div style="padding: 30px; text-align: center; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 14px;">
                    <h3 style="color: #fca5a5; margin-bottom: 10px;">Unable to Generate Notes</h3>
                    <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 16px;">${escapeHTML(error.message)}</p>
                    <button onclick="generateNotes()" class="btn-primary" style="padding: 8px 18px; font-size: 13px;">🔄 Try Again</button>
                </div>
            `;
        }
    } finally {
        if (genBtn) {
            genBtn.disabled = false;
            genBtn.innerHTML = `✨ Generate AI Notes`;
        }
    }
}

function renderActiveNote() {
    const displayArea = document.getElementById("noteDisplayArea");
    const editTextarea = document.getElementById("noteEditTextarea");

    if (!activeNote || !displayArea) return;

    displayArea.style.display = isEditMode ? "none" : "block";
    if (editTextarea) {
        editTextarea.style.display = isEditMode ? "block" : "none";
        editTextarea.value = activeNote.content;
    }

    if (!isEditMode) {
        displayArea.innerHTML = renderMarkdown(activeNote.content);
    }
}

// --------------------------------------------------------------------------
// 3. NOTE ACTIONS (SAVE, EDIT, COPY, REGENERATE, PRINT, DELETE)
// --------------------------------------------------------------------------

async function saveActiveNote() {
    const student = getCurrentStudent();
    if (!student || !activeNote) return;

    if (isEditMode) {
        const editTextarea = document.getElementById("noteEditTextarea");
        if (editTextarea) activeNote.content = editTextarea.value;
    }

    const saveBtn = document.getElementById("saveNoteBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = "⏳ Saving...";
    }

    try {
        if (activeNote.id) {
            // Update existing note
            const response = await fetch(`${API_URL}/api/notes/${activeNote.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": String(student.id)
                },
                body: JSON.stringify({
                    studentId: student.id,
                    title: activeNote.title,
                    subject: activeNote.subject,
                    topic: activeNote.topic,
                    language: activeNote.language,
                    noteType: activeNote.noteType,
                    difficulty: activeNote.difficulty,
                    length: activeNote.length,
                    content: activeNote.content
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to update note.");
            }
        } else {
            // Create new saved note
            const response = await fetch(`${API_URL}/api/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: student.id,
                    title: activeNote.title,
                    subject: activeNote.subject,
                    category: activeNote.subject,
                    topic: activeNote.topic,
                    language: activeNote.language,
                    noteType: activeNote.noteType,
                    difficulty: activeNote.difficulty,
                    length: activeNote.length,
                    content: activeNote.content
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to save note.");

            if (data.note && data.note.id) {
                activeNote.id = data.note.id;
            }
        }

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = "Saved ✓";
            setTimeout(() => { saveBtn.innerHTML = "💾 Save to Library"; }, 2500);
        }

        const deleteBtn = document.getElementById("deleteActiveBtn");
        if (deleteBtn) deleteBtn.style.display = "inline-flex";

        await loadNotes();
    } catch (error) {
        console.error("Save Note Error:", error);
        alert(error.message || "Failed to save note.");
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = "💾 Save to Library";
        }
    }
}

function copyNoteContent() {
    if (!activeNote || !activeNote.content) return;

    let contentToCopy = activeNote.content;
    if (isEditMode) {
        const editTextarea = document.getElementById("noteEditTextarea");
        if (editTextarea) contentToCopy = editTextarea.value;
    }

    navigator.clipboard.writeText(contentToCopy).then(() => {
        const btn = event?.currentTarget;
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = "Copied! ✓";
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        }
    }).catch(err => {
        console.error("Clipboard copy error:", err);
        alert("Failed to copy content.");
    });
}

function toggleEditMode() {
    if (!activeNote) return;

    isEditMode = !isEditMode;
    const editBtn = document.getElementById("editToggleBtn");

    if (isEditMode) {
        if (editBtn) editBtn.innerHTML = "👁️ Preview";
    } else {
        const editTextarea = document.getElementById("noteEditTextarea");
        if (editTextarea) activeNote.content = editTextarea.value;
        if (editBtn) editBtn.innerHTML = "✏️ Edit";
    }

    renderActiveNote();
}

function regenerateActiveNote() {
    if (!activeNote) return;

    const topicInput = document.getElementById("noteTopic");
    const subjectSelect = document.getElementById("noteSubject");
    const langSelect = document.getElementById("noteLanguage");
    const typeSelect = document.getElementById("noteType");

    if (topicInput) topicInput.value = activeNote.topic || activeNote.title;
    if (subjectSelect && activeNote.subject) subjectSelect.value = activeNote.subject;
    if (langSelect && activeNote.language) langSelect.value = activeNote.language;
    if (typeSelect && activeNote.noteType) typeSelect.value = activeNote.noteType;

    generateNotes();
}

async function deleteActiveNote() {
    if (!activeNote || !activeNote.id) return;
    deleteSavedNote(activeNote.id);
}

// --------------------------------------------------------------------------
// 4. SAVED NOTES LIBRARY (LOAD, FILTER, SORT, DELETE, OPEN)
// --------------------------------------------------------------------------

async function loadNotes() {
    const student = getCurrentStudent();
    if (!student) return;

    try {
        const response = await fetch(`${API_URL}/api/notes/${student.id}`);
        const data = await response.json().catch(() => ([]));

        if (!response.ok) {
            console.error("Load Notes Error:", data.error);
            savedNotes = [];
        } else {
            savedNotes = Array.isArray(data) ? data : [];
        }

        filterNotes();
    } catch (error) {
        console.error("Load Notes Exception:", error);
        savedNotes = [];
        filterNotes();
    }
}

function filterNotes() {
    const searchVal = (document.getElementById("noteSearchInput")?.value || "").toLowerCase().trim();
    const subjectVal = document.getElementById("subjectFilter")?.value || "ALL";
    const typeVal = document.getElementById("typeFilter")?.value || "ALL";
    const langVal = document.getElementById("langFilter")?.value || "ALL";
    const sortVal = document.getElementById("sortSelect")?.value || "NEWEST";

    let filtered = savedNotes.filter(n => {
        const titleMatch = (n.title || "").toLowerCase().includes(searchVal);
        const topicMatch = (n.topic || "").toLowerCase().includes(searchVal);
        const subjectMatch = (n.subject || n.category || "").toLowerCase().includes(searchVal);
        const contentMatch = (n.content || "").toLowerCase().includes(searchVal);

        const matchesSearch = !searchVal || titleMatch || topicMatch || subjectMatch || contentMatch;
        const matchesSubject = subjectVal === "ALL" || (n.subject || n.category || "General") === subjectVal;
        const matchesType = typeVal === "ALL" || (n.noteType || "Detailed Notes") === typeVal;
        const matchesLang = langVal === "ALL" || (n.language || "English") === langVal;

        return matchesSearch && matchesSubject && matchesType && matchesLang;
    });

    // Sorting
    filtered.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || a.id || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || b.id || 0).getTime();

        if (sortVal === "OLDEST") return timeA - timeB;
        if (sortVal === "UPDATED") return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        return timeB - timeA; // NEWEST default
    });

    displayNotes(filtered);
}

function displayNotes(noteList) {
    const container = document.getElementById("notesContainer");
    const countEl = document.getElementById("savedNotesCount");

    if (countEl) {
        countEl.innerText = `${noteList.length} Saved Note${noteList.length === 1 ? "" : "s"}`;
    }

    if (!container) return;
    container.innerHTML = "";

    if (!noteList || noteList.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card" style="grid-column: 1 / -1; padding: 40px; text-align: center; background: rgba(15,23,42,0.6); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 32px; margin-bottom: 10px;">📝</div>
                <h4 style="font-size: 18px; color: #ffffff; margin-bottom: 6px;">No Saved Notes Found</h4>
                <p style="color: #94a3b8; font-size: 14px; max-width: 460px; margin: 0 auto 16px;">No study notes match your current search or filter criteria. Enter a topic in the AI Note Generator above to create personalized revision material!</p>
            </div>
        `;
        return;
    }

    noteList.forEach(note => {
        const card = document.createElement("div");
        card.className = "note-card glass-card";
        card.style.cssText = "padding: 22px; display: flex; flex-direction: column; justify-content: space-between;";

        const subject = note.subject || note.category || "General";
        const noteType = note.noteType || "Detailed Notes";
        const language = note.language || "English";
        const formattedDate = note.date || (note.createdAt ? new Date(note.createdAt).toLocaleDateString() : "Saved");

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 6px;">
                    <span class="badge-tag badge-cs">${escapeHTML(subject)}</span>
                    <span style="font-size: 11px; background: rgba(255,255,255,0.08); color: #cbd5e1; padding: 2px 8px; border-radius: 10px;">${escapeHTML(noteType)} • ${escapeHTML(language)}</span>
                </div>
                <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 17px; font-weight: 700; line-height: 1.4;">${escapeHTML(note.title)}</h3>
                <p style="color: #cbd5e1; font-size: 13px; line-height: 1.6; margin-bottom: 20px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${escapeHTML((note.content || "").replace(/[#*`>]/g, ""))}</p>
            </div>
            <div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 12px;">Saved on ${formattedDate}</div>
                <div style="display: flex; gap: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
                    <button onclick="openSavedNote('${note.id}')" style="flex: 1; background: var(--primary-gradient); color: #ffffff; border: none; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">📖 Open Note</button>
                    <button onclick="deleteSavedNote('${note.id}')" style="background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">🗑️</button>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function openSavedNote(id) {
    const note = savedNotes.find(n => String(n.id) === String(id));
    if (!note) return;

    activeNote = { ...note };
    isEditMode = false;

    renderActiveNote();

    const toolbar = document.getElementById("noteActionsToolbar");
    if (toolbar) toolbar.style.display = "flex";

    const deleteBtn = document.getElementById("deleteActiveBtn");
    if (deleteBtn) deleteBtn.style.display = "inline-flex";

    const editBtn = document.getElementById("editToggleBtn");
    if (editBtn) editBtn.innerHTML = "✏️ Edit";

    window.scrollTo({ top: 100, behavior: "smooth" });
}

async function deleteSavedNote(id) {
    const student = getCurrentStudent();
    if (!student) return;

    if (!confirm("Are you sure you want to delete this study note? This action cannot be undone.")) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/notes/${id}`, {
            method: "DELETE",
            headers: {
                "x-user-id": String(student.id)
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to delete note.");
        }

        if (activeNote && String(activeNote.id) === String(id)) {
            activeNote = null;
            const displayArea = document.getElementById("noteDisplayArea");
            const toolbar = document.getElementById("noteActionsToolbar");
            if (toolbar) toolbar.style.display = "none";
            if (displayArea) {
                displayArea.innerHTML = `
                    <div class="empty-state-card" style="text-align: center; padding: 60px 20px; background: transparent;">
                        <h3 style="font-size: 20px; margin-bottom: 8px; color: #ffffff;">Note Deleted</h3>
                        <p style="color: var(--text-muted); font-size: 14px;">Select another note from your library or generate a new one.</p>
                    </div>
                `;
            }
        }

        await loadNotes();
    } catch (error) {
        console.error("Delete Note Error:", error);
        alert(error.message || "Failed to delete note.");
    }
}

// Global Exports
window.generateNotes = generateNotes;
window.saveActiveNote = saveActiveNote;
window.copyNoteContent = copyNoteContent;
window.toggleEditMode = toggleEditMode;
window.regenerateActiveNote = regenerateActiveNote;
window.deleteActiveNote = deleteActiveNote;
window.openSavedNote = openSavedNote;
window.deleteSavedNote = deleteSavedNote;
window.filterNotes = filterNotes;

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("aiNotesForm");
    if (form) form.addEventListener("submit", generateNotes);
    loadNotes();
});
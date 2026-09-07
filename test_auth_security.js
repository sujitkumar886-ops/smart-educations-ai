const http = require("http");

const BASE_URL = "http://localhost:3000";

function makeRequest(path, options = {}, bodyData = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const reqOpts = {
            method: options.method || "GET",
            headers: options.headers || {}
        };

        if (bodyData) {
            if (typeof bodyData === "object") {
                reqOpts.headers["Content-Type"] = "application/json";
                bodyData = JSON.stringify(bodyData);
            }
            reqOpts.headers["Content-Length"] = Buffer.byteLength(bodyData);
        }

        const req = http.request(url, reqOpts, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: parsed,
                    raw: data
                });
            });
        });

        req.on("error", reject);
        if (bodyData) req.write(bodyData);
        req.end();
    });
}

async function runTestMatrix() {
    console.log("==================================================");
    console.log("🛡️ RUNNING SMART EDUCATION AI AUTH SECURITY MATRIX");
    console.log("==================================================\n");

    let passCount = 0;
    let failCount = 0;

    function recordResult(testName, isPass, detail = "") {
        if (isPass) {
            console.log(`[PASS] ${testName} ${detail ? '- ' + detail : ''}`);
            passCount++;
        } else {
            console.log(`[FAIL] ❌ ${testName} ${detail ? '- ' + detail : ''}`);
            failCount++;
        }
    }

    try {
        // TEST A: Open index.html while logged out
        const resA = await makeRequest("/index.html");
        recordResult("TEST A: index.html public access", resA.status === 200 && resA.raw.includes("Smart Education AI"));

        // TEST B: Open login.html while logged out
        const resB = await makeRequest("/login.html");
        recordResult("TEST B: login.html public access", resB.status === 200 && resB.raw.includes("Login"));

        // TEST C: Open register.html while logged out
        const resC = await makeRequest("/register.html");
        recordResult("TEST C: register.html public access", resC.status === 200 && (resC.raw.includes("Create Free Account") || resC.raw.includes("registerForm")));

        // TEST D: Open dashboard.html header and cache check
        const resD = await makeRequest("/dashboard.html");
        const hasAuthGuardD = resD.raw.includes("auth-guard.js");
        const cacheControlD = resD.headers["cache-control"] || "";
        recordResult("TEST D: dashboard.html protected with auth-guard & no-store cache", 
            resD.status === 200 && hasAuthGuardD && cacheControlD.includes("no-store"), 
            `Cache-Control: ${cacheControlD}`);

        // TEST E: Open AI Tutor while logged out
        const resE = await makeRequest("/ai-tutor.html");
        recordResult("TEST E: ai-tutor.html protected with auth-guard", resE.raw.includes("auth-guard.js"));

        // TEST F: Open PDF Study AI while logged out
        const resF = await makeRequest("/pdf-study.html");
        recordResult("TEST F: pdf-study.html protected with auth-guard", resF.raw.includes("auth-guard.js"));

        // TEST G: Open Image Solver while logged out
        const resG = await makeRequest("/image-solver.html");
        recordResult("TEST G: image-solver.html protected with auth-guard", resG.raw.includes("auth-guard.js"));

        // TEST H: Open Notes while logged out
        const resH = await makeRequest("/notes.html");
        recordResult("TEST H: notes.html protected with auth-guard", resH.raw.includes("auth-guard.js"));

        // TEST I: Open Quiz while logged out
        const resI = await makeRequest("/quiz.html");
        recordResult("TEST I: quiz.html protected with auth-guard", resI.raw.includes("auth-guard.js"));

        // TEST J: Open Planner while logged out
        const resJ = await makeRequest("/study-planner.html");
        recordResult("TEST J: study-planner.html protected with auth-guard", resJ.raw.includes("auth-guard.js"));

        // TEST K: Open Profile while logged out
        const resK = await makeRequest("/profile.html");
        recordResult("TEST K: profile.html protected with auth-guard", resK.raw.includes("auth-guard.js"));

        // TEST L: Open Admin Panel while logged out
        const resL = await makeRequest("/admin-dashboard.html");
        recordResult("TEST L: admin-dashboard.html protected with auth-guard", resL.raw.includes("auth-guard.js"));

        // TEST M: Call private API while logged out
        const resM1 = await makeRequest("/api/auth/me");
        const resM2 = await makeRequest("/api/notes/test_user");
        const resM3 = await makeRequest("/api/pdf/list/test_user");
        recordResult("TEST M: Private APIs return 401 Unauthorized when logged out", 
            resM1.status === 401 && resM2.status === 401 && resM3.status === 401, 
            `Status: ${resM1.status}, ${resM2.status}, ${resM3.status}`);

        // Register Test Student & Admin
        const studentEmail = `sec_test_student_${Date.now()}@smartedu.ai`;
        const regRes = await makeRequest("/api/register", { method: "POST" }, {
            name: "Security Student",
            email: studentEmail,
            password: "StudentPassword123!",
            role: "student"
        });
        const studentUser = regRes.data.student;

        // Login as student
        const loginRes = await makeRequest("/api/login", { method: "POST" }, {
            email: studentEmail,
            password: "StudentPassword123!"
        });
        recordResult("TEST N: Login as student works", loginRes.status === 200 && loginRes.data.student && loginRes.data.student.role === "student");

        // TEST O & P: Student calls admin API
        const resP = await makeRequest("/api/admin/users", {
            headers: { "x-user-id": studentUser.id }
        });
        recordResult("TEST P: Student calling Admin API returns 403 Forbidden", resP.status === 403, `Status: ${resP.status}`);

        // Login as Admin using bootstrapped admin
        const adminLoginRes = await makeRequest("/api/login", { method: "POST" }, {
            email: "admin@smartedu.ai",
            password: "AdminPassword123!"
        });
        const adminUser = adminLoginRes.data.student;
        recordResult("TEST Q: Login as admin works", adminLoginRes.status === 200 && adminUser && adminUser.role === "admin");

        // TEST R: Admin calls admin API
        const resR = await makeRequest("/api/admin/users", {
            headers: { "x-user-id": adminUser.id }
        });
        recordResult("TEST R: Admin calling Admin API succeeds", resR.status === 200 && Array.isArray(resR.data));

        // TEST S: Logout endpoint
        const resS = await makeRequest("/api/auth/logout", { method: "POST" });
        recordResult("TEST S: Logout endpoint succeeds", resS.status === 200 && resS.data.ok);

        // TEST T: Back/Forward Cache Control header check
        const resT = await makeRequest("/dashboard.html");
        recordResult("TEST T: Cache-Control: no-store header present on protected pages", 
            (resT.headers["cache-control"] || "").includes("no-store"));

        // TEST U: Client tampering test - sending unauthorized x-user-id header with fake admin role
        const resU = await makeRequest("/api/admin/stats", {
            headers: { "x-user-id": studentUser.id } // student trying to access admin endpoint
        });
        recordResult("TEST U: Tampered client request to Admin API denied", resU.status === 403);

        // TEST V: User Data Isolation - Student A attempting to access Student B's data
        const studentBEmail = `sec_test_b_${Date.now()}@smartedu.ai`;
        const regBRes = await makeRequest("/api/register", { method: "POST" }, {
            name: "Student B",
            email: studentBEmail,
            password: "StudentBPassword123!",
            role: "student"
        });
        const studentB = regBRes.data.student;

        // Student A requests Student B's notes
        const resV1 = await makeRequest(`/api/notes/${studentB.id}`, {
            headers: { "x-user-id": studentUser.id }
        });

        // Student A requests Student B's profile
        const resV2 = await makeRequest(`/api/profile/${studentB.id}`, {
            headers: { "x-user-id": studentUser.id }
        });

        recordResult("TEST V: Accessing another user's private data returns 403 Access Denied", 
            resV1.status === 403 && resV2.status === 403, 
            `Notes Status: ${resV1.status}, Profile Status: ${resV2.status}`);

    } catch (err) {
        console.error("Test execution error:", err);
    }

    console.log("\n==================================================");
    console.log(`RESULTS SUMMARY: PASS = ${passCount} | FAIL = ${failCount}`);
    console.log("==================================================");
}

runTestMatrix();

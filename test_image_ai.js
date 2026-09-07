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

async function runImageSolverTests() {
    console.log("==================================================");
    console.log("🖼️ RUNNING AI IMAGE QUESTION SOLVER VERIFICATION SUITE");
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
        // Register Test Student A & B
        const emailA = `img_test_a_${Date.now()}@smartedu.ai`;
        const emailB = `img_test_b_${Date.now()}@smartedu.ai`;

        const regA = await makeRequest("/api/register", { method: "POST" }, {
            name: "Image Student A",
            email: emailA,
            password: "Password123!",
            role: "student"
        });
        const studentA = regA.data.student;

        const regB = await makeRequest("/api/register", { method: "POST" }, {
            name: "Image Student B",
            email: emailB,
            password: "Password123!",
            role: "student"
        });
        const studentB = regB.data.student;

        // 1. Unauthenticated Security Denial Test
        const unauthRes = await makeRequest("/api/image-solver/analyze", { method: "POST" }, {
            questionText: "Solve x^2 + 5x + 6 = 0"
        });
        recordResult("1. Unauthenticated Image Analysis returns 401 Unauthorized", unauthRes.status === 401);

        // 2. Empty Input Validation Test
        const emptyRes = await makeRequest("/api/image-solver/analyze", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id
        });
        recordResult("2. Empty request rejected with 400 Bad Request", emptyRes.status === 400);

        // 3. Valid Image & Question Solver Test
        // Synthetic 1x1 red PNG base64 data
        const sampleImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

        const analyzeRes = await makeRequest("/api/image-solver/analyze", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            imageBase64: sampleImageBase64,
            questionText: "Find the roots of quadratic equation: f(x) = x^2 - 7x + 12",
            language: "Hinglish",
            subjectOverride: "Mathematics",
            mode: "Step-by-Step"
        });

        const record = analyzeRes.data.solutionRecord;
        const validSol = analyzeRes.status === 201 && record && record.solutionData && record.solutionData.solutionModes;
        recordResult("3. Image Analysis & Vision Solution succeeds", validSol, `Detected Subject: ${record?.subject}`);

        // 4. Grounded Follow-up AI Chat Test
        const followupRes = await makeRequest("/api/image-solver/followup", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            solutionId: record.id,
            question: "Why did you split -7x into -3x and -4x in step 2?"
        });
        recordResult("4. Grounded Follow-up Chat returns solution context explanation", followupRes.status === 200 && followupRes.data.answer);

        // 5. User History Listing & Data Isolation Test
        const historyA = await makeRequest(`/api/image-solver/history/${studentA.id}`, {
            headers: { "x-user-id": studentA.id }
        });
        recordResult("5. Student A fetches own solved history", historyA.status === 200 && Array.isArray(historyA.data) && historyA.data.length >= 1);

        const historyB_Tampered = await makeRequest(`/api/image-solver/history/${studentA.id}`, {
            headers: { "x-user-id": studentB.id }
        });
        recordResult("6. User Data Isolation: Student B blocked from viewing Student A's history", historyB_Tampered.status === 403);

        // 7. Solution Deletion Test
        const delRes = await makeRequest(`/api/image-solver/${studentA.id}/${record.id}`, {
            method: "DELETE",
            headers: { "x-user-id": studentA.id }
        });
        recordResult("7. Student A deletes own solved question record", delRes.status === 200);

    } catch (err) {
        console.error("Test error:", err);
    }

    console.log("\n==================================================");
    console.log(`RESULTS SUMMARY: PASS = ${passCount} | FAIL = ${failCount}`);
    console.log("==================================================");
}

runImageSolverTests();

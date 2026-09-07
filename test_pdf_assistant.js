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

async function runPDFTests() {
    console.log("==================================================");
    console.log("📄 RUNNING PDF → AI STUDY ASSISTANT VERIFICATION SUITE");
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
        const emailA = `pdf_test_a_${Date.now()}@smartedu.ai`;
        const emailB = `pdf_test_b_${Date.now()}@smartedu.ai`;

        const regA = await makeRequest("/api/register", { method: "POST" }, {
            name: "PDF Student A",
            email: emailA,
            password: "Password123!",
            role: "student"
        });
        const studentA = regA.data.student;

        const regB = await makeRequest("/api/register", { method: "POST" }, {
            name: "PDF Student B",
            email: emailB,
            password: "Password123!",
            role: "student"
        });
        const studentB = regB.data.student;

        // 1. Unauthenticated Security Denial Test
        const unauthRes = await makeRequest("/api/pdf/upload", { method: "POST" }, {
            filename: "test.pdf",
            fileData: "data:application/pdf;base64,JVBERi0xLjQ="
        });
        recordResult("1. Unauthenticated PDF Upload returns 401 Unauthorized", unauthRes.status === 401);

        // 2. Invalid File Extension Validation
        const invalidExtRes = await makeRequest("/api/pdf/upload", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            filename: "malicious_script.exe",
            fileData: "data:application/pdf;base64,JVBERi0xLjQ="
        });
        recordResult("2. Non-PDF file upload rejected with 400 Bad Request", invalidExtRes.status === 400);

        // 3. Valid PDF Upload Test
        // Construct a clean, valid sample text PDF base64 buffer with %PDF- header
        const samplePdfContent = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 250 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Data Structures and Algorithms Study Guide. Operating systems, trees, graphs, dynamic programming, sorting algorithms.) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000212 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n515\n%%EOF";
        const pdfBase64 = "data:application/pdf;base64," + Buffer.from(samplePdfContent).toString("base64");

        const uploadRes = await makeRequest("/api/pdf/upload", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            filename: "Data_Structures_Guide.pdf",
            fileData: pdfBase64
        });

        recordResult("3. Valid PDF Upload & Parsing succeeds", uploadRes.status === 201 && uploadRes.data.pdf);
        const uploadedPdf = uploadRes.data.pdf;

        // 4. PDF Process & Workspace Generation Test
        const processRes = await makeRequest("/api/pdf/process", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            pdfId: uploadedPdf.id
        });
        const studyData = processRes.data.studyData;
        recordResult("4. AI Study Workspace generation succeeds", processRes.status === 200 && studyData && studyData.summary && studyData.notes);

        // 5. Custom Summary Lengths & Languages Test
        const summaryRes = await makeRequest("/api/pdf/summary", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            pdfId: uploadedPdf.id,
            length: "Detailed",
            language: "Hinglish"
        });
        recordResult("5. Custom AI Summary (Detailed / Hinglish) succeeds", summaryRes.status === 200 && summaryRes.data.summary);

        // 6. Custom AI Notes Generation Test
        const notesRes = await makeRequest("/api/pdf/notes", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            pdfId: uploadedPdf.id,
            language: "Hindi"
        });
        recordResult("6. AI Notes Generation succeeds", notesRes.status === 200 && notesRes.data.notes);

        // 7. MCQ Quiz Generation & Schema Validation Test
        const quizRes = await makeRequest("/api/pdf/quiz", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            pdfId: uploadedPdf.id,
            numQuestions: 5,
            difficulty: "Hard",
            language: "English"
        });
        const quizValid = quizRes.status === 200 && Array.isArray(quizRes.data.questions) && quizRes.data.questions.every(q => {
            return q.question && Array.isArray(q.options) && q.options.length === 4 && typeof q.answer === "number" && q.explanation;
        });
        recordResult("7. MCQ Quiz Generation & Schema Validation succeeds", quizValid, `Questions generated: ${quizRes.data.questions?.length}`);

        // 8. Flashcards Generation Test
        const flashRes = await makeRequest("/api/pdf/flashcards", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            pdfId: uploadedPdf.id,
            count: 6,
            language: "English"
        });
        recordResult("8. Flashcards Generation succeeds", flashRes.status === 200 && Array.isArray(flashRes.data.flashcards) && flashRes.data.flashcards.length > 0);

        // 9. Grounded Ask PDF Chat Test
        const askRes = await makeRequest("/api/pdf/ask", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            pdfId: uploadedPdf.id,
            question: "What sorting algorithms or data structures are mentioned?"
        });
        recordResult("9. Grounded Ask PDF AI Chat returns answer & citation", askRes.status === 200 && askRes.data.answer && askRes.data.citation);

        // 10. Explain Simply Test
        const explainRes = await makeRequest("/api/pdf/explain-simply", {
            method: "POST",
            headers: { "x-user-id": studentA.id }
        }, {
            userId: studentA.id,
            pdfId: uploadedPdf.id,
            topic: "Dynamic Programming",
            language: "Hinglish"
        });
        recordResult("10. Explain Simply feature succeeds", explainRes.status === 200 && explainRes.data.explanation);

        // 11. PDF Library Listing & User Data Isolation Test
        const listA = await makeRequest(`/api/pdf/list/${studentA.id}`, {
            headers: { "x-user-id": studentA.id }
        });
        recordResult("11. Student A fetches own PDF library", listA.status === 200 && Array.isArray(listA.data) && listA.data.length >= 1);

        const listB_Tampered = await makeRequest(`/api/pdf/list/${studentA.id}`, {
            headers: { "x-user-id": studentB.id }
        });
        recordResult("12. User Data Isolation: Student B blocked from viewing Student A's library", listB_Tampered.status === 403);

        // 13. PDF Deletion Test
        const delRes = await makeRequest(`/api/pdf/${studentA.id}/${uploadedPdf.id}`, {
            method: "DELETE",
            headers: { "x-user-id": studentA.id }
        });
        recordResult("13. Student A deletes own PDF document", delRes.status === 200);

    } catch (err) {
        console.error("Test error:", err);
    }

    console.log("\n==================================================");
    console.log(`RESULTS SUMMARY: PASS = ${passCount} | FAIL = ${failCount}`);
    console.log("==================================================");
}

runPDFTests();

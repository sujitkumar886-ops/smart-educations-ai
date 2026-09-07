const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

const minimalPdfBase64 = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
).toString('base64');

async function runAITests() {
  console.log('=== STARTING PDF AI WORKSPACE & PIPELINE TESTS ===\n');

  try {
    // 1. Upload PDF
    console.log('1. Uploading test PDF...');
    const uploadRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/upload',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      filename: 'quantum_physics_chapter.pdf',
      fileData: minimalPdfBase64
    });

    if (uploadRes.status !== 201 || !uploadRes.body.pdf) {
      console.error('❌ Failed to upload initial test PDF:', uploadRes.body);
      return;
    }

    const testPdfId = uploadRes.body.pdf.id;
    console.log(`Uploaded Test PDF ID: ${testPdfId}`);

    // 2. Test Process PDF
    console.log('\n2. Testing POST /api/pdf/process...');
    const processRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/process',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      pdfId: testPdfId
    });

    console.log(`Status: ${processRes.status}`);
    if (processRes.status === 200 && processRes.body.studyData) {
      console.log('✅ PDF Process PASSED! Generated initial study workspace data.');
    } else {
      console.error('❌ PDF Process FAILED:', processRes.body);
    }

    // 3. Test Summary Generation (Hinglish, Detailed)
    console.log('\n3. Testing POST /api/pdf/summary (Hinglish)...');
    const summaryRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/summary',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      pdfId: testPdfId,
      length: 'Detailed',
      language: 'Hinglish'
    });

    console.log(`Status: ${summaryRes.status}`);
    if (summaryRes.status === 200 && summaryRes.body.summary) {
      console.log('✅ PDF Summary PASSED! Summary length:', summaryRes.body.summary.length);
    } else {
      console.error('❌ PDF Summary FAILED:', summaryRes.body);
    }

    // 4. Test AI Quiz Generation (Schema Validation)
    console.log('\n4. Testing POST /api/pdf/quiz (MCQ Quiz Generator)...');
    const quizRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/quiz',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      pdfId: testPdfId,
      numQuestions: 5,
      difficulty: 'Medium',
      language: 'English'
    });

    console.log(`Status: ${quizRes.status}`);
    if (quizRes.status === 200 && Array.isArray(quizRes.body.questions) && quizRes.body.questions.length > 0) {
      const firstQ = quizRes.body.questions[0];
      console.log(`✅ PDF Quiz PASSED! Generated ${quizRes.body.questions.length} MCQs with 4 options each.`);
      console.log(`Sample Question: "${firstQ.question}" (Options: ${firstQ.options.length})`);
    } else {
      console.error('❌ PDF Quiz FAILED:', quizRes.body);
    }

    // 5. Test Flashcard Generation
    console.log('\n5. Testing POST /api/pdf/flashcards...');
    const fcRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/flashcards',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      pdfId: testPdfId,
      count: 5,
      language: 'English'
    });

    console.log(`Status: ${fcRes.status}`);
    if (fcRes.status === 200 && Array.isArray(fcRes.body.flashcards)) {
      console.log(`✅ PDF Flashcards PASSED! Generated ${fcRes.body.flashcards.length} front/back cards.`);
    } else {
      console.error('❌ PDF Flashcards FAILED:', fcRes.body);
    }

    // 6. Test Grounded Ask PDF Chat
    console.log('\n6. Testing POST /api/pdf/ask (Grounded Q&A)...');
    const askRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/ask',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      pdfId: testPdfId,
      question: 'What is the main topic of this chapter?'
    });

    console.log(`Status: ${askRes.status}`);
    if (askRes.status === 200 && askRes.body.answer) {
      console.log('✅ Ask PDF Grounded Chat PASSED! Answer received.');
    } else {
      console.error('❌ Ask PDF Grounded Chat FAILED:', askRes.body);
    }

    // 7. Test Explain Simply
    console.log('\n7. Testing POST /api/pdf/explain-simply...');
    const explainRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/explain-simply',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      pdfId: testPdfId,
      topic: 'Quantum Wave-Particle Duality',
      language: 'English'
    });

    console.log(`Status: ${explainRes.status}`);
    if (explainRes.status === 200 && explainRes.body.explanation) {
      console.log('✅ Explain Simply PASSED!');
    } else {
      console.error('❌ Explain Simply FAILED:', explainRes.body);
    }

    console.log('\n=== ALL PDF AI WORKSPACE TESTS COMPLETED ===');
  } catch (err) {
    console.error('Unexpected error running AI tests:', err);
  }
}

runAITests();

const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING AI QUIZ ENDPOINT TESTS ===\n');
  let testQuizId = null;

  try {
    // 1. Test AI Quiz Generation
    console.log('1. Testing POST /api/ai/generate-quiz...');
    const genPayload = {
      subject: 'Physics',
      topic: 'Quantum Mechanics',
      difficulty: 'Medium',
      numQuestions: 3,
      language: 'English'
    };
    const genRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/ai/generate-quiz',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, genPayload);

    console.log(`Status: ${genRes.status}`);
    if (genRes.status === 200 && Array.isArray(genRes.body.questions)) {
      console.log(`✅ Quiz Generation PASSED! Generated ${genRes.body.questions.length} questions for ${genRes.body.topic}`);
    } else {
      console.error('❌ Quiz Generation FAILED:', genRes.body);
    }

    // 2. Test Saving Quiz Result (User A - Quiz 1)
    console.log('\n2. Testing POST /api/quizzes (Save Quiz 1 for test_user_a)...');
    const savePayload1 = {
      studentId: 'test_user_a',
      subject: 'Physics',
      topic: 'Quantum Mechanics',
      difficulty: 'Medium',
      numQuestions: 5,
      score: 40,
      percentage: 40,
      correctCount: 2,
      incorrectCount: 3,
      skippedCount: 0,
      timeTaken: 120,
      mode: 'Practice'
    };

    const saveRes1 = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/quizzes',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': 'test_user_a'
      }
    }, savePayload1);

    console.log(`Status: ${saveRes1.status}`);
    if (saveRes1.status === 201 && saveRes1.body.quizRecord) {
      testQuizId = saveRes1.body.quizRecord.id;
      console.log(`✅ Save Quiz 1 PASSED! Created Quiz ID: ${testQuizId}`);
    } else {
      console.error('❌ Save Quiz 1 FAILED:', saveRes1.body);
    }

    // Save Quiz 2 (for Weak Topic detection threshold >= 2 quizzes)
    console.log('\n2b. Testing POST /api/quizzes (Save Quiz 2 for test_user_a)...');
    const savePayload2 = {
      studentId: 'test_user_a',
      subject: 'Physics',
      topic: 'Quantum Mechanics',
      difficulty: 'Medium',
      numQuestions: 5,
      score: 50,
      percentage: 50,
      correctCount: 2,
      incorrectCount: 3,
      skippedCount: 0,
      timeTaken: 100,
      mode: 'Practice'
    };
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/quizzes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_user_a' }
    }, savePayload2);

    // 3. Test Fetching User A's Quizzes
    console.log('\n3. Testing GET /api/quizzes/test_user_a...');
    const getRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/quizzes/test_user_a',
      method: 'GET'
    });

    console.log(`Status: ${getRes.status}`);
    if (getRes.status === 200 && Array.isArray(getRes.body)) {
      console.log(`✅ Get Quizzes PASSED! Retreived ${getRes.body.length} quiz records for test_user_a`);
    } else {
      console.error('❌ Get Quizzes FAILED:', getRes.body);
    }

    // 4. Test Weak Topics Calculation (test_user_a accuracy on Quantum Mechanics is 45% < 65%)
    console.log('\n4. Testing GET /api/quizzes/weak-topics/test_user_a...');
    const weakRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/quizzes/weak-topics/test_user_a',
      method: 'GET'
    });

    console.log(`Status: ${weakRes.status}`);
    if (weakRes.status === 200 && weakRes.body.hasData && Array.isArray(weakRes.body.weakTopics)) {
      console.log(`✅ Weak Topics PASSED! Identified ${weakRes.body.weakTopics.length} weak topic(s):`, weakRes.body.weakTopics);
    } else {
      console.error('❌ Weak Topics FAILED:', weakRes.body);
    }

    // 5. Test Authorization / User Isolation on Deletion (User B attempt to delete User A quiz)
    if (testQuizId) {
      console.log('\n5. Testing DELETE /api/quizzes/:id Security (User B attempt to delete User A quiz)...');
      const unauthDeleteRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/quizzes/${testQuizId}`,
        method: 'DELETE',
        headers: { 'x-user-id': 'test_user_b' }
      });

      console.log(`Status: ${unauthDeleteRes.status}`);
      if (unauthDeleteRes.status === 403) {
        console.log('✅ Security Check PASSED! User B was denied deletion (403 Forbidden)');
      } else {
        console.error('❌ Security Check FAILED! Expected 403, got:', unauthDeleteRes.status, unauthDeleteRes.body);
      }

      // 6. Test Authorized Deletion (User A deleting their own quiz)
      console.log('\n6. Testing DELETE /api/quizzes/:id Authorized (User A deleting own quiz)...');
      const authDeleteRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/quizzes/${testQuizId}`,
        method: 'DELETE',
        headers: { 'x-user-id': 'test_user_a' }
      });

      console.log(`Status: ${authDeleteRes.status}`);
      if (authDeleteRes.status === 200 && authDeleteRes.body.message) {
        console.log('✅ Authorized Deletion PASSED! User A successfully deleted quiz record.');
      } else {
        console.error('❌ Authorized Deletion FAILED:', authDeleteRes.body);
      }
    }

    console.log('\n=== ALL QUIZ TESTS COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Unexpected error running tests:', err);
  }
}

runTests();

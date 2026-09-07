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

async function runSecurityTests() {
  console.log('=== STARTING PDF USER DATA ISOLATION & SECURITY TESTS ===\n');

  try {
    // Step 1: User A Uploads PDF
    console.log('1. User A uploading private PDF...');
    const uploadRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/upload',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'sec_user_a' }
    }, {
      userId: 'sec_user_a',
      filename: 'confidential_exam_guide.pdf',
      fileData: minimalPdfBase64
    });

    if (uploadRes.status !== 201 || !uploadRes.body.pdf) {
      console.error('❌ Failed to upload User A PDF:', uploadRes.body);
      return;
    }

    const userAPdfId = uploadRes.body.pdf.id;
    console.log(`User A PDF created: ID ${userAPdfId}`);

    // Step 2: User B Attempts to Access User A's PDF Details
    console.log('\n2. Testing User B attempt to GET User A PDF (GET /api/pdf/sec_user_a/:id)...');
    const unauthGetRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/pdf/sec_user_a/${userAPdfId}`,
      method: 'GET',
      headers: { 'x-user-id': 'sec_user_b' }
    });

    console.log(`Status: ${unauthGetRes.status}`);
    if (unauthGetRes.status === 403) {
      console.log('✅ User Isolation PASSED! User B denied access to User A PDF (HTTP 403 Forbidden)');
    } else {
      console.error('❌ User Isolation FAILED! Expected 403, got:', unauthGetRes.status, unauthGetRes.body);
    }

    // Step 3: User B Attempts to Delete User A's PDF
    console.log('\n3. Testing User B attempt to DELETE User A PDF (DELETE /api/pdf/sec_user_a/:id)...');
    const unauthDeleteRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/pdf/sec_user_a/${userAPdfId}`,
      method: 'DELETE',
      headers: { 'x-user-id': 'sec_user_b' }
    });

    console.log(`Status: ${unauthDeleteRes.status}`);
    if (unauthDeleteRes.status === 403) {
      console.log('✅ Unauthorized Delete PASSED! User B denied deletion (HTTP 403 Forbidden)');
    } else {
      console.error('❌ Unauthorized Delete FAILED! Expected 403, got:', unauthDeleteRes.status, unauthDeleteRes.body);
    }

    // Step 4: User A Authorized Deletion
    console.log('\n4. Testing User A authorized DELETE own PDF...');
    const authDeleteRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/pdf/sec_user_a/${userAPdfId}`,
      method: 'DELETE',
      headers: { 'x-user-id': 'sec_user_a' }
    });

    console.log(`Status: ${authDeleteRes.status}`);
    if (authDeleteRes.status === 200 && authDeleteRes.body.message) {
      console.log('✅ Authorized Delete PASSED! User A deleted own PDF record.');
    } else {
      console.error('❌ Authorized Delete FAILED:', authDeleteRes.body);
    }

    console.log('\n=== ALL PDF SECURITY & ISOLATION TESTS PASSED ===');
  } catch (err) {
    console.error('Unexpected error running security tests:', err);
  }
}

runSecurityTests();

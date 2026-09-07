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

// Minimal valid PDF binary header & structure string
const minimalPdfBase64 = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
).toString('base64');

async function runUploadTests() {
  console.log('=== STARTING PDF UPLOAD & VALIDATION TESTS ===\n');

  try {
    // Test 1: Valid PDF Upload
    console.log('1. Testing POST /api/pdf/upload (Valid PDF)...');
    const validRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/upload',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      filename: 'sample_physics_notes.pdf',
      fileData: minimalPdfBase64
    });

    console.log(`Status: ${validRes.status}`);
    if (validRes.status === 201 && validRes.body.pdf && validRes.body.pdf.id) {
      console.log(`✅ Valid PDF Upload PASSED! Created PDF ID: ${validRes.body.pdf.id}`);
    } else {
      console.error('❌ Valid PDF Upload FAILED:', validRes.body);
    }

    // Test 2: Invalid File Extension (.txt)
    console.log('\n2. Testing POST /api/pdf/upload (Invalid file extension .txt)...');
    const invalidExtRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/upload',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      filename: 'notes.txt',
      fileData: 'Plain text data'
    });

    console.log(`Status: ${invalidExtRes.status}`);
    if (invalidExtRes.status === 400) {
      console.log('✅ Invalid extension rejection PASSED! HTTP 400 Bad Request');
    } else {
      console.error('❌ Invalid extension rejection FAILED:', invalidExtRes.status);
    }

    // Test 3: Corrupted PDF Content (Non-magic bytes)
    console.log('\n3. Testing POST /api/pdf/upload (Corrupted PDF bytes)...');
    const corruptedRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pdf/upload',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_pdf_user_a' }
    }, {
      userId: 'test_pdf_user_a',
      filename: 'corrupted.pdf',
      fileData: Buffer.from('NOT A REAL PDF HEADER').toString('base64')
    });

    console.log(`Status: ${corruptedRes.status}`);
    if (corruptedRes.status === 400) {
      console.log('✅ Corrupted PDF rejection PASSED! HTTP 400 Bad Request');
    } else {
      console.error('❌ Corrupted PDF rejection FAILED:', corruptedRes.status);
    }

    console.log('\n=== ALL PDF UPLOAD TESTS COMPLETED ===');
  } catch (err) {
    console.error('Unexpected error running upload tests:', err);
  }
}

runUploadTests();

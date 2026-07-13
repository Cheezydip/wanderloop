import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.NVIDIA_API_KEY;
const baseUrl = process.env.NIM_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';

const modelsToTest = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-4-340b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1',
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-mini-4b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct'
];

async function testModel(model) {
  const start = Date.now();
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say "Hello" and nothing else.' }],
        temperature: 0.1,
        max_tokens: 10
      })
    });

    const elapsed = Date.now() - start;
    if (response.ok) {
      const data = await response.json();
      console.log(`[SUCCESS] ${model} - Response: "${data.choices[0].message.content.trim()}" in ${elapsed}ms`);
      return true;
    } else {
      const errText = await response.text();
      console.log(`[FAILED] ${model} - Status: ${response.status} - error: ${errText.substring(0, 100)}...`);
      return false;
    }
  } catch (err) {
    console.log(`[ERROR] ${model} - ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Testing Nemotron models authorization & speed...\n');
  for (const model of modelsToTest) {
    await testModel(model);
  }
}

runTests();

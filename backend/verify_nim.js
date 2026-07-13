import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the project root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.NVIDIA_API_KEY;
const baseUrl = process.env.NIM_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';

console.log('--- NVIDIA NIM Verification Script ---');
console.log('NIM Base URL:', baseUrl);
console.log('NVIDIA API Key exists:', !!apiKey);

if (!apiKey || apiKey.includes('your_placeholder_key') || apiKey.includes('placeholder_token')) {
  console.log('\n[WARNING]: It looks like you haven\'t replaced the placeholder in your .env file yet.');
  console.log('Please make sure you have the following in c:\\Users\\Rupayan Saha\\Desktop\\Web Dev\\wanderloop\\.env:');
  console.log('NVIDIA_API_KEY=your_real_nvapi_key_here\n');
  process.exit(1);
}

// We will use nvidia/llama-3.3-nemotron-super-49b-v1 as the test model
const model = 'nvidia/llama-3.3-nemotron-super-49b-v1';

async function testNIM() {
  try {
    console.log(`\nSending structured itinerary request to model: "${model}"...`);
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: 'Plan a 2-day trip to Tokyo in JSON format. Return a JSON object with keys: "message" (a brief greeting) and "trip" (an object containing "title", "budget": 20000, and "days" as an array). Keep stops to 2 per day.' }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API returned HTTP ${response.status} - ${errText}`);
    }

    const data = await response.json();
    console.log('\n--- API Response Success ---');
    console.log(data.choices[0].message.content.trim());
    console.log('----------------------------\n');
  } catch (error) {
    console.error('\n[ERROR] Connection failed:', error.message);
  }
}

testNIM();

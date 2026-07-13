import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.NVIDIA_API_KEY;
const baseUrl = process.env.NIM_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';

async function listModels() {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API returned HTTP ${response.status} - ${errText}`);
    }

    const data = await response.json();
    console.log('Available Models in NVIDIA NIM Catalog:');
    
    // Filter models containing "nemotron"
    const nemotronModels = data.data.filter(m => m.id.toLowerCase().includes('nemotron'));
    
    console.log('\n--- Nemotron Models ---');
    nemotronModels.forEach(m => console.log(`- ${m.id}`));
    
    console.log('\n--- All Models ---');
    data.data.forEach(m => console.log(`- ${m.id}`));
  } catch (error) {
    console.error('Error fetching models:', error.message);
  }
}

listModels();

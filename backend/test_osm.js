

async function testOSM() {
  const query = 'Sensoji';
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geojson&limit=1`;
  
  console.log(`Fetching from: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Success! Received data:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to fetch from OpenStreetMap API:', error);
  }
}

testOSM();

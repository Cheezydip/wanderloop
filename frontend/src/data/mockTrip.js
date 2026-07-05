export const mockTrip = {
  id: 'tokyo-exploration-3d',
  title: 'Tokyo Exploration',
  budget: 25000, // Budget in JPY
  messages: [
    {
      id: 'm1',
      role: 'assistant',
      content: 'Konnichiwa! I am your Wanderloop planner. I see you want to explore Tokyo for 3 days and love food and immersive sights. Here is a curated itinerary balancing historic shrines, modern pop-culture, digital art, and local markets.',
      timestamp: new Date().toISOString()
    },
    {
      id: 'm2',
      role: 'user',
      content: 'This looks fantastic! Can you add a museum or exhibition for Day 3, and suggest some nearby homestays?',
      timestamp: new Date().toISOString()
    },
    {
      id: 'm3',
      role: 'assistant',
      content: 'I have updated Day 3 with the spectacular teamLab Planets immersive digital art museum in Toyosu. I have also selected three top-rated, route-aware homestays positioned near the center of gravity of your daily stops to minimize commute times.',
      timestamp: new Date().toISOString()
    }
  ],
  days: [
    {
      id: 'day-1',
      dayNumber: 1,
      colorHue: 'teal',
      stops: [
        {
          id: 's1-1',
          name: 'Senso-ji Temple (Asakusa)',
          lat: 35.7147,
          lng: 139.7967,
          timeEstimate: '09:00 AM - 11:30 AM',
          costEstimate: 0,
          rationale: 'A historic start to Tokyo. Senso-ji is Tokyo\'s oldest and most iconic Buddhist temple, dating back to 645 AD.',
          order: 1
        },
        {
          id: 's1-2',
          name: 'Nakamise Shopping Street',
          lat: 35.7125,
          lng: 139.7964,
          timeEstimate: '11:30 AM - 01:00 PM',
          costEstimate: 800,
          rationale: 'Right outside the temple gates, this street is perfect for tasting traditional street snacks like fresh senbei and sweet dango.',
          order: 2
        },
        {
          id: 's1-3',
          name: 'Tokyo Skytree Observatory',
          lat: 35.7100,
          lng: 139.8107,
          timeEstimate: '02:00 PM - 04:30 PM',
          costEstimate: 2200,
          rationale: 'Get a panoramic bird\'s-eye view of the massive Tokyo metropolis from 450 meters up to appreciate the sheer scale of the city.',
          order: 3
        }
      ]
    },
    {
      id: 'day-2',
      dayNumber: 2,
      colorHue: 'amber',
      stops: [
        {
          id: 's2-1',
          name: 'Meiji Jingu Shrine',
          lat: 35.6764,
          lng: 139.6993,
          timeEstimate: '09:30 AM - 11:30 AM',
          costEstimate: 0,
          rationale: 'A serene forested shrine dedicated to Emperor Meiji, offering peace and majestic torii gates in the absolute center of Tokyo.',
          order: 1
        },
        {
          id: 's2-2',
          name: 'Takeshita Street (Harajuku)',
          lat: 35.6715,
          lng: 139.7030,
          timeEstimate: '11:30 AM - 01:30 PM',
          costEstimate: 1200,
          rationale: 'The absolute birthplace of kawaii culture. Famous for colorful giant crepes, quirky rainbow sweets, and trend-setting fashion.',
          order: 2
        },
        {
          id: 's2-3',
          name: 'Shibuya Crossing & Hachiko',
          lat: 35.6580,
          lng: 139.7016,
          timeEstimate: '03:00 PM - 06:00 PM',
          costEstimate: 1500,
          rationale: 'Experience walking the world\'s busiest pedestrian scramble crossing and pay respects at the famous statue of the loyal dog Hachiko.',
          order: 3
        }
      ]
    },
    {
      id: 'day-3',
      dayNumber: 3,
      colorHue: 'violet',
      stops: [
        {
          id: 's3-1',
          name: 'Tsukiji Outer Food Market',
          lat: 35.6655,
          lng: 139.7698,
          timeEstimate: '08:30 AM - 11:00 AM',
          costEstimate: 2500,
          rationale: 'Tokyo\'s ultimate breakfast destination. Enjoy fresh tamagoyaki, wagyu skewers, and fresh sea urchin from street vendors.',
          order: 1
        },
        {
          id: 's3-2',
          name: 'teamLab Planets TOKYO',
          lat: 35.6491,
          lng: 139.7911,
          timeEstimate: '12:00 PM - 02:30 PM',
          costEstimate: 3800,
          rationale: 'A body-immersive digital art museum where you walk barefoot through water, crystal light corridors, and giant floating flower gardens.',
          order: 2
        },
        {
          id: 's3-3',
          name: 'Odaiba Seaside Park & Sunset',
          lat: 35.6293,
          lng: 139.7766,
          timeEstimate: '04:00 PM - 07:00 PM',
          costEstimate: 500,
          rationale: 'Relax on the sand, take photos with the miniature Statue of Liberty, and view the sunset behind the illuminated Rainbow Bridge.',
          order: 3
        }
      ]
    }
  ]
};

export const mockHomestays = [
  {
    id: 'h1',
    name: 'Asakusa Zen Ryokan',
    lat: 35.7160,
    lng: 139.7940,
    pricePerNight: 6200,
    rating: 4.8,
    reviewCount: 142,
    amenities: ['Tatami Room', 'Onsen Tub', 'Free Tea', 'High-speed Wifi'],
    avgCommuteMinutes: 6,
    rationale: 'Very close to Day 1 stops (Asakusa). Excellent choice if you prefer traditional Japanese tatami mats and a relaxing wooden tub bath.'
  },
  {
    id: 'h2',
    name: 'Shibuya Skyline Studio',
    lat: 35.6595,
    lng: 139.6970,
    pricePerNight: 9800,
    rating: 4.7,
    reviewCount: 98,
    amenities: ['Kitchen', 'Balcony', 'Pocket Wifi', 'AC', 'Washer'],
    avgCommuteMinutes: 9,
    rationale: 'Centrally located to Day 2 stops (Harajuku/Shibuya). Offers panoramic high-rise views, a full kitchenette, and immediate subway access.'
  },
  {
    id: 'h3',
    name: 'Toyosu Bayview Loft',
    lat: 35.6410,
    lng: 139.7890,
    pricePerNight: 8500,
    rating: 4.9,
    reviewCount: 54,
    amenities: ['Workspace', 'Gym access', 'High-speed Wifi', 'AC', 'Coffee Bar'],
    avgCommuteMinutes: 11,
    rationale: 'A few minutes walk from teamLab Planets (Day 3). Modern, spacious layout with floor-to-ceiling windows overlooking Tokyo Bay.'
  }
];

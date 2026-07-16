import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useTrip } from '../../context/TripContext';
import ThreeGlobe from './ThreeGlobe';
import useScrollReveal, { useStaggerReveal } from './useScrollReveal';
import useCountUp from './useCountUp';
import {
  SkeletonCard,
  SkeletonMockup,
  SkeletonAvatar,
  SkeletonText,
} from './SkeletonLoader';

/* ═══════════════════════════════════════════════════
   WANDERLOOP LANDING PAGE
   Sections: Nav · Hero · Features · How it Works ·
             Showcase · Testimonials · CTA · Footer
   ═══════════════════════════════════════════════════ */

/* ─── SVG Icon Helpers ─── */
const GlobeIcon = ({ size = 18, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    className={className}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
    <ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" strokeWidth="1.2" />
    <path d="M2 12h20" stroke="currentColor" strokeWidth="1" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

const ArrowRight = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M3 8h10m0 0L9 4m4 4L9 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StarIcon = () => (
  <svg
    className="landing-star"
    viewBox="0 0 16 16"
    fill="currentColor"
    width="16"
    height="16"
  >
    <path d="M8 1l2.2 4.5 5 .7-3.6 3.5.9 4.9L8 12.3l-4.5 2.3.9-4.9L.8 6.2l5-.7z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" width="12" height="12">
    <path
      d="M2 6l3 3 5-5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ─── Stat Counter Card ─── */
function StatCard({ target, label, suffix = '' }) {
  const { ref, value } = useCountUp(target);
  return (
    <div className="landing-stat-card" ref={ref}>
      <div className="landing-stat-value">
        {value.toLocaleString()}
        {suffix}
      </div>
      <div className="landing-stat-label">{label}</div>
    </div>
  );
}

/* ─── Bento Feature Card ─── */
function BentoCard({
  icon,
  title,
  desc,
  colorClass,
  wide,
  children,
  loaded,
}) {
  const cardRef = useRef(null);

  /* Mouse-tracking glow */
  function handleMouseMove(e) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  }

  if (!loaded) return <SkeletonCard className={wide ? 'landing-bento-wide' : ''} />;

  return (
    <div
      ref={cardRef}
      className={`landing-bento-card ${wide ? 'landing-bento-wide' : ''}`}
      onMouseMove={handleMouseMove}
    >
      <div className={`landing-bento-icon ${colorClass}`}>
        {icon}
      </div>
      <div className="landing-bento-title">{title}</div>
      <div className="landing-bento-desc">{desc}</div>
      {children}
    </div>
  );
}

/* ─── Testimonial Card ─── */
function TestimonialCard({ text, name, role, avatarClass }) {
  return (
    <div className="landing-testimonial-card">
      <div className="landing-testimonial-stars">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <StarIcon key={i} />
          ))}
      </div>
      <div className="landing-testimonial-text">{text}</div>
      <div className="landing-testimonial-author">
        <div className={`landing-testimonial-avatar ${avatarClass}`}>
          {name.charAt(0)}
        </div>
        <div>
          <div className="landing-testimonial-name">{name}</div>
          <div className="landing-testimonial-role">{role}</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════ */
export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const { dispatch } = useTrip();
  const [inputValue, setInputValue] = useState('');
  const [navScrolled, setNavScrolled] = useState(false);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const [loaderMessage, setLoaderMessage] = useState('initializing itinerary engine...');
  const [loaderProgress, setLoaderProgress] = useState(0);

  /* Scroll refs */
  const featuresHeaderRef = useScrollReveal();
  const bentoGridRef = useStaggerReveal({ staggerMs: 120 });
  const howHeaderRef = useScrollReveal();
  const showcaseTextRef = useScrollReveal();
  const mockupRef = useScrollReveal({ rootMargin: '0px 0px -60px 0px' });
  const testimonialsHeaderRef = useScrollReveal();
  const ctaRef = useScrollReveal();
  const scrollContainerRef = useRef(null);

  /* Timeline step refs */
  const step1Ref = useScrollReveal();
  const step2Ref = useScrollReveal();
  const step3Ref = useScrollReveal();
  const timelineLineRef = useRef(null);

  /* Simulated detailed loading sequence */
  useEffect(() => {
    const messages = [
      'initializing itinerary engine...',
      'loading map tiles...',
      'calibrating route optimizer...',
      'finding homestays...',
      'ready.',
    ];
    
    // Progress bar fill
    const progressInterval = setInterval(() => {
      setLoaderProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1.6; 
      });
    }, 55);

    // Text messages cycling
    let msgIdx = 0;
    const messageInterval = setInterval(() => {
      msgIdx++;
      if (msgIdx < messages.length) {
        setLoaderMessage(messages[msgIdx]);
      } else {
        clearInterval(messageInterval);
        setTimeout(() => {
          setIsLoading(false); // Triggers ThreeGlobe zoom out
          setTimeout(() => {
            setShowLoader(false); // Unmounts loader overlay after fade animation
            setSectionsLoaded(true); // Triggers scroll reveals
          }, 850);
        }, 400);
      }
    }, 750);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, []);

  /* Nav scroll detection */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    function handleScroll() {
      setNavScrolled(container.scrollTop > 40);

      /* Timeline line fill */
      if (timelineLineRef.current) {
        const howSection = document.getElementById('landing-how');
        if (howSection) {
          const rect = howSection.getBoundingClientRect();
          const viewH = window.innerHeight;
          const progress = Math.min(
            Math.max(((viewH - rect.top) / (rect.height + viewH)) * 100, 0),
            100
          );
          timelineLineRef.current.style.height = `${progress}%`;
        }
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  /* Submit handler */
  function handleSubmit(promptOverride) {
    const text = promptOverride || inputValue;
    if (!text.trim()) return;
    dispatch({ type: 'START_INTERVIEW', payload: text });
  }

  /* Prompt chips */
  const promptChips = [
    { text: '10 days in Japan', prompt: '10 days in Japan, love food, moderate budget' },
    { text: 'Weekend in Paris', prompt: 'Weekend in Paris, first time, want art and cafes' },
    { text: 'Southeast Asia backpacking', prompt: '2 weeks backpacking Southeast Asia, $50/day' },
    { text: 'Costa Rica with kids', prompt: 'Family trip to Costa Rica, 7 days, kid-friendly' },
  ];

  /* Feature data */
  const features = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1H7l-4 3.5V5a1 1 0 011-1z"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      title: 'AI Interview',
      desc: 'Answer a few quick questions about your pace, budget, and interests. The AI adapts its follow-ups based on your answers — no forms, no checkboxes.',
      color: 'landing-icon-purple',
      wide: true,
      visual: (
        <div className="landing-chat-preview">
          <div className="landing-chat-msg landing-chat-ai">
            <div className="landing-chat-avatar landing-chat-avatar-ai" />
            <div className="landing-chat-bubble landing-chat-bubble-ai">What's your budget per day?</div>
          </div>
          <div className="landing-chat-msg landing-chat-user">
            <div className="landing-chat-avatar landing-chat-avatar-user" />
            <div className="landing-chat-bubble landing-chat-bubble-user">Around $80, flexible</div>
          </div>
          <div className="landing-chat-msg landing-chat-ai">
            <div className="landing-chat-avatar landing-chat-avatar-ai" />
            <div className="landing-chat-bubble landing-chat-bubble-ai">
              Got it — I'll prioritize local street food over tourist spots
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M1 5l7-2 8 2 7-2v16l-7 2-8-2-7 2V5z"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path d="M8 3v16M16 5v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      title: 'Live Map Routes',
      desc: 'Every stop pins to a real map. Routes are color-coded per day, with travel times between stops calculated live.',
      color: 'landing-icon-teal',
      wide: false,
      visual: (
        <div className="landing-mini-map">
          <div className="landing-map-pin" style={{ top: '18%', left: '22%', background: 'var(--aurora-2)', color: 'var(--aurora-2)' }} />
          <div className="landing-map-pin" style={{ top: '45%', left: '50%', background: 'var(--aurora-1)', color: 'var(--aurora-1)' }} />
          <div className="landing-map-pin" style={{ top: '65%', left: '72%', background: 'var(--aurora-3)', color: 'var(--aurora-3)' }} />
          <svg className="landing-map-route" viewBox="0 0 200 100" fill="none">
            <defs>
              <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="var(--aurora-2)" />
                <stop offset="0.5" stopColor="var(--aurora-1)" />
                <stop offset="1" stopColor="var(--aurora-3)" />
              </linearGradient>
            </defs>
            <path
              d="M10 15 Q60 50 100 40 T190 80"
              stroke="url(#routeGrad)"
              strokeWidth="2"
              strokeDasharray="6 4"
              opacity="0.5"
            />
          </svg>
        </div>
      ),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 11l9-8 9 8"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: 'Route-Aware Stays',
      desc: 'Homestays scored by proximity to your daily route, not just price. Hover a pin to see commute lines.',
      color: 'landing-icon-rose',
      wide: false,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M8 4v16M16 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4 8h6M4 12h6M14 8h6M14 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      title: 'Drag to Reorder',
      desc: 'Drag a stop to a different slot and routes + travel times recompute instantly. No regenerate button needed.',
      color: 'landing-icon-green',
      wide: false,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2v20M8 6h4a3 3 0 010 6H8M8 12h5a3 3 0 010 6H8"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      ),
      title: 'Budget Tracker',
      desc: 'Running total across lodging, food, activities, and transit. Turns amber when you\'re close to your daily limit.',
      color: 'landing-icon-amber',
      wide: false,
    },
  ];

  /* Testimonials */
  const testimonials = [
    {
      text: '"I described a 10-day Japan trip in one sentence. The AI asked three questions, then handed me a map with every route plotted. I didn\'t change a thing."',
      name: 'Aiko M.',
      role: 'Solo traveler, Tokyo',
      avatar: 'landing-avatar-1',
    },
    {
      text: '"The homestay recommendations were spot-on. Each one was walking distance to the next day\'s stops. Saved me two hours of commute every morning."',
      name: 'Raj P.',
      role: 'Backpacker, 23 countries',
      avatar: 'landing-avatar-2',
    },
    {
      text: '"I typed \'less walking on day 2\' and it rearranged three stops without touching the rest of the trip. The budget tracker caught the savings instantly."',
      name: 'Sarah K.',
      role: 'Family travel planner',
      avatar: 'landing-avatar-3',
    },
    {
      text: '"Planning trips used to take me hours across Google Maps and spreadsheets. Wanderloop did it in 30 seconds — and the routes actually made geographic sense."',
      name: 'Marco L.',
      role: 'Digital nomad, Bali',
      avatar: 'landing-avatar-4',
    },
    {
      text: '"Best UI I\'ve seen for travel planning. The color-coded day routes made it instantly clear where I\'d be at any point during the trip."',
      name: 'Elena V.',
      role: 'Travel blogger',
      avatar: 'landing-avatar-5',
    },
    {
      text: '"We had 4 days in Seoul and zero plan. Wanderloop gave us a family-friendly itinerary that even accounted for our kid\'s nap schedule."',
      name: 'Tom C.',
      role: 'Dad of 2, first Asia trip',
      avatar: 'landing-avatar-6',
    },
  ];

  return (
    <div
      ref={scrollContainerRef}
      className={`landing-root ${sectionsLoaded ? 'loaded' : ''}`}
      style={{
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollBehavior: 'smooth',
      }}
    >
      {/* ═══ LOADER OVERLAY ═══ */}
      {showLoader && (
        <div className={`landing-loader-overlay ${!isLoading ? 'fading-out' : ''}`}>
          <div className="landing-loader-content">
            <div className="landing-loader-spinner-wrapper">
              <div className="landing-loader-spinner-ambient" />
              <div className="landing-loader-pulse-ring" />
              <div className="landing-loader-pulse-ring-2" />
              <GlobeIcon size={32} className="landing-loader-globe-icon" />
            </div>
            
            <div className="landing-loader-bar">
              <div 
                className="landing-loader-bar-fill" 
                style={{ width: `${loaderProgress}%` }} 
              />
            </div>
            
            <div className="landing-loader-text">
              {loaderMessage}
            </div>
          </div>
        </div>
      )}

      {/* ═══ NAVIGATION ═══ */}
      <nav className={`landing-nav ${navScrolled ? 'landing-nav-scrolled' : ''}`}>
        <a href="#" className="landing-nav-brand" onClick={(e) => e.preventDefault()}>
          <div className="landing-nav-logo">
            <GlobeIcon size={18} className="landing-nav-logo-icon" />
          </div>
          <span>
            wander<span className="landing-nav-accent">loop</span>
          </span>
        </a>

        <ul className="landing-nav-links">
          <li><a href="#landing-features">Features</a></li>
          <li><a href="#landing-how">How it works</a></li>
          <li><a href="#landing-showcase">Product</a></li>
          <li><a href="#landing-testimonials">Reviews</a></li>
        </ul>

        <div className="landing-nav-actions">
          <button
            className="landing-theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'sunset' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M17 11a7 7 0 01-8.5-8.5A7.5 7.5 0 1017 11z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button className="landing-btn-primary" onClick={() => {
            const hero = document.getElementById('landing-hero-input');
            if (hero) hero.focus();
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Start planning
          </button>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="landing-hero" id="landing-hero">
        {/* Three.js Globe background */}
        <ThreeGlobe theme={theme} loading={isLoading} />

        {/* Aurora blobs */}
        <div className="landing-hero-aurora">
          <div className="landing-aurora-blob" />
          <div className="landing-aurora-blob" />
          <div className="landing-aurora-blob" />
          <div className="landing-aurora-blob" />
        </div>

        {/* Perspective grid floor */}
        <div className="landing-hero-grid" />

        {/* Hero content */}
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <span className="landing-badge-icon">
              <CheckIcon />
            </span>
            AI-powered travel planning
            <span className="landing-badge-pulse" />
          </div>

          <h1 className="landing-hero-title">
            Travel plans that<br />
            <span className="landing-hero-gradient">build themselves</span>
          </h1>

          <p className="landing-hero-sub">
            Tell the AI where you want to go. It interviews you, builds a day-by-day
            itinerary on a live map, and finds route-aware homestays — all in seconds.
          </p>

          {/* Search bar */}
          <form
            className="landing-hero-search"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <span className="landing-search-icon">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              id="landing-hero-input"
              type="text"
              className="landing-search-input"
              placeholder="5 days in Japan, love street food, budget $80/day..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              aria-label="Describe your trip"
            />
            <button
              type="submit"
              className="landing-search-btn"
              disabled={!inputValue.trim()}
              aria-label="Start planning"
            >
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Prompt chips */}
          <div className="landing-hero-chips">
            {promptChips.map((chip, idx) => (
              <button
                key={idx}
                className="landing-chip"
                onClick={() => handleSubmit(chip.prompt)}
                style={{ animationDelay: `${1.8 + idx * 0.1}s` }}
              >
                {chip.text}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="landing-hero-stats">
            <StatCard target={12847} label="Trips planned" />
            <StatCard target={94} label="% Recommend" suffix="%" />
            <StatCard target={43} label="Countries" />
          </div>
        </div>
      </section>

      {/* ═══ FEATURES BENTO ═══ */}
      <section className="landing-section" id="landing-features">
        <div className="landing-section-inner">
          <div className="landing-section-header" ref={featuresHeaderRef}>
            <div className="landing-section-label">✦ Features</div>
            <h2 className="landing-section-title">
              Everything your trip needs,<br />nothing it doesn't
            </h2>
            <p className="landing-section-desc">
              Built for people who want real travel plans, not generic top-10 lists from a search engine.
            </p>
          </div>

          <div className="landing-bento-grid" ref={bentoGridRef}>
            {features.map((f, idx) => (
              <BentoCard
                key={idx}
                icon={f.icon}
                title={f.title}
                desc={f.desc}
                colorClass={f.color}
                wide={f.wide}
                loaded={sectionsLoaded}
              >
                {f.visual}
              </BentoCard>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section
        className="landing-section"
        id="landing-how"
        style={{ background: 'var(--surface)' }}
      >
        <div className="landing-section-inner">
          <div className="landing-section-header" ref={howHeaderRef}>
            <div className="landing-section-label">✦ Process</div>
            <h2 className="landing-section-title">Three steps to your trip</h2>
            <p className="landing-section-desc">
              No spreadsheets. No tabs. Just tell the AI what you want.
            </p>
          </div>

          <div className="landing-steps-container">
            <div className="landing-steps-line">
              <div className="landing-steps-line-fill" ref={timelineLineRef} />
            </div>

            {[
              {
                num: '1',
                title: 'Describe your trip',
                desc: 'Type a sentence like "5 days in Japan, love food, $80/day." The AI asks clarifying questions one at a time.',
                visual: '"5 days in Tokyo, street food lover, budget friendly, want hidden gems"',
                visualLabel: 'Your prompt',
                ref: step1Ref,
              },
              {
                num: '2',
                title: 'Review the plan',
                desc: 'A full day-by-day itinerary appears on a live map with routes, stops, and reasoning for every pick.',
                visual: null,
                visualLabel: 'Generated output',
                ref: step2Ref,
              },
              {
                num: '3',
                title: 'Tweak & go',
                desc: 'Drag stops, type edits like "less walking on day 2," or re-optimize a single day. The rest stays untouched.',
                visual: '"Less walking on day 2, add a ramen place near Ueno"',
                visualLabel: 'Your edit',
                ref: step3Ref,
              },
            ].map((step, idx) => (
              <div className="landing-step-item" key={idx} ref={step.ref}>
                <div className="landing-step-content">
                  <div className="landing-step-title">{step.title}</div>
                  <div className="landing-step-desc">{step.desc}</div>
                </div>
                <div className="landing-step-num-wrap">
                  <div className="landing-step-num">{step.num}</div>
                </div>
                <div className="landing-step-visual">
                  <div className="landing-step-visual-tag">{step.visualLabel}</div>
                  {step.visual ? (
                    <div className="landing-step-visual-prompt">{step.visual}</div>
                  ) : (
                    <div className="landing-step-visual-text">
                      <div className="landing-step-day">
                        <span className="landing-step-dot" style={{ background: 'var(--aurora-2)' }} />
                        Day 1 — Tsukiji → teamLab → Shibuya
                      </div>
                      <div className="landing-step-day">
                        <span className="landing-step-dot" style={{ background: 'var(--aurora-1)' }} />
                        Day 2 — Asakusa → Akihabara → Ueno
                      </div>
                      <div className="landing-step-day">
                        <span className="landing-step-dot" style={{ background: 'var(--aurora-3)' }} />
                        Day 3 — Harajuku → Shinjuku Gyoen
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SHOWCASE ═══ */}
      <section className="landing-section landing-showcase" id="landing-showcase">
        <div className="landing-showcase-glow landing-showcase-glow-left" />
        <div className="landing-showcase-glow landing-showcase-glow-right" />
        <div className="landing-section-inner">
          <div className="landing-showcase-grid">
            <div className="landing-showcase-text" ref={showcaseTextRef}>
              <div className="landing-section-label">✦ Product</div>
              <h2 className="landing-section-title">See your trip before you leave</h2>
              <p className="landing-section-desc" style={{ margin: 0 }}>
                Wanderloop doesn't just list attractions — it builds a geographic plan.
                Routes respect real travel times. Stays sit near your daily routes, not
                in a random part of town.
              </p>
              <ul className="landing-showcase-list">
                {[
                  'Color-coded day routes on a live interactive map',
                  'Real travel time between every stop',
                  'Homestays ranked by route proximity score',
                  'Drag-and-drop reordering with instant recalc',
                ].map((item, i) => (
                  <li key={i}>
                    <span className="landing-showcase-check">
                      <CheckIcon />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mockup frame */}
            <div className="landing-mockup-frame" ref={mockupRef}>
              {!sectionsLoaded ? (
                <SkeletonMockup />
              ) : (
                <>
                  <div className="landing-mockup-titlebar">
                    <div className="landing-mockup-dot" style={{ background: '#ff5f57' }} />
                    <div className="landing-mockup-dot" style={{ background: '#febc2e' }} />
                    <div className="landing-mockup-dot" style={{ background: '#28c840' }} />
                    <div className="landing-mockup-titlebar-url">wanderloop.ai/trip/tokyo-5d</div>
                  </div>
                  <div className="landing-mockup-content">
                    {/* Chat panel */}
                    <div className="landing-mockup-panel">
                      <div className="landing-mockup-panel-label">
                        <span className="landing-mockup-label-dot" /> AI Chat
                      </div>
                      {[
                        { ai: true, text: "What's your budget per day?" },
                        { ai: false, text: 'Around $80, flexible' },
                        { ai: true, text: "I'll prioritize local food spots over tourist restaurants." },
                      ].map((msg, i) => (
                        <div className="landing-mockup-chat-item" key={i}>
                          <div className={`landing-mockup-chat-av ${msg.ai ? 'landing-mockup-av-ai' : 'landing-mockup-av-user'}`} />
                          <div className={`landing-mockup-chat-bub ${msg.ai ? 'landing-mockup-bub-ai' : 'landing-mockup-bub-user'}`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Map panel */}
                    <div className="landing-mockup-panel landing-mockup-map-area">
                      <div className="landing-mockup-map-marker" style={{ top: '18%', left: '20%', background: 'var(--aurora-2)', color: 'var(--aurora-2)' }} />
                      <div className="landing-mockup-map-marker" style={{ top: '40%', left: '48%', background: 'var(--aurora-1)', color: 'var(--aurora-1)' }} />
                      <div className="landing-mockup-map-marker" style={{ top: '68%', left: '72%', background: 'var(--aurora-3)', color: 'var(--aurora-3)' }} />
                      <svg className="landing-mockup-route-svg" viewBox="0 0 200 150" fill="none">
                        <defs>
                          <linearGradient id="mockGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="var(--aurora-2)" />
                            <stop offset="0.5" stopColor="var(--aurora-1)" />
                            <stop offset="1" stopColor="var(--aurora-3)" />
                          </linearGradient>
                        </defs>
                        <path d="M20 30 Q60 80 100 60 T180 120" stroke="url(#mockGrad)" strokeWidth="2" strokeDasharray="5 4" opacity="0.4" />
                      </svg>
                    </div>
                    {/* Itinerary panel */}
                    <div className="landing-mockup-panel">
                      <div className="landing-mockup-panel-label">Day 1</div>
                      {[
                        { time: '09:00', name: 'Tsukiji Outer Market', color: 'var(--aurora-2)' },
                        { time: '11:30', name: 'teamLab Borderless', color: 'var(--aurora-1)' },
                        { time: '14:00', name: 'Shibuya Crossing', color: 'var(--amber, #fbbf24)' },
                        { time: '18:00', name: 'Golden Gai', color: 'var(--aurora-4, #a3e635)' },
                      ].map((item, i) => (
                        <div className="landing-mockup-itin-item" key={i}>
                          <span className="landing-mockup-itin-time">{item.time}</span>
                          <span className="landing-mockup-itin-dot" style={{ background: item.color }} />
                          {item.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section
        className="landing-section"
        id="landing-testimonials"
        style={{ background: 'var(--surface)' }}
      >
        <div className="landing-section-inner">
          <div className="landing-section-header" ref={testimonialsHeaderRef}>
            <div className="landing-section-label">✦ Reviews</div>
            <h2 className="landing-section-title">Travelers love the plan</h2>
            <p className="landing-section-desc">
              Real feedback from real travelers who planned real trips.
            </p>
          </div>
        </div>
        <div className="landing-marquee-wrap">
          <div className="landing-marquee">
            {/* Duplicate for infinite scroll */}
            {[...testimonials, ...testimonials].map((t, idx) => (
              <TestimonialCard
                key={idx}
                text={t.text}
                name={t.name}
                role={t.role}
                avatarClass={t.avatar}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="landing-section landing-cta" ref={ctaRef}>
        <div className="landing-cta-aurora">
          <div className="landing-cta-blob" />
          <div className="landing-cta-blob" />
        </div>
        <div className="landing-cta-content">
          <h2 className="landing-cta-title">
            Your next trip,<br />
            <span className="landing-hero-gradient">planned in seconds</span>
          </h2>
          <p className="landing-cta-desc">
            One sentence is all it takes. The AI handles the rest — routes, stays,
            budget, and a beautiful day-by-day plan on a live map.
          </p>
          <div className="landing-cta-actions">
            <button className="landing-btn-primary landing-btn-lg" onClick={() => {
              const el = document.getElementById('landing-hero-input');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => el.focus(), 600);
              }
            }}>
              Plan a trip
              <ArrowRight />
            </button>
            <button
              className="landing-btn-ghost landing-btn-lg"
              onClick={() =>
                document.getElementById('landing-how')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                <path d="M6.5 6l3.5 2-3.5 2z" fill="currentColor" />
              </svg>
              See how it works
            </button>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <div className="landing-footer-brand">
              <div className="landing-footer-brand-logo">
                <GlobeIcon size={14} className="landing-nav-logo-icon" />
              </div>
              wander<span className="landing-nav-accent">loop</span>
            </div>
            <p className="landing-footer-tagline">
              AI-powered, map-anchored travel planning. Tell the AI where you want to
              go and get a geographic plan in seconds.
            </p>
            <div className="landing-footer-social">
              {['X', 'GH', 'IN'].map((label) => (
                <a href="#" className="landing-footer-social-link" key={label} aria-label={label}>
                  {label}
                </a>
              ))}
            </div>
          </div>
          {[
            { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'API'] },
            { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
            { title: 'Support', links: ['Help Center', 'Privacy', 'Terms', 'Status'] },
          ].map((col, idx) => (
            <div key={idx}>
              <div className="landing-footer-col-title">{col.title}</div>
              <ul className="landing-footer-links">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="landing-footer-bottom">
          <span>© 2025 Wanderloop. All rights reserved.</span>
          <span>Built with AI, for travelers.</span>
        </div>
      </footer>
    </div>
  );
}

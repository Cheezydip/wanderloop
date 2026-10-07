import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useTrip } from '../../context/TripContext';
import { useAuth } from '../../context/AuthContext';
import SavedTripsModal from '../../components/SavedTripsModal';
import UserProfileDropdown from '../../components/UserProfileDropdown';
import ThemeSlider from '../../components/ThemeSlider';
import { Cloud, LogIn, UserPlus } from 'lucide-react';
import TopographicMap from './TopographicMap';
import FlightNetwork from './FlightNetwork';
import IsometricGrid from './IsometricGrid';
import ParticleCTA from './ParticleCTA';
import PrecisionTravelSuite from './PrecisionTravelSuite';
import ActiveTripDashboard from './ActiveTripDashboard';
import useScrollReveal, { useStaggerReveal } from './useScrollReveal';
import useCountUp from './useCountUp';
import useTypewriter from './useTypewriter';
import useParallax from './useParallax';
import useMagneticButton from './useMagneticButton';
import { createTimeline, animate, stagger, spring, cubicBezier } from 'animejs';
import {
  SkeletonCard,
  SkeletonMockup,
} from './SkeletonLoader';

/* ═══════════════════════════════════════════════════
   WANDERLOOP LANDING PAGE — KINETIC CARTOGRAPHY
   Sections: Nav · Hero · Features · How it Works ·
             Showcase · Testimonials · CTA · Footer
   ═══════════════════════════════════════════════════ */

/* ─── SVG Icon Helpers ─── */
const GlobeIcon = ({ size = 18, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
    <ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" strokeWidth="1.2" />
    <path d="M2 12h20" stroke="currentColor" strokeWidth="1" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

const ArrowRight = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StarIcon = () => (
  <svg className="landing-star" viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path d="M8 1l2.2 4.5 5 .7-3.6 3.5.9 4.9L8 12.3l-4.5 2.3.9-4.9L.8 6.2l5-.7z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" width="12" height="12">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronDown = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="landing-scroll-chevron">
    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─── Anime.js Hero Entrance Timeline ─── */
function useAnimeHero(sectionsLoaded) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!sectionsLoaded || hasRun.current) return;
    hasRun.current = true;

    setTimeout(() => {
      const tl = createTimeline({
        defaults: { ease: cubicBezier(0.16, 1, 0.3, 1) },
      });

      // Badge — elastic drop
      tl.add('.landing-hero-badge', {
        translateY: [30, 0],
        opacity: [0, 1],
        scale: [0.8, 1],
        duration: 900,
        ease: spring({ stiffness: 80, damping: 10 }),
      })
      // Title — word-by-word stagger with rotation
      .add('.landing-hero-title .word', {
        translateY: [60, 0],
        rotateX: [40, 0],
        opacity: [0, 1],
        delay: stagger(80),
        duration: 1000,
        ease: spring({ stiffness: 60, damping: 14 }),
      }, '-=600')
      // Subtitle — blur-to-sharp
      .add('.landing-hero-sub', {
        translateY: [25, 0],
        opacity: [0, 1],
        filter: ['blur(8px)', 'blur(0px)'],
        duration: 800,
        ease: spring({ stiffness: 80, damping: 10 }),
      }, '-=700')
      // Dashboard — fade and slide up
      .add('.atd-grid', {
        translateY: [30, 0],
        opacity: [0, 1],
        duration: 800,
        ease: spring({ stiffness: 70, damping: 10 }),
      }, '-=600')
      // Search bar — scale up with glow
      .add('.landing-hero-search', {
        translateY: [20, 0],
        scale: [0.96, 1],
        opacity: [0, 1],
        duration: 700,
        ease: spring({ stiffness: 90, damping: 8 }),
      }, '-=500')
      // Chips — stagger from center
      .add('.landing-hero-chips button', {
        translateY: [16, 0],
        opacity: [0, 1],
        scale: [0.85, 1],
        delay: stagger(60, { from: 'center' }),
        duration: 500,
        ease: spring({ stiffness: 100, damping: 6 }),
      }, '-=400')
      // Stats — slide up with spring
      .add('.landing-hero-stats .landing-stat-card', {
        translateY: [30, 0],
        opacity: [0, 1],
        scale: [0.9, 1],
        delay: stagger(100),
        duration: 600,
        ease: spring({ stiffness: 80, damping: 10 }),
      }, '-=300')
      // Scroll indicator — fade in late
      .add('.landing-scroll-indicator', {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 600,
      }, '-=200')
      // Floating cards — fade in with drift
      .add('.landing-floating-card', {
        opacity: [0, 0.85],
        scale: [0.7, 1],
        delay: stagger(150, { from: 'center' }),
        duration: 800,
        ease: spring({ stiffness: 60, damping: 12 }),
      }, '-=500');
    }, 120);
  }, [sectionsLoaded]);
}

/* ─── Anime.js Bento Stagger — alternating directions ─── */
function useAnimeBento(ref, active) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!active || !ref.current || hasRun.current) return;
    hasRun.current = true;

    const children = ref.current.children;
    if (!children.length) return;

    // Alternate slide direction
    Array.from(children).forEach((child, i) => {
      const fromX = i % 2 === 0 ? -50 : 50;
      const fromRotate = i % 2 === 0 ? -3 : 3;
      animate(child, {
        translateX: [fromX, 0],
        translateY: [50, 0],
        rotate: [fromRotate, 0],
        opacity: [0, 1],
        duration: 800,
        delay: i * 120,
        ease: spring({ stiffness: 70, damping: 12 }),
      });
    });
  }, [active, ref]);
}

/* ─── Auto-Typing Chat Demo ─── */
function ChatDemo() {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [typingDots, setTypingDots] = useState(false);

  const messages = [
    { ai: true, text: "What's your budget per day?" },
    { ai: false, text: 'Around $80, flexible' },
    { ai: true, text: "I'll prioritize local food spots over tourist restaurants." },
  ];

  useEffect(() => {
    let step = 0;
    const timers = [];

    function showNext() {
      if (step >= messages.length) {
        // Reset and loop
        timers.push(setTimeout(() => {
          setVisibleMessages(0);
          step = 0;
          timers.push(setTimeout(showNext, 600));
        }, 3000));
        return;
      }
      if (messages[step].ai) {
        setTypingDots(true);
        timers.push(setTimeout(() => {
          setTypingDots(false);
          step++;
          setVisibleMessages(step);
          timers.push(setTimeout(showNext, 1200));
        }, 1000));
      } else {
        step++;
        setVisibleMessages(step);
        timers.push(setTimeout(showNext, 1200));
      }
    }

    timers.push(setTimeout(showNext, 800));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="landing-chat-preview">
      {messages.slice(0, visibleMessages).map((msg, i) => (
        <div className={`landing-chat-msg ${msg.ai ? 'landing-chat-ai' : 'landing-chat-user'} chat-msg-enter`} key={i}>
          <div className={`landing-chat-avatar ${msg.ai ? 'landing-chat-avatar-ai' : 'landing-chat-avatar-user'}`} />
          <div className={`landing-chat-bubble ${msg.ai ? 'landing-chat-bubble-ai' : 'landing-chat-bubble-user'}`}>{msg.text}</div>
        </div>
      ))}
      {typingDots && (
        <div className="landing-chat-msg landing-chat-ai chat-msg-enter">
          <div className="landing-chat-avatar landing-chat-avatar-ai" />
          <div className="landing-chat-bubble landing-chat-bubble-ai landing-typing-dots">
            <span /><span /><span />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Auto-Drawing Route SVG Demo ─── */
function RouteDemo() {
  const pathRef1 = useRef(null);
  const pathRef2 = useRef(null);

  useEffect(() => {
    const paths = [pathRef1.current, pathRef2.current].filter(Boolean);
    paths.forEach((path, i) => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
      animate(path, {
        strokeDashoffset: [length, 0],
        duration: 1800,
        delay: i * 600,
        ease: cubicBezier(0.4, 0, 0.2, 1),
        loop: true,
        loopDelay: 3000,
      });
    });
  }, []);

  return (
    <div className="landing-mini-map">
      <div className="landing-map-pin landing-pin-bounce" style={{ top: '18%', left: '22%', background: 'var(--aurora-2)', color: 'var(--aurora-2)' }} />
      <div className="landing-map-pin landing-pin-bounce" style={{ top: '45%', left: '50%', background: 'var(--aurora-1)', color: 'var(--aurora-1)', animationDelay: '0.3s' }} />
      <div className="landing-map-pin landing-pin-bounce" style={{ top: '65%', left: '72%', background: 'var(--aurora-3)', color: 'var(--aurora-3)', animationDelay: '0.6s' }} />
      <svg className="landing-map-route" viewBox="0 0 200 100" fill="none">
        <defs>
          <linearGradient id="routeGrad1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--aurora-2)" />
            <stop offset="1" stopColor="var(--aurora-1)" />
          </linearGradient>
          <linearGradient id="routeGrad2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--aurora-1)" />
            <stop offset="1" stopColor="var(--aurora-3)" />
          </linearGradient>
        </defs>
        <path ref={pathRef1} d="M22 15 Q50 35 100 40" stroke="url(#routeGrad1)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        <path ref={pathRef2} d="M100 40 Q150 55 172 80" stroke="url(#routeGrad2)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      </svg>
    </div>
  );
}

/* ─── Sortable List Demo (loops) ─── */
function SortableDemo() {
  const [order, setOrder] = useState([0, 1, 2]);
  const items = ['Tsukiji Market', 'teamLab Borderless', 'Shibuya Crossing'];
  const colors = ['var(--aurora-2)', 'var(--aurora-1)', 'var(--aurora-3)'];

  useEffect(() => {
    const interval = setInterval(() => {
      setOrder((prev) => {
        const next = [...prev];
        const i = Math.floor(Math.random() * 3);
        const j = (i + 1) % 3;
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-sortable-demo">
      {order.map((itemIdx, pos) => (
        <div
          key={itemIdx}
          className="landing-sortable-item"
          style={{
            transform: `translateY(${pos * 34}px)`,
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          <span className="landing-sortable-grip">⠿</span>
          <span className="landing-sortable-dot" style={{ background: colors[itemIdx] }} />
          <span className="landing-sortable-text">{items[itemIdx]}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Budget Bar Demo ─── */
function BudgetDemo() {
  const [fill, setFill] = useState(0);

  useEffect(() => {
    let animating = true;
    function cycle() {
      if (!animating) return;
      setFill(0);
      setTimeout(() => { if (animating) setFill(72); }, 200);
      setTimeout(() => { if (animating) cycle(); }, 4000);
    }
    cycle();
    return () => { animating = false; };
  }, []);

  return (
    <div className="landing-budget-demo">
      <div className="landing-budget-labels">
        <span>Daily Budget</span>
        <span className="landing-budget-amount">${Math.round(fill * 1.11)}/day</span>
      </div>
      <div className="landing-budget-bar">
        <div
          className="landing-budget-fill"
          style={{
            width: `${fill}%`,
            background: fill > 65 ? 'var(--amber)' : 'var(--aurora-2)',
            transition: 'width 1.8s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s',
          }}
        />
      </div>
    </div>
  );
}

/* ─── Homestay Fan Card Demo ─── */
function HomestayDemo() {
  const stays = [
    { name: 'Sakura Inn', dist: '0.4 km', price: '$45' },
    { name: 'Ueno Guest House', dist: '0.8 km', price: '$38' },
    { name: 'Asakusa Lodge', dist: '1.2 km', price: '$52' },
  ];

  return (
    <div className="landing-homestay-demo">
      {stays.map((stay, i) => (
        <div
          key={i}
          className="landing-homestay-card"
          style={{
            '--card-index': i,
            zIndex: 3 - i,
          }}
        >
          <div className="landing-homestay-name">{stay.name}</div>
          <div className="landing-homestay-meta">
            <span className="landing-homestay-dist">{stay.dist}</span>
            <span className="landing-homestay-price">{stay.price}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

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
function BentoCard({ icon, title, desc, colorClass, wide, children, loaded }) {
  const cardRef = useRef(null);

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
    <div ref={cardRef} className={`landing-bento-card ${wide ? 'landing-bento-wide' : ''}`} onMouseMove={handleMouseMove}>
      <div className={`landing-bento-icon ${colorClass}`}>{icon}</div>
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
        {Array(5).fill(0).map((_, i) => <StarIcon key={i} />)}
      </div>
      <div className="landing-testimonial-text">{text}</div>
      <div className="landing-testimonial-author">
        <div className={`landing-testimonial-avatar ${avatarClass}`}>{name.charAt(0)}</div>
        <div>
          <div className="landing-testimonial-name">{name}</div>
          <div className="landing-testimonial-role">{role}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── 3D Tilt Mockup ─── */
function TiltMockup({ children }) {
  const frameRef = useRef(null);

  function handleMouseMove(e) {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1000px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
  }

  function handleMouseLeave() {
    const el = frameRef.current;
    if (!el) return;
    el.style.transform = 'perspective(1000px) rotateY(0) rotateX(0)';
    el.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
    setTimeout(() => {
      if (el) el.style.transition = 'transform 0.15s ease-out';
    }, 600);
  }

  return (
    <div
      ref={frameRef}
      className="landing-mockup-frame"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.15s ease-out' }}
    >
      {children}
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════ */
export default function LandingPage() {
  const { theme } = useTheme();
  const { dispatch } = useTrip();
  const { user, logout, openAuthModal } = useAuth();
  const [placeValue, setPlaceValue] = useState('');
  const [datesValue, setDatesValue] = useState('');
  const [navScrolled, setNavScrolled] = useState(false);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const [isSavedTripsOpen, setIsSavedTripsOpen] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState('initializing itinerary engine...');
  const [loaderProgress, setLoaderProgress] = useState(0);

  const handleDashboardClick = (trip) => {
    if (trip.isSavedTrip && trip.originalData) {
      dispatch({
        type: 'RESTORE_TRIP',
        payload: {
          trip: {
            id: trip.originalData.tripId,
            title: trip.originalData.title || 'Saved Itinerary',
            budget: trip.originalData.budget || 25000,
            currency: trip.originalData.currency || 'JPY',
            days: trip.originalData.days || [],
            messages: trip.originalData.messages || [],
          },
          hasTrip: true,
          selectedHomestaysByDay: trip.originalData.selectedHomestaysByDay || {},
          selectedHomestayId: trip.originalData.selectedHomestayId || null,
          budgetItems: trip.originalData.budgetItems || [],
        },
      });
      const suite = document.getElementById('precision-travel-suite');
      if (suite) suite.scrollIntoView({ behavior: 'smooth' });
    } else {
      setPlaceValue(trip.name);
      const hero = document.getElementById('landing-hero-input');
      if (hero) {
        hero.focus();
        hero.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const bentoRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Parallax scroll tracking
  useParallax(scrollContainerRef);

  // Magnetic button for CTA
  const magneticCTA = useMagneticButton(0.25);

  // Auto-expand hero textarea (removed)

  /* Anime.js orchestrations */
  useAnimeHero(sectionsLoaded);
  useAnimeBento(bentoRef, sectionsLoaded);

  /* Scroll refs */
  const featuresHeaderRef = useScrollReveal();
  const howHeaderRef = useScrollReveal();
  const showcaseTextRef = useScrollReveal();
  const mockupRef = useScrollReveal({ rootMargin: '0px 0px -60px 0px' });
  const testimonialsHeaderRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  /* Timeline step refs */
  const step1Ref = useScrollReveal();
  const step2Ref = useScrollReveal();
  const step3Ref = useScrollReveal();
  const timelineLineRef = useRef(null);

  /* Testimonials stagger animation */
  const testimonialGridRef = useRef(null);
  const testimonialAnimRun = useRef(false);

  useEffect(() => {
    if (!sectionsLoaded) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !testimonialAnimRun.current && testimonialGridRef.current) {
          testimonialAnimRun.current = true;
          animate(testimonialGridRef.current.children, {
            translateY: [60, 0],
            opacity: [0, 1],
            scale: [0.92, 1],
            rotate: () => (Math.random() - 0.5) * 4,
            delay: stagger(100, { from: 'center' }),
            duration: 800,
            ease: spring({ stiffness: 70, damping: 14 }),
          });
        }
      },
      { threshold: 0.15 }
    );

    if (testimonialGridRef.current) observer.observe(testimonialGridRef.current);
    return () => observer.disconnect();
  }, [sectionsLoaded]);

  /* Loader sequence */
  useEffect(() => {
    const messages = [
      'initializing itinerary engine...',
      'loading map tiles...',
      'calibrating route optimizer...',
      'finding homestays...',
      'ready.',
    ];
    const progressInterval = setInterval(() => {
      setLoaderProgress((prev) => {
        if (prev >= 100) { clearInterval(progressInterval); return 100; }
        return prev + 1.6;
      });
    }, 55);

    let msgIdx = 0;
    const messageInterval = setInterval(() => {
      msgIdx++;
      if (msgIdx < messages.length) {
        setLoaderMessage(messages[msgIdx]);
      } else {
        clearInterval(messageInterval);
        setTimeout(() => {
          setIsLoading(false);
          setTimeout(() => {
            setShowLoader(false);
            setSectionsLoaded(true);
          }, 850);
        }, 400);
      }
    }, 750);

    return () => { clearInterval(progressInterval); clearInterval(messageInterval); };
  }, []);

  /* Nav scroll + timeline fill */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    function handleScroll() {
      setNavScrolled(container.scrollTop > 40);
      if (timelineLineRef.current) {
        const howSection = document.getElementById('landing-how');
        if (howSection) {
          const rect = howSection.getBoundingClientRect();
          const viewH = window.innerHeight;
          const progress = Math.min(Math.max(((viewH - rect.top) / (rect.height + viewH)) * 100, 0), 100);
          timelineLineRef.current.style.height = `${progress}%`;
        }
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  /* Submit */
  function handleSubmit(promptOverride) {
    const text = promptOverride || (placeValue && datesValue ? `Trip to ${placeValue} on ${datesValue}` : placeValue);
    if (!text.trim()) return;
    dispatch({ type: 'START_QUESTIONNAIRE', payload: text });
  }

  /* Prompt chips */
  const promptChips = [
    { text: '10 days in Japan', prompt: '10 days in Japan, love food, moderate budget' },
    { text: 'Weekend in Paris', prompt: 'Weekend in Paris, first time, want art and cafes' },
    { text: 'Southeast Asia backpacking', prompt: '2 weeks backpacking Southeast Asia, $50/day' },
    { text: 'Costa Rica with kids', prompt: 'Family trip to Costa Rica, 7 days, kid-friendly' },
  ];

  /* Feature data with interactive demos */
  const features = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1H7l-4 3.5V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      title: 'AI Interview',
      desc: 'Answer a few quick questions about your pace, budget, and interests. The AI adapts its follow-ups based on your answers.',
      color: 'landing-icon-purple',
      wide: true,
      visual: <ChatDemo />,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M1 5l7-2 8 2 7-2v16l-7 2-8-2-7 2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 3v16M16 5v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      title: 'Live Map Routes',
      desc: 'Every stop pins to a real map. Routes are color-coded per day, with travel times between stops.',
      color: 'landing-icon-teal',
      wide: false,
      visual: <RouteDemo />,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 11l9-8 9 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: 'Route-Aware Stays',
      desc: 'Homestays scored by proximity to your daily route, not just price.',
      color: 'landing-icon-rose',
      wide: false,
      visual: <HomestayDemo />,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M8 4v16M16 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4 8h6M4 12h6M14 8h6M14 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      title: 'Drag to Reorder',
      desc: 'Drag a stop to a different slot and routes + travel times recompute instantly.',
      color: 'landing-icon-green',
      wide: false,
      visual: <SortableDemo />,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2v20M8 6h4a3 3 0 010 6H8M8 12h5a3 3 0 010 6H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: 'Budget Tracker',
      desc: "Running total across lodging, food, activities, and transit.",
      color: 'landing-icon-amber',
      wide: false,
      visual: <BudgetDemo />,
    },
  ];

  /* Testimonials */
  const testimonials = [
    { text: '"I described a 10-day Japan trip in one sentence. The AI asked three questions, then handed me a map with every route plotted. I didn\'t change a thing."', name: 'Aiko M.', role: 'Solo traveler, Tokyo', avatar: 'landing-avatar-1' },
    { text: '"The homestay recommendations were spot-on. Each one was walking distance to the next day\'s stops."', name: 'Raj P.', role: 'Backpacker, 23 countries', avatar: 'landing-avatar-2' },
    { text: '"I typed \'less walking on day 2\' and it rearranged three stops without touching the rest of the trip."', name: 'Sarah K.', role: 'Family travel planner', avatar: 'landing-avatar-3' },
    { text: '"Planning trips used to take me hours across Google Maps and spreadsheets. Wanderloop did it in 30 seconds."', name: 'Marco L.', role: 'Digital nomad, Bali', avatar: 'landing-avatar-4' },
    { text: '"Best UI I\'ve seen for travel planning. The color-coded day routes made it instantly clear."', name: 'Elena V.', role: 'Travel blogger', avatar: 'landing-avatar-5' },
    { text: '"We had 4 days in Seoul and zero plan. Wanderloop gave us a family-friendly itinerary."', name: 'Tom C.', role: 'Dad of 2, first Asia trip', avatar: 'landing-avatar-6' },
  ];

  /* Floating destination cards data */
  const floatingCards = [
    { city: 'Tokyo', days: '5 days', emoji: '🗼', pos: { top: '18%', left: '8%' }, delay: 0 },
    { city: 'Paris', days: '3 days', emoji: '🗼', pos: { top: '22%', right: '10%' }, delay: 1.5 },
    { city: 'Bali', days: '7 days', emoji: '🌴', pos: { bottom: '28%', left: '5%' }, delay: 3 },
    { city: 'NYC', days: '4 days', emoji: '🗽', pos: { bottom: '24%', right: '7%' }, delay: 4.5 },
  ];

  return (
    <div
      ref={scrollContainerRef}
      className={`landing-root ${sectionsLoaded ? 'loaded' : ''}`}
      style={{ height: '100vh', overflowY: 'auto', overflowX: 'hidden', scrollBehavior: 'smooth' }}
    >
      {/* ═══ GRAIN TEXTURE OVERLAY ═══ */}
      <div className="landing-grain" aria-hidden="true" />

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
              <div className="landing-loader-bar-fill" style={{ width: `${loaderProgress}%` }} />
            </div>
            <div className="landing-loader-text">{loaderMessage}</div>
          </div>
        </div>
      )}

      {/* ═══ NAVIGATION ═══ */}
      <nav className={`landing-nav ${navScrolled ? 'landing-nav-scrolled' : ''}`}>
        <a href="#" className="landing-nav-brand" onClick={(e) => e.preventDefault()}>
          <div className="landing-nav-logo">
            <GlobeIcon size={18} className="landing-nav-logo-icon" />
          </div>
          <span>wander<span className="landing-nav-accent">loop</span></span>
        </a>

        <ul className="landing-nav-links">
          <li><a href="#landing-features">Features</a></li>
          <li><a href="#landing-how">How it works</a></li>
          <li><a href="#landing-showcase">Product</a></li>
          <li><a href="#landing-testimonials">Reviews</a></li>
        </ul>

        <div className="landing-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ThemeSlider />

          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSavedTripsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border hover:border-emerald-400 hover:text-emerald-400"
                style={{ background: 'var(--surface-2, rgba(255,255,255,0.05))', borderColor: 'var(--border, rgba(255,255,255,0.08))', color: 'var(--text, #fff)' }}
                title="View all your cloud saved trips"
              >
                <Cloud className="w-4 h-4 text-emerald-400" />
                <span>My Trips</span>
              </button>
              <UserProfileDropdown onOpenSavedTrips={() => setIsSavedTripsOpen(true)} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border hover:border-emerald-400 hover:text-emerald-400"
                style={{ background: 'var(--surface-2, rgba(255,255,255,0.05))', borderColor: 'var(--border, rgba(255,255,255,0.08))', color: 'var(--text, #fff)' }}
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                <span>Log In</span>
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border hover:border-emerald-400 hover:text-emerald-400"
                style={{ background: 'var(--surface-2, rgba(255,255,255,0.05))', borderColor: 'var(--border, rgba(255,255,255,0.08))', color: 'var(--text, #fff)' }}
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign Up</span>
              </button>
            </div>
          )}

          <button className="landing-btn-primary hidden md:flex" onClick={() => {
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
      <section className="landing-hero" id="landing-hero" style={{ minHeight: 'auto', paddingTop: '80px', paddingBottom: '40px' }}>
        {/* Aurora blobs — background layer */}
        <div className="landing-hero-aurora">
          <div className="landing-aurora-blob" />
          <div className="landing-aurora-blob" />
          <div className="landing-aurora-blob" />
          <div className="landing-aurora-blob" />
        </div>

        {/* Hero content */}
        <div className="w-full max-w-7xl mx-auto px-4 relative z-10">

          {/* Featured Active Trip Dashboard directly in Hero */}
          <ActiveTripDashboard onTripClick={handleDashboardClick} />
          
          {/* Search bar */}
          <form className="landing-hero-search" style={{ marginTop: '24px' }} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <div className="landing-search-split-bar">
              {/* Destination Segment */}
              <div className="landing-search-segment">
                <span className="landing-segment-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <div className="landing-segment-content">
                  <span className="landing-segment-label">Where to?</span>
                  <input
                    id="landing-hero-input"
                    type="text"
                    className="landing-segment-input"
                    placeholder="e.g. Tokyo, Paris, Bali..."
                    value={placeValue}
                    onChange={(e) => setPlaceValue(e.target.value)}
                    aria-label="Destination"
                  />
                </div>
              </div>

              <div className="landing-search-divider" />

              {/* Dates Segment */}
              <div className="landing-search-segment">
                <span className="landing-segment-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <div className="landing-segment-content">
                  <span className="landing-segment-label">Start Date</span>
                  <input
                    type="date"
                    className="landing-segment-input"
                    value={datesValue}
                    onChange={(e) => setDatesValue(e.target.value)}
                    aria-label="Start Date"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="landing-search-submit-btn"
                disabled={!placeValue.trim() || !datesValue.trim()}
                aria-label="Start planning"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </form>

        </div>
      </section>

      {/* ═══ WAVE DIVIDER ═══ */}
      <div className="landing-wave-divider" aria-hidden="true">
        <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none">
          <path d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z" fill="var(--bg)" />
        </svg>
      </div>

      {/* ═══ FEATURES BENTO ═══ */}
      <section className="landing-section" id="landing-features">
        <div className="landing-section-inner">
          <div className="landing-section-header" ref={featuresHeaderRef}>
            <div className="landing-section-label">✦ Features</div>
            <h2 className="landing-section-title">
              Everything your trip needs,<br />nothing it doesn't
            </h2>
            <p className="landing-section-desc">
              Built for people who want real travel plans, not generic top-10 lists.
            </p>
          </div>

          <div className="landing-bento-grid" ref={bentoRef}>
            {features.map((f, idx) => (
              <BentoCard key={idx} icon={f.icon} title={f.title} desc={f.desc} colorClass={f.color} wide={f.wide} loaded={sectionsLoaded}>
                {f.visual}
              </BentoCard>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRECISION TRAVEL SUITE ═══ */}
      <PrecisionTravelSuite />

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="landing-section" id="landing-how" style={{ background: 'var(--surface)' }}>
        <div className="landing-section-inner">
          <div className="landing-section-header" ref={howHeaderRef}>
            <div className="landing-section-label">✦ Process</div>
            <h2 className="landing-section-title">Three steps to your trip</h2>
            <p className="landing-section-desc">No spreadsheets. No tabs. Just tell the AI what you want.</p>
          </div>

          <div className="landing-steps-container">
            <div className="landing-steps-line">
              <div className="landing-steps-line-fill" ref={timelineLineRef} />
            </div>

            {[
              {
                num: '1', title: 'Describe your trip',
                desc: 'Type a sentence like "5 days in Japan, love food, $80/day." The AI asks clarifying questions one at a time.',
                visual: '"5 days in Tokyo, street food lover, budget friendly, want hidden gems"',
                visualLabel: 'Your prompt', ref: step1Ref,
              },
              {
                num: '2', title: 'Review the plan',
                desc: 'A full day-by-day itinerary appears on a live map with routes, stops, and reasoning for every pick.',
                visual: null, visualLabel: 'Generated output', ref: step2Ref,
              },
              {
                num: '3', title: 'Tweak & go',
                desc: 'Drag stops, type edits like "less walking on day 2," or re-optimize a single day.',
                visual: '"Less walking on day 2, add a ramen place near Ueno"',
                visualLabel: 'Your edit', ref: step3Ref,
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
                        <span className="landing-step-dot" style={{ background: 'var(--aurora-2)' }} />Day 1 — Tsukiji → teamLab → Shibuya
                      </div>
                      <div className="landing-step-day">
                        <span className="landing-step-dot" style={{ background: 'var(--aurora-1)' }} />Day 2 — Asakusa → Akihabara → Ueno
                      </div>
                      <div className="landing-step-day">
                        <span className="landing-step-dot" style={{ background: 'var(--aurora-3)' }} />Day 3 — Harajuku → Shinjuku Gyoen
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
                Routes respect real travel times. Stays sit near your daily routes, not in a random part of town.
              </p>
              <ul className="landing-showcase-list">
                {[
                  'Color-coded day routes on a live interactive map',
                  'Real travel time between every stop',
                  'Homestays ranked by route proximity score',
                  'Drag-and-drop reordering with instant recalc',
                ].map((item, i) => (
                  <li key={i}>
                    <span className="landing-showcase-check"><CheckIcon /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 3D Tilt Mockup */}
            <div ref={mockupRef}>
              {!sectionsLoaded ? (
                <SkeletonMockup />
              ) : (
                <TiltMockup>
                  <div className="landing-mockup-titlebar">
                    <div className="landing-mockup-dot" style={{ background: '#ff5f57' }} />
                    <div className="landing-mockup-dot" style={{ background: '#febc2e' }} />
                    <div className="landing-mockup-dot" style={{ background: '#28c840' }} />
                    <div className="landing-mockup-titlebar-url">wanderloop.ai/trip/tokyo-5d</div>
                  </div>
                  <div className="landing-mockup-content">
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
                          <div className={`landing-mockup-chat-bub ${msg.ai ? 'landing-mockup-bub-ai' : 'landing-mockup-bub-user'}`}>{msg.text}</div>
                        </div>
                      ))}
                    </div>
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
                </TiltMockup>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS — MASONRY GRID ═══ */}
      <section className="landing-section" id="landing-testimonials" style={{ background: 'var(--surface)' }}>
        <div className="landing-section-inner">
          <div className="landing-section-header" ref={testimonialsHeaderRef}>
            <div className="landing-section-label">✦ Reviews</div>
            <h2 className="landing-section-title">Travelers love the plan</h2>
            <p className="landing-section-desc">Real feedback from real travelers who planned real trips.</p>
          </div>

          <div className="landing-testimonial-masonry" ref={testimonialGridRef}>
            {testimonials.map((t, idx) => (
              <TestimonialCard key={idx} text={t.text} name={t.name} role={t.role} avatarClass={t.avatar} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA — PARTICLE CONSTELLATION ═══ */}
      <section className="landing-section landing-cta" ref={ctaRef}>
        <ParticleCTA theme={theme} />
        <div className="landing-cta-content">
          <h2 className="landing-cta-title">
            Your next trip,<br />
            <span className="landing-hero-gradient landing-gradient-flow">planned in seconds</span>
          </h2>
          <p className="landing-cta-desc">
            One sentence is all it takes. The AI handles the rest — routes, stays,
            budget, and a beautiful day-by-day plan on a live map.
          </p>
          <div className="landing-cta-actions">
            <button
              className="landing-btn-primary landing-btn-lg landing-magnetic-btn"
              ref={magneticCTA.ref}
              onMouseMove={magneticCTA.onMouseMove}
              onMouseLeave={magneticCTA.onMouseLeave}
              onClick={() => {
                const el = document.getElementById('landing-hero-input');
                if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus(), 600); }
              }}
            >
              Plan a trip
              <ArrowRight />
            </button>
            <button
              className="landing-btn-ghost landing-btn-lg"
              onClick={() => document.getElementById('landing-how')?.scrollIntoView({ behavior: 'smooth' })}
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

      {/* ═══ FOOTER — SIMPLIFIED ═══ */}
      <footer className="landing-footer">
        <div className="landing-footer-inner landing-footer-minimal">
          <div className="landing-footer-brand">
            <div className="landing-footer-brand-logo">
              <GlobeIcon size={14} className="landing-nav-logo-icon" />
            </div>
            wander<span className="landing-nav-accent">loop</span>
          </div>
          <div className="landing-footer-social">
            {['X', 'GH', 'IN'].map((label) => (
              <a href="#" className="landing-footer-social-link" key={label} aria-label={label}>{label}</a>
            ))}
          </div>
          <div className="landing-footer-copy">© 2025 Wanderloop</div>
        </div>
      </footer>

      {/* Saved Cloud Trips Modal */}
      <SavedTripsModal isOpen={isSavedTripsOpen} onClose={() => setIsSavedTripsOpen(false)} />
    </div>
  );
}

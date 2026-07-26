import { useState, useEffect, useRef } from 'react';
import { useTrip } from '../../context/TripContext';
import { useTheme } from '../../context/ThemeContext';

/* ═══════════════════════════════════════════════════
   QUESTIONNAIRE PAGE
   Step-by-step travel preference collection
   5 required + 1 optional freeform question
   ═══════════════════════════════════════════════════ */

const QUESTIONS = [
  {
    key: 'duration',
    question: 'How many days are you planning for?',
    subtitle: 'We\'ll optimize your route density based on this',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      </svg>
    ),
    type: 'single',
    options: ['3–4 days', '5–7 days', '8–10 days', '2+ weeks'],
  },
  {
    key: 'budget',
    question: 'What\'s your daily budget?',
    subtitle: 'Include lodging, food, and activities',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2v20M8 6h4a3 3 0 010 6H8M8 12h5a3 3 0 010 6H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    type: 'single',
    options: ['$30–50 (budget)', '$50–80 (moderate)', '$80–120 (comfort)', '$120+ (luxury)'],
  },
  {
    key: 'pace',
    question: 'What\'s your travel pace?',
    subtitle: 'This shapes how many stops we plan per day',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    type: 'single',
    options: ['Relaxed — 2–3 stops/day', 'Balanced — 3–4 stops/day', 'Packed — 5+ stops/day'],
  },
  {
    key: 'party',
    question: 'Who\'s traveling with you?',
    subtitle: 'We\'ll tailor activities for your group',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    type: 'single',
    options: ['Solo', 'Partner', 'Family with kids', 'Group of friends'],
  },
  {
    key: 'priority',
    question: 'What matters most on this trip?',
    subtitle: 'Pick all that apply — we\'ll prioritize your top interests',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    type: 'multi',
    options: ['Food & local culture', 'History & museums', 'Nature & outdoor', 'Nightlife & entertainment', 'Photography spots'],
  },
  {
    key: 'extra',
    question: 'Anything else we should know?',
    subtitle: 'Dietary needs, accessibility, specific places — totally optional',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    type: 'textarea',
    optional: true,
  },
];

const TOTAL_STEPS = QUESTIONS.length + 1; // +1 for summary card

/* ─── Animated Globe for Background ─── */
function FloatingOrbs() {
  return (
    <div className="questionnaire-orbs" aria-hidden="true">
      <div className="questionnaire-orb questionnaire-orb-1" />
      <div className="questionnaire-orb questionnaire-orb-2" />
      <div className="questionnaire-orb questionnaire-orb-3" />
    </div>
  );
}

/* ─── Chip Button ─── */
function ChipButton({ label, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      className={`questionnaire-chip ${selected ? 'questionnaire-chip-selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      {selected && (
        <svg className="questionnaire-chip-check" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label}
    </button>
  );
}

export default function QuestionnairePage() {
  const { state, dispatch } = useTrip();
  const { theme, setTheme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [direction, setDirection] = useState('forward'); // 'forward' | 'back'
  const [isAnimating, setIsAnimating] = useState(false);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  const isLastQuestion = currentStep === QUESTIONS.length - 1;
  const isSummary = currentStep === QUESTIONS.length;
  const currentQ = QUESTIONS[currentStep];
  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  // Focus textarea when it's the active step
  useEffect(() => {
    if (currentQ?.type === 'textarea' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 400);
    }
  }, [currentStep]);

  function handleSelect(key, value) {
    if (isAnimating) return;
    const q = QUESTIONS.find(q => q.key === key);
    if (q?.type === 'multi') {
      const current = answers[key] || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      setAnswers({ ...answers, [key]: updated });
    } else {
      setAnswers({ ...answers, [key]: value });
    }
  }

  function canProceed() {
    if (isSummary) return true;
    if (!currentQ) return false;
    if (currentQ.optional) return true;
    if (currentQ.type === 'multi') return (answers[currentQ.key] || []).length > 0;
    return !!answers[currentQ.key];
  }

  function goNext() {
    if (!canProceed() || isAnimating) return;
    setDirection('forward');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsAnimating(false);
    }, 300);
  }

  function goBack() {
    if (currentStep === 0 || isAnimating) return;
    setDirection('back');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev - 1);
      setIsAnimating(false);
    }, 300);
  }

  function handleBackToLanding() {
    dispatch({ type: 'COMPLETE_QUESTIONNAIRE', payload: '' });
  }

  function handleSubmit() {
    // Build enriched prompt from original + answers
    const parts = [state.questionnairePrompt];

    if (answers.duration) parts.push(`Duration: ${answers.duration}`);
    if (answers.budget) parts.push(`Budget: ${answers.budget}`);
    if (answers.pace) parts.push(`Pace: ${answers.pace}`);
    if (answers.party) parts.push(`Travelers: ${answers.party}`);
    if (answers.priority) {
      const priorities = Array.isArray(answers.priority) ? answers.priority.join(', ') : answers.priority;
      parts.push(`Priorities: ${priorities}`);
    }
    if (answers.extra?.trim()) parts.push(`Additional notes: ${answers.extra.trim()}`);

    const enrichedPrompt = parts.join('. ');

    // Dispatch to close questionnaire and start interview
    dispatch({ type: 'COMPLETE_QUESTIONNAIRE', payload: enrichedPrompt });
    dispatch({ type: 'START_INTERVIEW', payload: enrichedPrompt });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && canProceed()) {
      e.preventDefault();
      if (isSummary) handleSubmit();
      else goNext();
    }
  }

  // Summary data
  const summaryItems = QUESTIONS.filter(q => !q.optional || answers[q.key]).map(q => ({
    label: q.question.replace('?', ''),
    value: Array.isArray(answers[q.key]) ? answers[q.key].join(', ') : (answers[q.key] || '—'),
    key: q.key,
  }));

  return (
    <div
      ref={containerRef}
      className="questionnaire-root"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Background orbs */}
      <FloatingOrbs />

      {/* Grain overlay */}
      <div className="questionnaire-grain" aria-hidden="true" />

      {/* Top bar */}
      <header className="questionnaire-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="questionnaire-back-landing" onClick={handleBackToLanding} aria-label="Back to home">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="questionnaire-logo">
            <svg viewBox="0 0 32 32" width="18" height="18" fill="none">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
              <ellipse cx="16" cy="16" rx="6" ry="14" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 16h28" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="16" cy="16" r="2.5" fill="currentColor" />
            </svg>
            <span>wander<span className="questionnaire-logo-accent">loop</span></span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="questionnaire-step-counter hidden sm:block">
            {currentStep + 1} / {TOTAL_STEPS}
          </div>

          <button onClick={handleSubmit} className="questionnaire-header-submit">
            Submit
          </button>

          {/* Theme Switcher */}
          <div
            className="flex items-center gap-[2px] p-[2px] rounded-lg"
            style={{
              background: 'var(--surface-2, rgba(255,255,255,0.03))',
              border: '1px solid var(--border, rgba(255,255,255,0.06))',
              display: 'flex'
            }}
          >
            <button
              onClick={() => theme !== 'dark' && setTheme('dark')}
              className="w-8 h-8 rounded-[6px] grid place-items-center cursor-pointer"
              style={{
                background: theme === 'dark' ? 'var(--accent)' : 'transparent',
                color: theme === 'dark' ? 'var(--bg)' : 'var(--muted)',
                border: 'none',
                transition: 'all 0.3s'
              }}
              aria-label="Dark theme"
            >
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M13.5 9.5a6 6 0 01-7-7 6 6 0 107 7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              onClick={() => theme !== 'sunset' && setTheme('sunset')}
              className="w-8 h-8 rounded-[6px] grid place-items-center cursor-pointer"
              style={{
                background: theme === 'sunset' ? 'var(--accent)' : 'transparent',
                color: theme === 'sunset' ? 'var(--bg)' : 'var(--muted)',
                border: 'none',
                transition: 'all 0.3s'
              }}
              aria-label="Sunset theme"
            >
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="questionnaire-progress">
        <div className="questionnaire-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Question cards */}
      <main className="questionnaire-main">
        <div className={`questionnaire-card ${isAnimating ? (direction === 'forward' ? 'questionnaire-exit-left' : 'questionnaire-exit-right') : 'questionnaire-enter'}`}>
          {!isSummary ? (
            <>
              {/* Question icon */}
              <div className="questionnaire-icon">
                {currentQ.icon}
              </div>

              {/* Question text */}
              <h2 className="questionnaire-question">{currentQ.question}</h2>
              <p className="questionnaire-subtitle">{currentQ.subtitle}</p>

              {/* Answer options */}
              <div className="questionnaire-options">
                {currentQ.type === 'textarea' ? (
                  <textarea
                    ref={textareaRef}
                    className="questionnaire-textarea"
                    placeholder="e.g., I'm vegetarian, need wheelchair access, want to visit Fushimi Inari..."
                    value={answers[currentQ.key] || ''}
                    onChange={(e) => setAnswers({ ...answers, [currentQ.key]: e.target.value })}
                    rows={4}
                  />
                ) : (
                  <div className="questionnaire-chips">
                    {currentQ.options.map((opt) => {
                      const isSelected = currentQ.type === 'multi'
                        ? (answers[currentQ.key] || []).includes(opt)
                        : answers[currentQ.key] === opt;
                      return (
                        <ChipButton
                          key={opt}
                          label={opt}
                          selected={isSelected}
                          onClick={() => handleSelect(currentQ.key, opt)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="questionnaire-nav">
                {currentStep > 0 && (
                  <button className="questionnaire-btn-back" onClick={goBack} type="button">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                  </button>
                )}
                <div className="questionnaire-nav-spacer" />
                {currentQ.optional && (
                  <button className="questionnaire-btn-skip" onClick={goNext} type="button">
                    Skip
                  </button>
                )}
                <button
                  className="questionnaire-btn-next"
                  onClick={goNext}
                  disabled={!canProceed()}
                  type="button"
                >
                  {isLastQuestion ? 'Review' : 'Continue'}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            /* ─── Summary Card ─── */
            <>
              <div className="questionnaire-icon questionnaire-icon-summary">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="questionnaire-question">Everything looks good?</h2>
              <p className="questionnaire-subtitle">Review your preferences before we start planning</p>

              {/* Trip prompt display */}
              <div className="questionnaire-prompt-display">
                <div className="questionnaire-prompt-label">Your trip</div>
                <div className="questionnaire-prompt-text">{state.questionnairePrompt}</div>
              </div>

              {/* Summary grid */}
              <div className="questionnaire-summary-grid" >
                {summaryItems.map((item) => (
                  <div className="questionnaire-summary-item" key={item.key}>
                    <div className="questionnaire-summary-label">{item.label}</div>
                    <div className="questionnaire-summary-value">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Navigation */}
              <div className="questionnaire-nav">
                <button className="questionnaire-btn-back" onClick={goBack} type="button">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Edit answers
                </button>
                <div className="questionnaire-nav-spacer" />
                <button className="questionnaire-btn-submit" onClick={handleSubmit} type="button">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14m0 0l-7-7m7 7l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Start Planning
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Keyboard hint */}
      <footer className="questionnaire-footer">
        <span className="questionnaire-kbd">Enter ↵</span> to continue
      </footer>

      <style>{`
        /* ═══ ROOT ═══ */
        .questionnaire-root {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          flex-direction: column;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
          overflow: hidden;
          outline: none;
        }

        /* ═══ GRAIN ═══ */
        .questionnaire-grain {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px;
        }

        /* ═══ FLOATING ORBS ═══ */
        .questionnaire-orbs {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .questionnaire-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.12;
          animation: questionnaire-float 20s ease-in-out infinite;
        }
        .questionnaire-orb-1 {
          width: 500px;
          height: 500px;
          background: var(--accent);
          top: -15%;
          right: -10%;
          animation-delay: 0s;
        }
        .questionnaire-orb-2 {
          width: 400px;
          height: 400px;
          background: #c084fc;
          bottom: -10%;
          left: -8%;
          animation-delay: -7s;
        }
        .questionnaire-orb-3 {
          width: 300px;
          height: 300px;
          background: #f59e0b;
          top: 40%;
          left: 50%;
          animation-delay: -14s;
          opacity: 0.06;
        }
        @keyframes questionnaire-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }

        /* ═══ HEADER ═══ */
        .questionnaire-header {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          flex-shrink: 0;
        }
        .questionnaire-back-landing {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .questionnaire-back-landing:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-dim);
        }
        .questionnaire-logo {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: var(--text);
        }
        .questionnaire-logo svg {
          color: var(--accent);
        }
        .questionnaire-logo-accent {
          color: var(--accent);
        }
        .questionnaire-step-counter {
          font-size: 12px;
          font-family: var(--font-mono, monospace);
          font-weight: 500;
          color: var(--muted);
          padding: 4px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 999px;
        }
        .questionnaire-header-submit {
          padding: 6px 14px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
          cursor: pointer;
          transition: all 0.2s;
        }
        .questionnaire-header-submit:hover {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--bg);
        }

        /* ═══ PROGRESS BAR ═══ */
        .questionnaire-progress {
          position: relative;
          z-index: 2;
          height: 3px;
          background: var(--border);
          flex-shrink: 0;
        }
        .questionnaire-progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 0 99px 99px 0;
          transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 0 12px var(--accent-glow);
        }

        /* ═══ MAIN ═══ */
        .questionnaire-main {
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 24px;
          position: relative;
          z-index: 1;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }

        /* ═══ CARD ═══ */
        .questionnaire-card {
          width: 100%;
          max-width: 540px;
          margin: auto 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding-top: 12px;
          padding-bottom: 12px;
        }

        /* Card animations */
        .questionnaire-enter {
          animation: q-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .questionnaire-exit-left {
          animation: q-exit-left 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
        }
        .questionnaire-exit-right {
          animation: q-exit-right 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
        }
        @keyframes q-enter {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes q-exit-left {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(-40px); }
        }
        @keyframes q-exit-right {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(40px); }
        }

        /* ═══ ICON ═══ */
        .questionnaire-icon {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          background: var(--accent-dim);
          border: 1.5px solid var(--accent-border);
          display: grid;
          place-items: center;
          color: var(--accent);
          margin-bottom: 24px;
          box-shadow: 0 0 20px var(--accent-glow);
          animation: q-icon-pulse 3s ease-in-out infinite;
        }
        .questionnaire-icon-summary {
          background: linear-gradient(135deg, var(--accent-dim), rgba(192, 132, 252, 0.08));
          border-color: var(--accent-border);
        }
        @keyframes q-icon-pulse {
          0%, 100% { box-shadow: 0 0 20px var(--accent-glow); }
          50% { box-shadow: 0 0 30px var(--accent-glow-strong); }
        }

        /* ═══ TEXT ═══ */
        .questionnaire-question {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.3;
          margin-bottom: 8px;
          color: var(--text);
        }
        .questionnaire-subtitle {
          font-size: 14px;
          color: var(--muted);
          line-height: 1.5;
          max-width: 400px;
          margin-bottom: 32px;
        }

        /* ═══ OPTIONS AREA ═══ */
        .questionnaire-options {
          width: 100%;
          margin-bottom: 32px;
        }

        /* ═══ CHIPS ═══ */
        .questionnaire-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }
        .questionnaire-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 12px 20px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: 12px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
        }
        .questionnaire-chip:hover {
          border-color: var(--accent-border);
          background: var(--surface-2);
          transform: translateY(-1px);
        }
        .questionnaire-chip:active {
          transform: scale(0.97);
        }
        .questionnaire-chip-selected {
          background: var(--accent-dim) !important;
          border-color: var(--accent) !important;
          color: var(--accent) !important;
          box-shadow: 0 0 16px var(--accent-glow);
        }
        .questionnaire-chip-check {
          color: var(--accent);
          flex-shrink: 0;
        }

        /* ═══ TEXTAREA ═══ */
        .questionnaire-textarea {
          width: 100%;
          padding: 16px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: 14px;
          font-family: inherit;
          font-size: 14px;
          color: var(--text);
          resize: none;
          outline: none;
          line-height: 1.6;
          min-height: 120px;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .questionnaire-textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }
        .questionnaire-textarea::placeholder {
          color: var(--muted);
          opacity: 0.6;
        }

        /* ═══ NAVIGATION ═══ */
        .questionnaire-nav {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          max-width: 480px;
        }
        .questionnaire-nav-spacer {
          flex: 1;
        }
        .questionnaire-btn-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.25s;
        }
        .questionnaire-btn-back:hover {
          border-color: var(--text);
          color: var(--text);
        }
        .questionnaire-btn-skip {
          padding: 10px 18px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.25s;
        }
        .questionnaire-btn-skip:hover {
          color: var(--text);
          border-color: var(--text);
        }
        .questionnaire-btn-next {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 22px;
          background: var(--accent);
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: var(--bg);
          cursor: pointer;
          transition: all 0.25s;
          box-shadow: 0 2px 12px var(--accent-glow);
        }
        .questionnaire-btn-next:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 20px var(--accent-glow-strong);
        }
        .questionnaire-btn-next:active:not(:disabled) {
          transform: scale(0.97);
        }
        .questionnaire-btn-next:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          box-shadow: none;
        }
        .questionnaire-btn-submit {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 28px;
          background: var(--accent);
          border: none;
          border-radius: 12px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          color: var(--bg);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 20px var(--accent-glow-strong);
        }
        .questionnaire-btn-submit:hover {
          background: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px var(--accent-glow-strong);
        }
        .questionnaire-btn-submit:active {
          transform: scale(0.97);
        }

        /* ═══ SUMMARY ═══ */
        .questionnaire-prompt-display {
          width: 100%;
          margin-bottom: 20px;
          padding: 14px 18px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          text-align: left;
        }
        .questionnaire-prompt-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--accent);
          margin-bottom: 6px;
          font-family: var(--font-mono, monospace);
        }
        .questionnaire-prompt-text {
          font-size: 14px;
          color: var(--text);
          line-height: 1.5;
        }
        .questionnaire-summary-grid {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 28px;
        }
        .questionnaire-summary-item {
          padding: 12px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          text-align: left;
          transition: border-color 0.2s;
        }
        .questionnaire-summary-item:hover {
          border-color: var(--accent-border);
        }
        .questionnaire-summary-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .questionnaire-summary-value {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          line-height: 1.4;
        }

        /* ═══ FOOTER ═══ */
        .questionnaire-footer {
          position: relative;
          z-index: 2;
          padding: 12px 24px 20px;
          text-align: center;
          font-size: 12px;
          color: var(--muted);
          flex-shrink: 0;
          opacity: 0.6;
        }
        .questionnaire-kbd {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 5px;
          font-size: 11px;
          font-family: var(--font-mono, monospace);
          font-weight: 500;
          color: var(--muted);
          margin-right: 4px;
        }

        /* ═══ MOBILE ═══ */
        @media (max-width: 640px) {
          .questionnaire-header {
            padding: 12px 16px;
          }
          .questionnaire-main {
            padding: 16px;
          }
          .questionnaire-question {
            font-size: 20px;
          }
          .questionnaire-subtitle {
            font-size: 13px;
            margin-bottom: 24px;
          }
          .questionnaire-chip {
            padding: 10px 16px;
            font-size: 13px;
          }
          .questionnaire-summary-grid {
            grid-template-columns: 1fr;
          }
          .questionnaire-footer {
            display: none;
          }
          .questionnaire-icon {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            margin-bottom: 20px;
          }
          .questionnaire-icon svg {
            width: 24px;
            height: 24px;
          }
        }

        /* ═══ REDUCED MOTION ═══ */
        @media (prefers-reduced-motion: reduce) {
          .questionnaire-enter,
          .questionnaire-exit-left,
          .questionnaire-exit-right {
            animation: none !important;
          }
          .questionnaire-orb {
            animation: none !important;
          }
          .questionnaire-icon {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Reusable skeleton loader components for the landing page.
 * Uses the existing `.shimmer` class from index.css.
 */

export function SkeletonCard({ className = '' }) {
  return (
    <div
      className={`rounded-3xl overflow-hidden ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: '32px',
      }}
    >
      {/* Icon placeholder */}
      <div
        className="shimmer"
        style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 20 }}
      />
      {/* Title */}
      <div
        className="shimmer"
        style={{ width: '60%', height: 18, marginBottom: 10 }}
      />
      {/* Description lines */}
      <div
        className="shimmer"
        style={{ width: '100%', height: 12, marginBottom: 6 }}
      />
      <div
        className="shimmer"
        style={{ width: '85%', height: 12, marginBottom: 6 }}
      />
      <div className="shimmer" style={{ width: '70%', height: 12 }} />
    </div>
  );
}

export function SkeletonText({ width = '100%', height = 14, className = '' }) {
  return (
    <div
      className={`shimmer ${className}`}
      style={{ width, height, borderRadius: 6 }}
    />
  );
}

export function SkeletonAvatar({ size = 40 }) {
  return (
    <div
      className="shimmer"
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
    />
  );
}

export function SkeletonMockup({ className = '' }) {
  return (
    <div
      className={`rounded-3xl overflow-hidden ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 18px',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          className="shimmer"
          style={{ width: 10, height: 10, borderRadius: '50%' }}
        />
        <div
          className="shimmer"
          style={{ width: 10, height: 10, borderRadius: '50%' }}
        />
        <div
          className="shimmer"
          style={{ width: 10, height: 10, borderRadius: '50%' }}
        />
        <div
          className="shimmer"
          style={{
            flex: 1,
            height: 16,
            borderRadius: 6,
            margin: '0 40px',
          }}
        />
      </div>
      {/* Content panels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '0.8fr 1.4fr 0.8fr',
          gap: 12,
          padding: 16,
          minHeight: 280,
        }}
      >
        <div
          className="shimmer"
          style={{ borderRadius: 12, minHeight: 250 }}
        />
        <div
          className="shimmer"
          style={{ borderRadius: 12, minHeight: 250 }}
        />
        <div
          className="shimmer"
          style={{ borderRadius: 12, minHeight: 250 }}
        />
      </div>
    </div>
  );
}

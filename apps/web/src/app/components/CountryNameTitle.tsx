"use client";

interface CountryNameTitleProps {
  name: string;
  exiting?: boolean;
}

export default function CountryNameTitle({
  name,
  exiting = false,
}: CountryNameTitleProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[99990] flex items-center justify-center"
    >
      <style>{`
        .country-name-title {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 0 24px;
          text-align: center;
          animation: country-name-in 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .country-name-title.is-exiting {
          animation: country-name-out 420ms ease-in forwards;
        }
        .country-name-title__text {
          margin: 0;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
          font-size: clamp(2.4rem, 7vw, 4.5rem);
          font-weight: 700;
          letter-spacing: 0.04em;
          line-height: 1.05;
          color: #ffffff;
          text-shadow:
            0 2px 4px rgba(0, 0, 0, 0.35),
            0 8px 28px rgba(0, 0, 0, 0.45);
          text-wrap: balance;
        }
        .country-name-title__rule {
          display: block;
          height: 3px;
          width: min(42vw, 220px);
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, #fbbf24 20%, #f59e0b 50%, #fbbf24 80%, transparent);
          transform-origin: center;
          animation: country-name-rule 560ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
        }
        .country-name-title.is-exiting .country-name-title__rule {
          animation: country-name-rule-out 360ms ease-in forwards;
        }
        @keyframes country-name-in {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(12px);
            letter-spacing: 0.18em;
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
            letter-spacing: 0.04em;
          }
        }
        @keyframes country-name-out {
          from {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          to {
            opacity: 0;
            transform: scale(0.96) translateY(-8px);
          }
        }
        @keyframes country-name-rule {
          from {
            opacity: 0;
            transform: scaleX(0.15);
          }
          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }
        @keyframes country-name-rule-out {
          from {
            opacity: 1;
            transform: scaleX(1);
          }
          to {
            opacity: 0;
            transform: scaleX(0.2);
          }
        }
      `}</style>
      <div
        key={name}
        className={`country-name-title${exiting ? " is-exiting" : ""}`}
      >
        <p className="country-name-title__text">{name}</p>
        <span className="country-name-title__rule" />
      </div>
    </div>
  );
}

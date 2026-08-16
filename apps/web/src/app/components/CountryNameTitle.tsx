"use client";

import type { TitleStyleId } from "../lib/animations/titleStyles";

interface CountryNameTitleProps {
  name: string;
  style: TitleStyleId;
  exiting?: boolean;
}

const TYPEWRITER_CHAR_MS = 28;

export default function CountryNameTitle({
  name,
  style,
  exiting = false,
}: CountryNameTitleProps) {
  const chars = Array.from(name);

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
          display: none;
          height: 3px;
          width: min(42vw, 220px);
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, #fbbf24 20%, #f59e0b 50%, #fbbf24 80%, transparent);
          transform-origin: center;
        }
        .country-name-title__char {
          display: inline-block;
          white-space: pre;
        }

        /* —— Pop + underline —— */
        .country-name-title--pop {
          animation: cnt-pop-in 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .country-name-title--pop.is-exiting {
          animation: cnt-pop-out 420ms ease-in forwards;
        }
        .country-name-title--pop .country-name-title__rule {
          display: block;
          animation: cnt-rule-in 560ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
        }
        .country-name-title--pop.is-exiting .country-name-title__rule {
          animation: cnt-rule-out 360ms ease-in forwards;
        }

        /* —— Rise up —— */
        .country-name-title--rise {
          animation: cnt-rise-in 560ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .country-name-title--rise.is-exiting {
          animation: cnt-rise-out 400ms ease-in forwards;
        }

        /* —— Soft focus —— */
        .country-name-title--blur {
          animation: cnt-blur-in 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .country-name-title--blur.is-exiting {
          animation: cnt-blur-out 400ms ease-in forwards;
        }

        /* —— Typewriter —— */
        .country-name-title--typewriter .country-name-title__char {
          opacity: 0;
          animation: cnt-char-in 180ms ease-out forwards;
        }
        .country-name-title--typewriter.is-exiting {
          animation: cnt-fade-out 360ms ease-in forwards;
        }

        /* —— Slam —— */
        .country-name-title--slam {
          animation: cnt-slam-in 540ms cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        .country-name-title--slam.is-exiting {
          animation: cnt-slam-out 380ms ease-in forwards;
        }

        @keyframes cnt-pop-in {
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
        @keyframes cnt-pop-out {
          from {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          to {
            opacity: 0;
            transform: scale(0.96) translateY(-8px);
          }
        }
        @keyframes cnt-rule-in {
          from {
            opacity: 0;
            transform: scaleX(0.15);
          }
          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }
        @keyframes cnt-rule-out {
          from {
            opacity: 1;
            transform: scaleX(1);
          }
          to {
            opacity: 0;
            transform: scaleX(0.2);
          }
        }
        @keyframes cnt-rise-in {
          from {
            opacity: 0;
            transform: translateY(48px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes cnt-rise-out {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-36px);
          }
        }
        @keyframes cnt-blur-in {
          from {
            opacity: 0;
            filter: blur(14px);
            transform: scale(1.04);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: scale(1);
          }
        }
        @keyframes cnt-blur-out {
          from {
            opacity: 1;
            filter: blur(0);
          }
          to {
            opacity: 0;
            filter: blur(10px);
          }
        }
        @keyframes cnt-char-in {
          from {
            opacity: 0;
            transform: translateY(0.35em);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes cnt-fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes cnt-slam-in {
          0% {
            opacity: 0;
            transform: scale(1.55);
          }
          70% {
            opacity: 1;
            transform: scale(0.94);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes cnt-slam-out {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(1.12);
          }
        }
      `}</style>
      <div
        key={`${name}-${style}`}
        className={`country-name-title country-name-title--${style}${
          exiting ? " is-exiting" : ""
        }`}
      >
        <p className="country-name-title__text">
          {style === "typewriter"
            ? chars.map((char, i) => (
                <span
                  key={`${i}-${char}`}
                  className="country-name-title__char"
                  style={{
                    animationDelay: exiting
                      ? "0ms"
                      : `${i * TYPEWRITER_CHAR_MS}ms`,
                  }}
                >
                  {char}
                </span>
              ))
            : name}
        </p>
        {style === "pop" && <span className="country-name-title__rule" />}
      </div>
    </div>
  );
}

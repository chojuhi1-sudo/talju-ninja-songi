import React from 'react';

export function NormalSnowflakeSvg({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g stroke="#003087" strokeWidth="2.8" strokeLinecap="round">
        <line x1="12" y1="2.2" x2="12" y2="21.8" />
        <line x1="3.5" y1="7.1" x2="20.5" y2="16.9" />
        <line x1="20.5" y1="7.1" x2="3.5" y2="16.9" />
      </g>
      <g stroke="#BAE6FD" strokeWidth="1.7" strokeLinecap="round">
        <line x1="12" y1="2.8" x2="12" y2="21.2" />
        <line x1="4.0" y1="7.4" x2="20.0" y2="16.6" />
        <line x1="20.0" y1="7.4" x2="4.0" y2="16.6" />
        <path d="M9.3 5.2 L12 7.5 L14.7 5.2" fill="none" />
        <path d="M9.3 18.8 L12 16.5 L14.7 18.8" fill="none" />
      </g>
      <circle cx="12" cy="12" r="2.6" fill="#FFFFFF" stroke="#003087" strokeWidth="1.1" />
    </svg>
  );
}

export function GoldenSnowflakeSvg({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g stroke="#78350F" strokeWidth="2.9" strokeLinecap="round">
        <line x1="12" y1="2.0" x2="12" y2="22.0" />
        <line x1="3.3" y1="7.0" x2="20.7" y2="17.0" />
        <line x1="20.7" y1="7.0" x2="3.3" y2="17.0" />
      </g>
      <g stroke="#FDE047" strokeWidth="1.85" strokeLinecap="round">
        <line x1="12" y1="2.6" x2="12" y2="21.4" />
        <line x1="3.9" y1="7.3" x2="20.1" y2="16.7" />
        <line x1="20.1" y1="7.3" x2="3.9" y2="16.7" />
        <path d="M9.1 5.0 L12 7.5 L14.9 5.0" fill="none" />
        <path d="M9.1 19.0 L12 16.5 L14.9 19.0" fill="none" />
      </g>
      <polygon
        points="12,8.1 13.5,10.5 15.9,12 13.5,13.5 12,15.9 10.5,13.5 8.1,12 10.5,10.5"
        fill="#FFFBEB"
        stroke="#B45309"
        strokeWidth="0.95"
      />
    </svg>
  );
}

/**
 * Musical note icon for Background Music (배경음) toggle
 */
export function BgmNoteIconSvg({
  muted,
  className = 'w-5 h-5',
}: {
  muted: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M9 17.5V6.2L19 4.2V15.5"
        stroke={muted ? '#94A3B8' : '#7DD3FC'}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 9.2L19 7.2"
        stroke={muted ? '#64748B' : '#38BDF8'}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="6.5"
        cy="17.8"
        r="3.1"
        fill={muted ? '#64748B' : '#FDE047'}
        stroke="#071438"
        strokeWidth="1.4"
      />
      <circle
        cx="16.5"
        cy="15.8"
        r="3.1"
        fill={muted ? '#64748B' : '#BAE6FD'}
        stroke="#071438"
        strokeWidth="1.4"
      />
      {muted && (
        <path
          d="M4 4L20 20"
          stroke="#FCA5A5"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/**
 * Speaker icon for Sound Effects (효과음) toggle
 */
export function SoundIconSvg({
  muted,
  className = 'w-5 h-5',
}: {
  muted: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M11 5L6.5 9H3V15H6.5L11 19V5Z"
        fill={muted ? '#64748B' : '#E0F2FE'}
        stroke="#071438"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="M16 9L21 15M21 9L16 15"
          stroke="#FCA5A5"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path
            d="M15.2 8.8C16.4 9.8 17 10.9 17 12C17 13.1 16.4 14.2 15.2 15.2"
            stroke="#7DD3FC"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M18.2 6.3C20.1 7.9 21 9.8 21 12C21 14.2 20.1 16.1 18.2 17.7"
            stroke="#FDE047"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export function PauseIconSvg({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect
        x="6"
        y="5"
        width="4.2"
        height="14"
        rx="1.4"
        fill="#E0F2FE"
        stroke="#071438"
        strokeWidth="1.4"
      />
      <rect
        x="13.8"
        y="5"
        width="4.2"
        height="14"
        rx="1.4"
        fill="#E0F2FE"
        stroke="#071438"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/**
 * Mini Chubby Ninja Songi face marker for the bottom Gogunbuntu-style course progress bar!
 * Matches the newly attached chubby Songi design (blue snowflower crown, headband with snowflower crest, mask & determined eyes).
 */
export function MiniChubbySongiHeadSvg({
  failed = false,
  className = 'w-8 h-8',
}: {
  failed?: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      {/* Snowflower 3 upper crown tips */}
      <path
        d="M18 2 L22.5 8.5 L20.5 11.5 L27 8.5 L30.5 12.5 L26 18 L28 24 L23 29.5 L13 29.5 L8 24 L10 18 L5.5 12.5 L9 8.5 L15.5 11.5 L13.5 8.5 Z"
        fill="#0A2463"
        stroke="#E0F2FE"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Headband tail ribbons on left */}
      <path
        d="M8 16 L2.5 14.5 L4.5 17.5 L2.5 20.5 L8.5 18.8 Z"
        fill="#2563EB"
        stroke="#071438"
        strokeWidth="1.1"
      />
      {/* White face window */}
      <ellipse cx="18.5" cy="19.8" rx="8.2" ry="6.4" fill="#FFFFFF" />
      {/* Royal blue ninja headband */}
      <path
        d="M10.2 16.5 Q18.5 13.5 26.8 16.5 L26.5 19.2 Q18.5 16.6 10.5 19.2 Z"
        fill="#1D4ED8"
        stroke="#071438"
        strokeWidth="1.1"
      />
      {/* Snowflower crest on headband */}
      <circle cx="19" cy="16.5" r="2.3" fill="#BAE6FD" stroke="#071438" strokeWidth="0.8" />
      {/* Dark navy ninja lower face mask */}
      <path
        d="M10.4 21.8 Q18.5 23.5 26.6 21.8 Q25.8 28.5 18.5 28.8 Q11.2 28.5 10.4 21.8 Z"
        fill="#0B1D51"
      />
      {/* Eyes (determined cute eyes, or >< when failed) */}
      {failed ? (
        <g stroke="#071438" strokeWidth="1.6" strokeLinecap="round">
          <path d="M14.2 19.2 L16.6 20.4 L14.2 21.5" fill="none" />
          <path d="M23.2 19.2 L20.8 20.4 L23.2 21.5" fill="none" />
        </g>
      ) : (
        <>
          <ellipse cx="15.8" cy="20.2" rx="1.25" ry="1.75" fill="#071438" />
          <ellipse cx="21.6" cy="20.2" rx="1.25" ry="1.75" fill="#071438" />
        </>
      )}
      {/* Sky-blue scarf collar hint */}
      <path
        d="M12.5 28.2 Q18.5 30.8 24.5 28.2"
        stroke="#7DD3FC"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Bespoke world-matched inline SVG Title Lockup for 「탈주닌자송이」
 */
export function TitleEmblemSvg() {
  return (
    <svg
      viewBox="0 0 560 132"
      className="w-full max-w-[500px] h-auto select-none drop-shadow-[0_8px_18px_rgba(4,10,30,0.65)]"
      role="img"
      aria-label="탈주닌자송이 타이틀 로고"
    >
      {/* Decorative ninja snowflower shuriken crest on left */}
      <g transform="translate(68, 66)">
        <circle cx="0" cy="0" r="44" fill="#071438" fillOpacity="0.86" stroke="#38BDF8" strokeWidth="2.2" />
        <g stroke="#7DD3FC" strokeWidth="3.2" strokeLinecap="round">
          <line x1="0" y1="-32" x2="0" y2="32" />
          <line x1="-27.7" y1="-16" x2="27.7" y2="16" />
          <line x1="27.7" y1="-16" x2="-27.7" y2="16" />
        </g>
        <polygon
          points="0,-20 6,-6 20,0 6,6 0,20 -6,6 -20,0 -6,-6"
          fill="#003087"
          stroke="#FDE047"
          strokeWidth="2.2"
        />
        <circle cx="0" cy="0" r="5" fill="#FFFBEB" />
      </g>

      {/* Scarf ribbon accent bar */}
      <path
        d="M126 98 L496 98 L512 106 L490 106 L126 104 Z"
        fill="#38BDF8"
        fillOpacity="0.9"
      />
      <circle cx="522" cy="102" r="4" fill="#FDE047" />

      {/* Main Korean Title Lockup with crisp navy stroke */}
      <text
        x="128"
        y="80"
        fontFamily="'Noto Sans KR', sans-serif"
        fontSize="62"
        fontWeight="800"
        letterSpacing="-1.5"
        fill="#FFFFFF"
        stroke="#061233"
        strokeWidth="10"
        paintOrder="stroke fill"
      >
        탈주닌자
        <tspan fill="#7DD3FC">송이</tspan>
      </text>

      {/* Small golden moon/star accent above '송이' */}
      <polygon
        points="512,26 515,34 523,37 515,40 512,48 509,40 501,37 509,34"
        fill="#FDE047"
      />
    </svg>
  );
}

/**
 * Cute Meokbabi Cat Paw-Print Stamp SVG for the Snowflower Invitation & 80%+ Bonus Ending
 */
export function CatPawStampSvg({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <circle
        cx="14"
        cy="14"
        r="12.5"
        fill="#FFF1F2"
        fillOpacity="0.16"
        stroke="#FDA4AF"
        strokeWidth="1.5"
        strokeDasharray="2.5 1.8"
      />
      {/* Main paw pad */}
      <path
        d="M9.4 17.8 C9.4 14.8 11.5 13.2 14 13.2 C16.5 13.2 18.6 14.8 18.6 17.8 C18.6 19.8 17.0 20.8 15.5 20.4 C14.6 20.1 13.4 20.1 12.5 20.4 C11.0 20.8 9.4 19.8 9.4 17.8 Z"
        fill="#FB7185"
      />
      {/* Four toe beans */}
      <ellipse cx="8.6" cy="12.2" rx="1.85" ry="2.35" transform="rotate(-22 8.6 12.2)" fill="#FB7185" />
      <ellipse cx="12.0" cy="9.6" rx="1.85" ry="2.45" transform="rotate(-7 12.0 9.6)" fill="#FB7185" />
      <ellipse cx="16.0" cy="9.6" rx="1.85" ry="2.45" transform="rotate(7 16.0 9.6)" fill="#FB7185" />
      <ellipse cx="19.4" cy="12.2" rx="1.85" ry="2.35" transform="rotate(22 19.4 12.2)" fill="#FB7185" />
    </svg>
  );
}

/**
 * Commemorative Badge SVG for >= 80% Snowflake Collection (「눈꽃 배달 완료」)
 */
export function SnowflowerDeliveryBadgeSvg({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <circle
        cx="18"
        cy="18"
        r="16"
        fill="#0A2463"
        stroke="#FDE047"
        strokeWidth="2.2"
      />
      <circle
        cx="18"
        cy="18"
        r="12.8"
        fill="#003087"
        stroke="#7DD3FC"
        strokeWidth="1.1"
      />
      {/* Glowing snowflower rays */}
      <g stroke="#FDE047" strokeWidth="2.1" strokeLinecap="round">
        <line x1="18" y1="7.5" x2="18" y2="28.5" />
        <line x1="8.9" y1="12.75" x2="27.1" y2="23.25" />
        <line x1="27.1" y1="12.75" x2="8.9" y2="23.25" />
      </g>
      {/* Center mini paw heart */}
      <circle cx="18" cy="18" r="4.6" fill="#FFFBEB" stroke="#B45309" strokeWidth="1" />
      <circle cx="18" cy="18.8" r="1.9" fill="#FB7185" />
      <circle cx="16.3" cy="16.6" r="0.85" fill="#FB7185" />
      <circle cx="18" cy="16.1" r="0.85" fill="#FB7185" />
      <circle cx="19.7" cy="16.6" r="0.85" fill="#FB7185" />
    </svg>
  );
}

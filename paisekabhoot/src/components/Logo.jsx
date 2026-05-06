// Reusable paisekabhoot.com logo component
// size prop controls the icon size in px (default 40)
export default function Logo({ size = 40, showText = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: size,
        height: size,
        background: '#1a3a2a',
        borderRadius: Math.round(size * 0.24),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L3 7v5c0 5.25 3.8 10.15 9 11.35C17.2 22.15 21 17.25 21 12V7L12 2z"
            fill="#3ecf8e"
            opacity="0.25"
          />
          <path
            d="M8 11l3 3 5-5"
            stroke="#3ecf8e"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="17" cy="6" r="3.5" fill="#1a3a2a" stroke="#3ecf8e" strokeWidth="1.2" />
          <text
            x="17"
            y="9.5"
            textAnchor="middle"
            fontSize="5"
            fill="#3ecf8e"
            fontWeight="700"
          >
            ₹
          </text>
        </svg>
      </div>
      {showText && (
        <div>
          <div style={{
            fontSize: Math.round(size * 0.38),
            fontWeight: 500,
            color: '#ffffff',
            letterSpacing: '-0.3px',
            lineHeight: 1.1,
          }}>
            paise<span style={{ color: '#3ecf8e' }}>kabhoot</span>.com
          </div>
          <div style={{
            fontSize: Math.round(size * 0.25),
            color: '#4a5568',
            marginTop: 2,
          }}>
            smart money, real returns
          </div>
        </div>
      )}
    </div>
  )
}

export default function Logo() {
    return (
        <div
            style={{
                position: 'absolute',
                top: 14,
                left: 14,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}
        >
            {/* Brand Name */}
            <span
                style={{
                    fontWeight: 700,
                    fontSize: '1.6rem',
                    letterSpacing: '-0.02em',
                    fontFamily: 'cursive',
                }}
                className="text-dark"
            >
                Green
                <span 
                    style={{ 
                        fontFamily: '"Dancing Script", cursive',
                        fontSize: '1.999rem',
                    }}
                    className="text-primary"
                >
                    Lens
                </span>
            </span>
        </div>
    )
}
import React from 'react';
import { Phone, PhoneCall } from 'lucide-react';

interface PhoneButtonProps {
    phone: string;
    onClick?: (phone: string) => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'accent';
    size?: 'small' | 'medium' | 'large';
    showIcon?: boolean;
    className?: string;
}

interface PhoneButtonsGridProps {
    phones: (string | null | undefined)[];
    onPhoneClick?: (phone: string) => void;
    maxColumns?: number;
    variant?: 'primary' | 'secondary' | 'accent';
    size?: 'small' | 'medium' | 'large';
    className?: string;
}

export const PhoneButton: React.FC<PhoneButtonProps> = ({
    phone,
    onClick,
    disabled = false,
    variant = 'accent',
    size = 'medium',
    showIcon = true,
    className = ''
}) => {
    if (!phone || phone.trim() === '') {
        return null;
    }

    const formatPhone = (phone: string): string => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length <= 6) return cleaned;
        if (cleaned.length <= 10) {
            return cleaned.replace(/(\d{3})(\d{3})(\d+)/, '$1-$2-$3');
        }
        // Format Russian phone numbers
        if (cleaned.startsWith('7') || cleaned.startsWith('8')) {
            return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/, '+$1 $2 $3-$4-$5');
        }
        return cleaned.replace(/(\d{1,3})(\d{3})(\d{3})(\d+)/, '+$1 $2 $3-$4');
    };

    const handleClick = () => {
        if (!disabled && onClick) {
            onClick(phone);
        }
    };

    const sizeMap = {
        small: {
            minWidth: '40px',
            minHeight: '36px',
            padding: '6px 8px',
            fontSize: '11px',
            iconSize: 12
        },
        medium: {
            minWidth: '50px',
            minHeight: '44px',
            padding: '8px 12px',
            fontSize: '13px',
            iconSize: 14
        },
        large: {
            minWidth: '60px',
            minHeight: '48px',
            padding: '10px 16px',
            fontSize: '14px',
            iconSize: 16
        }
    };

    const variantMap = {
        primary: {
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
            hoverBackground: 'var(--color-accent-hover)'
        },
        secondary: {
            background: 'var(--color-bg-light)',
            color: 'var(--color-text-main)',
            hoverBackground: 'var(--color-hover-dark)'
        },
        accent: {
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
            hoverBackground: 'var(--color-accent-hover)'
        }
    };

    const sizeConfig = sizeMap[size];
    const variantConfig = variantMap[variant];

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            className={`phone-btn phone-btn-${variant} phone-btn-${size} ${className}`}
            style={{
                minWidth: sizeConfig.minWidth,
                minHeight: sizeConfig.minHeight,
                padding: sizeConfig.padding,
                fontSize: sizeConfig.fontSize,
                fontWeight: 600,
                border: 'none',
                borderRadius: '8px',
                background: disabled ? 'var(--color-border)' : variantConfig.background,
                color: disabled ? 'var(--color-text-second)' : variantConfig.color,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: showIcon ? '4px' : '0',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
                if (!disabled) {
                    e.currentTarget.style.background = variantConfig.hoverBackground;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                }
            }}
            onMouseLeave={(e) => {
                if (!disabled) {
                    e.currentTarget.style.background = variantConfig.background;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                }
            }}
            title={`Позвонить: ${formatPhone(phone)}`}
        >
            {showIcon && <PhoneCall size={sizeConfig.iconSize} />}
            <span>{formatPhone(phone)}</span>
        </button>
    );
};

export const PhoneButtonsGrid: React.FC<PhoneButtonsGridProps> = ({
    phones,
    onPhoneClick,
    maxColumns = 4,
    variant = 'accent',
    size = 'medium',
    className = ''
}) => {
    const validPhones = phones.filter((phone) => phone && phone.trim() !== '');
    
    if (validPhones.length === 0) {
        return null;
    }

    // Responsive grid columns based on screen size and number of phones
    const getGridColumns = () => {
        const phoneCount = validPhones.length;
        if (window.innerWidth < 480) {
            // Very small screens - max 2 columns
            return Math.min(phoneCount, 2);
        } else if (window.innerWidth < 768) {
            // Mobile screens - max 3 columns
            return Math.min(phoneCount, 3);
        } else if (window.innerWidth < 1024) {
            // Tablet screens - max 4 columns
            return Math.min(phoneCount, maxColumns);
        } else {
            // Desktop screens - use maxColumns
            return Math.min(phoneCount, maxColumns);
        }
    };

    const gridColumns = getGridColumns();

    return (
        <div
            className={`phone-buttons-grid ${className}`}
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                gap: window.innerWidth < 480 ? '6px' : window.innerWidth < 768 ? '8px' : '10px',
                width: '100%',
                maxWidth: '100%'
            }}
        >
            {validPhones.map((phone, index) => (
                <PhoneButton
                    key={`${phone}-${index}`}
                    phone={phone!}
                    onClick={onPhoneClick}
                    variant={variant}
                    size={size}
                    showIcon={window.innerWidth >= 480} // Hide icons on very small screens
                />
            ))}
        </div>
    );
};

// Hook for responsive phone button behavior
export const usePhoneButtons = () => {
    const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);

    React.useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getOptimalSize = (): 'small' | 'medium' | 'large' => {
        if (windowWidth < 480) return 'small';
        if (windowWidth < 768) return 'medium';
        return 'medium';
    };

    const getMaxColumns = (): number => {
        if (windowWidth < 480) return 2;
        if (windowWidth < 768) return 3;
        if (windowWidth < 1024) return 4;
        return 6;
    };

    return {
        isMobile: windowWidth < 768,
        isVerySmall: windowWidth < 480,
        optimalSize: getOptimalSize(),
        maxColumns: getMaxColumns()
    };
};

export default PhoneButton;
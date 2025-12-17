import React from 'react';
import {
    CheckCircle2,
    PhoneMissed,
    Voicemail,
    Bot,
    AlertCircle,
    UserX,
    PhoneForwarded,
    UserPlus,
    Clock,
    ArrowRightCircle
} from 'lucide-react';

interface StatusButton {
    status: string;
    color: string;
    action: 'set-status' | 'callback' | 'transfer';
    icon?: React.ElementType;
    label?: string;
}

interface StatusButtonsProps {
    buttons: StatusButton[];
    onStatusClick: (status: string, action: StatusButton['action']) => void;
    disabled?: boolean;
    maxColumns?: number;
    size?: 'small' | 'medium' | 'large';
    showIcons?: boolean;
    className?: string;
}

const DEFAULT_STATUS_ICONS: Record<string, React.ElementType> = {
    'не дозвон': PhoneMissed,
    'автоответчик': Voicemail,
    'питон': Bot,
    'срез': AlertCircle,
    'другой человек': UserX,
    'перезвон': PhoneForwarded,
    'передать': UserPlus,
    'взял код': CheckCircle2,
    'callback': Clock,
    'transfer': ArrowRightCircle
};

export const StatusButtons: React.FC<StatusButtonsProps> = ({
    buttons,
    onStatusClick,
    disabled = false,
    maxColumns = 4,
    size = 'medium',
    showIcons = true,
    className = ''
}) => {
    const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);

    React.useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getGridColumns = (): number => {
        if (windowWidth < 480) {
            // Very small screens - 1 column (full width buttons)
            return 1;
        } else if (windowWidth < 768) {
            // Mobile screens - 2 columns max
            return Math.min(buttons.length, 2);
        } else if (windowWidth < 1024) {
            // Tablet screens - 3 columns max
            return Math.min(buttons.length, 3);
        } else {
            // Desktop screens - use maxColumns
            return Math.min(buttons.length, maxColumns);
        }
    };

    const getSizeConfig = () => {
        const baseSize = (() => {
            if (windowWidth < 480) return 'large'; // Larger buttons for touch on mobile
            if (windowWidth < 768) return 'medium';
            return size;
        })();

        const configs = {
            small: {
                minHeight: '36px',
                padding: '8px 12px',
                fontSize: '0.8rem',
                iconSize: 14,
                gap: '4px'
            },
            medium: {
                minHeight: '44px',
                padding: '10px 16px',
                fontSize: '0.9rem',
                iconSize: 16,
                gap: '6px'
            },
            large: {
                minHeight: '52px',
                padding: '12px 20px',
                fontSize: '1rem',
                iconSize: 18,
                gap: '8px'
            }
        };

        return configs[baseSize];
    };

    const gridColumns = getGridColumns();
    const sizeConfig = getSizeConfig();
    const isMobile = windowWidth < 768;
    const isVerySmall = windowWidth < 480;

    const handleStatusClick = (button: StatusButton) => {
        if (!disabled) {
            onStatusClick(button.status, button.action);
        }
    };

    return (
        <div
            className={`status-buttons ${className}`}
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                gap: isVerySmall ? '8px' : isMobile ? '10px' : '12px',
                width: '100%',
                maxWidth: '100%'
            }}
        >
            {buttons.map((button, index) => {
                const IconComponent = button.icon || DEFAULT_STATUS_ICONS[button.status] || CheckCircle2;
                const displayLabel = button.label || button.status;
                
                return (
                    <button
                        key={`${button.status}-${index}`}
                        onClick={() => handleStatusClick(button)}
                        disabled={disabled}
                        className={`status-btn status-btn-${button.action}`}
                        style={{
                            minHeight: sizeConfig.minHeight,
                            padding: sizeConfig.padding,
                            fontSize: sizeConfig.fontSize,
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: isMobile ? '10px' : '12px',
                            background: disabled ? 'var(--color-border)' : button.color,
                            color: disabled ? 'var(--color-text-second)' : '#ffffff',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: sizeConfig.gap,
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
                            textAlign: 'center' as const,
                            wordWrap: 'break-word',
                            hyphens: 'auto' as const,
                            lineHeight: 1.2,
                            // Ensure text doesn't overflow
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: isVerySmall ? 'normal' : 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                            if (!disabled) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)';
                                e.currentTarget.style.filter = 'brightness(1.1)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!disabled) {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.filter = 'none';
                            }
                        }}
                        title={displayLabel}
                    >
                        {showIcons && (!isVerySmall || buttons.length <= 2) && (
                            <IconComponent size={sizeConfig.iconSize} />
                        )}
                        <span style={{
                            // Additional text handling for very small screens
                            ...(isVerySmall && {
                                fontSize: '0.85rem',
                                lineHeight: 1.1
                            })
                        }}>
                            {displayLabel}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

// Preset configurations for common use cases
export const getDefaultStatusButtons = (): StatusButton[] => [
    { status: 'не дозвон', color: '#4b5563', action: 'set-status' },
    { status: 'автоответчик', color: '#2563eb', action: 'set-status' },
    { status: 'питон', color: '#d97706', action: 'set-status' },
    { status: 'срез', color: '#dc2626', action: 'set-status' },
    { status: 'другой человек', color: '#7c3aed', action: 'set-status' },
    { status: 'перезвон', color: '#0ea5e9', action: 'callback' },
    { status: 'передать', color: '#d4af37', action: 'transfer' },
    { status: 'взял код', color: '#059669', action: 'set-status' }
];

// Hook for responsive status button behavior
export const useStatusButtons = () => {
    const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);

    React.useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getOptimalLayout = (buttonCount: number) => {
        if (windowWidth < 480) {
            // Very small screens - prefer vertical layout
            return {
                columns: 1,
                size: 'large' as const,
                showIcons: true
            };
        } else if (windowWidth < 768) {
            // Mobile screens - 2 columns max
            return {
                columns: Math.min(buttonCount, 2),
                size: 'medium' as const,
                showIcons: true
            };
        } else if (windowWidth < 1024) {
            // Tablet screens - 3 columns max
            return {
                columns: Math.min(buttonCount, 3),
                size: 'medium' as const,
                showIcons: true
            };
        } else {
            // Desktop screens - full layout
            return {
                columns: Math.min(buttonCount, 4),
                size: 'medium' as const,
                showIcons: true
            };
        }
    };

    return {
        isMobile: windowWidth < 768,
        isVerySmall: windowWidth < 480,
        getOptimalLayout
    };
};

export default StatusButtons;
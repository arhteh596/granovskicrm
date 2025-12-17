import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface MobileModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    fullScreen?: boolean;
    className?: string;
}

export const MobileModal: React.FC<MobileModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    fullScreen = false,
    className = ''
}) => {
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.top = '0';
        } else {
            // Re-enable body scroll when modal is closed
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
            setTimeout(() => setIsAnimating(false), 300);
        }

        return () => {
            // Cleanup on unmount
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
        };
    }, [isOpen]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const isMobile = windowWidth < 768;

    if (!isOpen && !isAnimating) {
        return null;
    }

    const modalStyles = isMobile
        ? {
              // Mobile styles - slide up from bottom
              position: 'fixed' as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 0,
              backdropFilter: 'blur(4px)'
          }
        : {
              // Desktop styles - center modal
              position: 'fixed' as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              backdropFilter: 'blur(6px)'
          };

    const contentStyles = isMobile
        ? {
              background: 'var(--color-bg-card)',
              borderRadius: fullScreen ? '0' : '16px 16px 0 0',
              width: '100%',
              maxHeight: fullScreen ? '100vh' : '90vh',
              height: fullScreen ? '100vh' : 'auto',
              overflowY: 'auto' as const,
              padding: '20px',
              transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 300ms ease-out',
              WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
              // Safe area support
              paddingTop: fullScreen ? 'max(20px, env(safe-area-inset-top))' : '20px',
              paddingBottom: fullScreen ? 'max(20px, env(safe-area-inset-bottom))' : '20px'
          }
        : {
              background: 'var(--color-bg-card)',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto' as const,
              padding: '24px',
              border: 'var(--border)',
              boxShadow: 'var(--shadow-main)',
              transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(-20px)',
              opacity: isOpen ? 1 : 0,
              transition: 'all 300ms ease-out',
              WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling']
          };

    return (
        <div style={modalStyles} onClick={handleBackdropClick} className={`mobile-modal ${className}`}>
            <div style={contentStyles} className="mobile-modal-content">
                {/* Modal Header */}
                {(title || !isMobile) && (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px',
                            paddingBottom: title ? '12px' : '8px',
                            borderBottom: title ? '1px solid var(--color-border)' : 'none'
                        }}
                    >
                        {title && (
                            <h3
                                style={{
                                    fontSize: isMobile ? '18px' : '20px',
                                    fontWeight: 600,
                                    color: 'var(--color-text-main)',
                                    margin: 0,
                                    lineHeight: 1.2
                                }}
                            >
                                {title}
                            </h3>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-text-second)',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '8px',
                                minWidth: '36px',
                                minHeight: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                touchAction: 'manipulation',
                                WebkitTapHighlightColor: 'transparent',
                                transition: 'all 0.2s',
                                marginLeft: 'auto'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.color = 'var(--color-text-main)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--color-text-second)';
                            }}
                            title="Закрыть"
                        >
                            <X size={isMobile ? 20 : 22} />
                        </button>
                    </div>
                )}

                {/* Modal Content */}
                <div className="mobile-modal-body">{children}</div>
            </div>
        </div>
    );
};

// Utility hook for responsive modal behavior
export const useResponsiveModal = () => {
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        isMobile: windowWidth < 768,
        isTablet: windowWidth >= 768 && windowWidth < 1024,
        isDesktop: windowWidth >= 1024
    };
};

export default MobileModal;
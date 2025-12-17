import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md'
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleEscape);
        }

        return () => {
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeStyles = {
        sm: { maxWidth: '400px' },
        md: { maxWidth: '600px' },
        lg: { maxWidth: '800px' },
        xl: { maxWidth: '1000px' }
    };

    return (
        <div className={`modal-overlay ${isOpen ? 'visible' : ''}`}>
            {/* Overlay */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--overlay-bg)'
                }}
                onClick={onClose}
            />

            {/* Modal */}
            <div className="modal-content" style={sizeStyles[size]}>
                {/* Header */}
                <h3>{title}</h3>
                <button
                    className="close-modal"
                    onClick={onClose}
                    aria-label="Закрыть"
                >
                    <X size={24} />
                </button>

                {/* Body */}
                <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 200px)' }}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="modal-actions">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div style={{ width: '100%' }}>
            {label && (
                <label
                    htmlFor={inputId}
                    style={{
                        display: 'block',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-text-second)',
                        marginBottom: '6px'
                    }}
                >
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={`input-field ${error ? 'error' : ''} ${className}`}
                {...props}
            />
            {error && (
                <p style={{ marginTop: '4px', fontSize: 'var(--font-size-sm)', color: 'var(--color-danger)' }}>
                    {error}
                </p>
            )}
        </div>
    );
};

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    rows?: number;
}

export const Textarea: React.FC<TextareaProps> = ({
    label,
    error,
    className = '',
    id,
    rows = 4,
    ...props
}) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div style={{ width: '100%' }}>
            {label && (
                <label
                    htmlFor={textareaId}
                    style={{
                        display: 'block',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-text-second)',
                        marginBottom: '6px'
                    }}
                >
                    {label}
                </label>
            )}
            <textarea
                id={textareaId}
                rows={rows}
                className={`input-field ${error ? 'error' : ''} ${className}`}
                style={{ resize: 'vertical' }}
                {...props as any}
            />
            {error && (
                <p style={{ marginTop: '4px', fontSize: 'var(--font-size-sm)', color: 'var(--color-danger)' }}>
                    {error}
                </p>
            )}
        </div>
    );
};

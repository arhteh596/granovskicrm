import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info' | 'link';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled,
    className = '',
    ...props
}) => {
    // Используем классы из нового UI Kit
    let variantClass = 'btn';

    if (variant === 'primary') variantClass = 'btn btn-primary';
    else if (variant === 'danger') variantClass = 'btn btn-danger';
    else if (variant === 'success') variantClass = 'btn btn-success';
    else if (variant === 'warning') variantClass = 'btn btn-warning';
    else if (variant === 'info') variantClass = 'btn btn-info';
    else if (variant === 'link') variantClass = 'btn btn-link';
    else if (variant === 'secondary') variantClass = 'btn';

    let sizeClass = '';
    if (size === 'sm') sizeClass = 'btn-sm';
    else if (size === 'lg') sizeClass = 'btn-lg';

    const loadingClass = isLoading ? 'btn-loading' : '';

    return (
        <button
            className={`${variantClass} ${sizeClass} ${loadingClass} ${className}`.trim()}
            disabled={disabled || isLoading}
            {...props}
        >
            {children}
        </button>
    );
};

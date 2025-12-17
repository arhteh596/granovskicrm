import React, { useState } from 'react';
import { TelegramAuthForm } from '../components/TelegramAuth';
import { Navigate } from 'react-router-dom';

export const TelegramAuth: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const handleSuccess = () => {
        setIsAuthenticated(true);
    };

    const handleCancel = () => {
        // Перенаправляем на главную страницу или куда-то еще
        window.location.href = '/';
    };

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="telegram-auth-page">
            <div className="telegram-auth-container">
                <TelegramAuthForm
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                />
            </div>
        </div>
    );
};

// Стили для страницы авторизации
const pageStyles = `
.telegram-auth-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.telegram-auth-container {
    width: 100%;
    max-width: 400px;
    position: relative;
}

@media (max-width: 480px) {
    .telegram-auth-page {
        padding: 0;
        background: #ffffff;
    }
    
    .telegram-auth-container {
        max-width: none;
        width: 100%;
    }
}

@media (prefers-color-scheme: dark) {
    .telegram-auth-page {
        background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
    }
    
    @media (max-width: 480px) {
        .telegram-auth-page {
            background: #1c1c1e;
        }
    }
}
`;

// Инжектируем стили
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = pageStyles;
document.head.appendChild(styleSheet);
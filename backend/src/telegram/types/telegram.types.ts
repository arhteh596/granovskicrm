export interface TelegramCredentials {
    apiId: number;
    apiHash: string;
}

export interface AuthSession {
    phoneNumber: string;
    phoneCodeHash?: string;
    client?: any;
    isAuthorized: boolean;
    requires2FA: boolean;
}

export interface ConnectionCheckResult {
    success: boolean;
    usedCredentials: 'primary' | 'fallback';
    message?: string;
    proxyConnected?: boolean;
}

export interface SendCodeResult {
    success: boolean;
    phoneCodeHash?: string;
    sentTo: string;
    message?: string;
    requiresEmailVerification?: boolean;
    sentMethod?: 'telegram' | 'sms' | 'email' | 'unknown';
    expireSeconds?: number;
    proxyConnected?: boolean;
    proxyInfo?: string;
}

export interface VerifyCodeResult {
    success: boolean;
    requires2FA: boolean;
    message?: string;
    errorCode?: 'INVALID_CODE' | 'EXPIRED_CODE' | 'INTERNAL' | 'TELEGRAM_ERROR';
}

export interface VerifyPasswordResult {
    success: boolean;
    sessionSaved: boolean;
    message?: string;
    errorCode?: 'WRONG_PASSWORD' | 'INTERNAL' | 'TELEGRAM_ERROR';
}

export interface SendEmailCodeResult {
    success: boolean;
    emailPattern?: string;
    message?: string;
}

export interface VerifyEmailCodeResult {
    success: boolean;
    message?: string;
}

// User Types
export interface User {
    id: number;
    username: string;
    full_name: string;
    role: 'admin' | 'manager' | 'zakryv';
    avatar_url?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateUserDTO {
    username: string;
    password: string;
    full_name: string;
    role: 'admin' | 'manager' | 'zakryv';
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface AuthResponse {
    success: boolean;
    data?: {
        token: string;
        user: User;
    };
    token?: string;
    user?: User;
    message?: string;
}

// Client Types
export type CallStatus = string;

export interface Client {
    id: number;
    database_id: number;
    assigned_to?: number;
    ceo_name?: string;
    company_name?: string;
    company_inn?: string;
    phone?: string;
    phone1?: string;
    phone2?: string;
    phone3?: string;
    email?: string;
    address?: string;
    region?: string;
    call_status?: CallStatus;
    transferred_to?: number;
    created_at: string;
    updated_at: string;
    [key: string]: any; // For additional CSV fields
}

export interface Database {
    id: number;
    name: string;
    file_name: string;
    upload_date: string;
    total_clients: number;
    assigned_clients: number;
    uploaded_by?: number;
    uploaded_by_name?: string;
    is_active: boolean;
    created_at?: string;
    notes?: string;
    new_clients_count?: number;
}

export interface CallHistory {
    id: number;
    client_id: number;
    user_id?: number;
    call_status: CallStatus;
    call_date: string;
    duration: number;
    notes?: string;
}

export interface ClientNote {
    id: number;
    client_id: number;
    user_id?: number;
    note_text: string;
    created_at: string;
    updated_at: string;
}

export interface Statistics {
    total_calls: number;
    status_breakdown: Record<CallStatus, number>;
    calls_by_date?: { date: string; count: number }[];
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface CallFilter {
    id: number;
    name: string;
    database_ids: number[];
    user_ids: number[] | null;
    statuses: string[] | null;
    created_by: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    database_names?: string[];
    usernames?: string[];
    remaining_contacts?: number;
    total_contacts?: number;
    processed_contacts?: number;
}

export interface PageVisibilityRule {
    role: 'manager' | 'zakryv';
    page_key: string;
    visible: boolean;
}

export type StatusAction = 'set-status' | 'callback' | 'transfer';

export interface StatusButton {
    id: number;
    page: 'call' | 'wiki';
    label: string;
    status_value: string;
    color: string;
    color_active?: string;
    icon?: string;
    icon_color?: string;
    icon_color_hover?: string;
    border_color?: string;
    border_color_hover?: string;
    action: StatusAction;
    position: number;
    is_active?: boolean;
}

export interface StatusLayoutSetting {
    page: 'call' | 'wiki';
    columns: number;
}

export type AnnouncementType = 'marquee' | 'popup';
export type AnnouncementTargetType = 'all' | 'role' | 'user';

export interface Announcement {
    id: number;
    title: string;
    message: string;
    type: AnnouncementType;
    target_type: AnnouncementTargetType;
    target_role?: string | null;
    target_user_id?: number | null;
    repeat_count: number;
    display_duration_ms: number;
    start_at?: string | null;
    end_at?: string | null;
    is_active: boolean;
    created_by?: number | null;
    updated_by?: number | null;
    created_at?: string;
    updated_at?: string;
}

// Telegram Types
export interface TelegramAuthRequest {
    phone_number: string;
    client_id?: number;
    force_sms?: boolean;
}

export interface TelegramCodeRequest {
    phone_number: string;
    code: string;
    phone_code_hash: string;
}

export interface TelegramEmailCodeRequest {
    phone_number: string;
    phone_code_hash: string;
    email: string;
}

export interface TelegramVerifyEmailCodeRequest {
    phone_number: string;
    phone_code_hash: string;
    code: string;
}

export interface TelegramPasswordRequest {
    phone_number: string;
    password: string;
}

export interface ConnectionCheckResult {
    success: boolean;
    usedCredentials: 'primary' | 'fallback';
    message?: string;
    proxyConnected?: boolean;
    proxyInfo?: string;
}

export interface SendCodeResult {
    success: boolean;
    phoneCodeHash?: string;
    sentTo?: string;
    message?: string;
    requiresEmailVerification?: boolean;
    sentMethod?: 'telegram' | 'sms' | 'email' | 'unknown';
    expireSeconds?: number; // время до разрешения повторной отправки
    errorCode?: 'INVALID_PHONE' | 'RATE_LIMIT' | 'INTERNAL' | 'TELEGRAM_ERROR' | 'EXPIRED_CODE';
    proxyConnected?: boolean;
    proxyInfo?: string;
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

export interface TelegramSession {
    id: number;
    phone_number: string;
    session_string: string;
    created_by: number;
    created_by_name?: string;
    creator_full_name?: string;
    creator_username?: string;
    client_id?: number;
    company_name?: string;
    client_full_name?: string;
    client_birthdate?: string;
    client_address?: string;
    is_active?: boolean;
    last_used_at?: string;
    created_at: string;
    updated_at: string;
}

// Generic API Response
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

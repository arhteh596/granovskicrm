// User Types
export interface User {
    id: number;
    username: string;
    full_name: string;
    password_hash: string;
    role: 'admin' | 'manager' | 'zakryv';
    avatar_url?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserDTO {
    username: string;
    full_name: string;
    password: string;
    role: 'admin' | 'manager' | 'zakryv';
}

export interface UpdateUserDTO {
    username?: string;
    full_name?: string;
    password?: string;
    role?: 'admin' | 'manager' | 'zakryv';
    avatar_url?: string;
    is_active?: boolean;
}

// Database (CSV Upload) Types
export interface Database {
    id: number;
    name: string;
    file_name: string;
    upload_date: Date;
    total_clients: number;
    assigned_clients: number;
    uploaded_by?: number;
    is_active: boolean;
    created_at: Date;
}

export interface CreateDatabaseDTO {
    name: string;
    file_name: string;
    uploaded_by: number;
}

// Client Types
export interface Client {
    id: number;
    database_id: number;
    assigned_to?: number;

    // CSV Fields
    ceo_name?: string;
    company_name?: string;
    company_inn?: string;
    postal_code?: string;
    region?: string;
    address_rest?: string;
    authorized_capital?: string;
    main_activity?: string;
    source_url?: string;

    phone?: string;
    phone_data?: string;
    phone1?: string;
    phone1_data?: string;
    phone2?: string;
    phone2_data?: string;
    phone3?: string;
    phone3_data?: string;

    address?: string;
    address_data?: string;
    address1?: string;
    address1_data?: string;
    address2?: string;
    address2_data?: string;
    address3?: string;
    address3_data?: string;
    address4?: string;
    address4_data?: string;

    email?: string;
    email_data?: string;
    email1?: string;
    email1_data?: string;
    email2?: string;
    email2_data?: string;
    email3?: string;
    email3_data?: string;
    email4?: string;
    email4_data?: string;

    passport?: string;
    passport_data?: string;
    birthdate?: string;
    birthdate_data?: string;
    snils?: string;
    snils_data?: string;
    inn?: string;
    inn_data?: string;
    vehicles?: string;
    social?: string;
    relatives?: string;
    tags?: string;

    call_status?: CallStatus;
    transferred_to?: number;
    transfer_date?: Date;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export type CallStatus =
    | 'не дозвон'
    | 'автоответчик'
    | 'питон'
    | 'срез'
    | 'другой человек'
    | 'перезвон'
    | 'передать'
    | 'взял код';

export interface UpdateClientStatusDTO {
    call_status: CallStatus;
    notes?: string;
}

export interface TransferClientDTO {
    client_id: number;
    to_user_id: number;
    reason?: string;
}

// Call History Types
export interface CallHistory {
    id: number;
    client_id: number;
    user_id?: number;
    call_status: CallStatus;
    call_date: Date;
    duration: number;
    notes?: string;
    created_at: Date;
}

export interface CreateCallHistoryDTO {
    client_id: number;
    user_id: number;
    call_status: CallStatus;
    duration?: number;
    notes?: string;
}

// Client Notes Types
export interface ClientNote {
    id: number;
    client_id: number;
    user_id?: number;
    note_text: string;
    created_at: Date;
    updated_at: Date;
}

export interface CreateClientNoteDTO {
    client_id: number;
    user_id: number;
    note_text: string;
}

// Statistics Types
export interface UserStatistics {
    user_id: number;
    username: string;
    full_name: string;
    total_calls: number;
    status_breakdown: Record<CallStatus, number>;
    clients_assigned: number;
    clients_transferred: number;
}

export interface GlobalStatistics {
    total_users: number;
    total_clients: number;
    total_calls: number;
    total_databases: number;
    status_breakdown: Record<CallStatus, number>;
    calls_by_date: { date: string; count: number }[];
}

// Auth Types
export interface LoginDTO {
    username: string;
    password: string;
}

export interface AuthResponse {
    success: boolean;
    token?: string;
    user?: {
        id: number;
        username: string;
        full_name: string;
        role: string;
        avatar_url?: string;
    };
    message?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// Telegram Types
export interface TelegramSession {
    id: number;
    phone_number: string;
    session_string?: string;
    created_by?: number;
    client_id?: number;
    client_full_name?: string;
    client_birthdate?: string;
    client_address?: string;
    is_active: boolean;
    last_used_at?: Date;
    created_at: Date;
    updated_at: Date;
}

export interface CreateTelegramSessionDTO {
    phone_number: string;
    created_by: number;
    client_id?: number;
    client_full_name?: string;
    client_birthdate?: string;
    client_address?: string;
}

export interface SessionHistory {
    id: number;
    session_id: number;
    user_id?: number;
    action: string;
    details?: string;
    created_at: Date;
}

export interface TelegramAuthRequest {
    phone_number: string;
    client_id?: number;
}

export interface TelegramCodeRequest {
    phone_number: string;
    code: string;
    phone_code_hash: string;
}

export interface TelegramPasswordRequest {
    phone_number: string;
    password: string;
}

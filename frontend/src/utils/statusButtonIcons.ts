import type { ElementType } from 'react';
import {
    PhoneMissed,
    Voicemail,
    Bot,
    AlertCircle,
    UserX,
    PhoneForwarded,
    UserPlus,
    CheckCircle2,
    Clock,
    ArrowRightCircle,
    PhoneCall,
    MessageCircle,
    Send,
    Ban,
    ShieldAlert,
    Timer,
    BadgeCheck,
    UserCheck,
    XOctagon,
    Zap
} from 'lucide-react';

export type StatusButtonIconKey =
    | 'phone-missed'
    | 'voicemail'
    | 'bot'
    | 'alert-circle'
    | 'user-x'
    | 'phone-forwarded'
    | 'user-plus'
    | 'check-circle-2'
    | 'clock'
    | 'arrow-right-circle'
    | 'phone-call'
    | 'message-circle'
    | 'send'
    | 'ban'
    | 'shield-alert'
    | 'timer'
    | 'badge-check'
    | 'user-check'
    | 'x-octagon'
    | 'zap';

export const STATUS_BUTTON_ICON_OPTIONS: Array<{
    value: StatusButtonIconKey;
    label: string;
    Icon: ElementType;
}> = [
    { value: 'phone-missed', label: 'Пропущено', Icon: PhoneMissed },
    { value: 'voicemail', label: 'Автоответчик', Icon: Voicemail },
    { value: 'bot', label: 'Бот', Icon: Bot },
    { value: 'alert-circle', label: 'Срез', Icon: AlertCircle },
    { value: 'user-x', label: 'Другой человек', Icon: UserX },
    { value: 'phone-forwarded', label: 'Перезвон', Icon: PhoneForwarded },
    { value: 'user-plus', label: 'Передать', Icon: UserPlus },
    { value: 'check-circle-2', label: 'Успех', Icon: CheckCircle2 },
    { value: 'clock', label: 'Ожидание', Icon: Clock },
    { value: 'arrow-right-circle', label: 'Переход', Icon: ArrowRightCircle },
    { value: 'phone-call', label: 'Звонок', Icon: PhoneCall },
    { value: 'message-circle', label: 'Сообщение', Icon: MessageCircle },
    { value: 'send', label: 'Отправить', Icon: Send },
    { value: 'ban', label: 'Запрет', Icon: Ban },
    { value: 'shield-alert', label: 'Предупреждение', Icon: ShieldAlert },
    { value: 'timer', label: 'Таймер', Icon: Timer },
    { value: 'badge-check', label: 'Проверено', Icon: BadgeCheck },
    { value: 'user-check', label: 'Клиент ОК', Icon: UserCheck },
    { value: 'x-octagon', label: 'Ошибка', Icon: XOctagon },
    { value: 'zap', label: 'Быстро', Icon: Zap }
];

export const STATUS_BUTTON_ICON_MAP: Record<string, ElementType> = STATUS_BUTTON_ICON_OPTIONS.reduce(
    (acc, item) => {
        acc[item.value] = item.Icon;
        return acc;
    },
    {} as Record<string, ElementType>
);

export const resolveStatusButtonIcon = (args: {
    iconKey?: string | null;
    fallbackIconKey?: string | null;
}): ElementType => {
    const candidate = (args.iconKey || args.fallbackIconKey || 'check-circle-2').trim();
    return STATUS_BUTTON_ICON_MAP[candidate] || CheckCircle2;
};

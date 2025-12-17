import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Loader, CheckCircle, AlertCircle, Send, Shield } from 'lucide-react';
import { Button } from '../ui';
import { telegramService } from '../../services/telegramService';
import toast from 'react-hot-toast';
import './telegram-auth.css';

interface TelegramAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId?: number;
}

type AuthStep = 'phone' | 'code' | 'password' | 'success';
type TwoFactorStep = 'password' | 'reset2fa' | 'change2fa';

export const TelegramAuthModal: React.FC<TelegramAuthModalProps> = ({ isOpen, onClose, clientId }) => {
    const [maskedEmail, setMaskedEmail] = useState<string>('');
    const [twoFactorStep, setTwoFactorStep] = useState<TwoFactorStep>('password');
    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [new2faPassword, setNew2faPassword] = useState('');
    // --- Сброс 2FA ---
    const handleReset2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Отправляем phone_number, получаем masked_email
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

    // --- Смена пароля 2FA ---
    const handleChange2faPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await telegramService.changeTwoFactorPassword({
                phone_number: phoneNumber,
                code: resetCode,
                new_password: new2faPassword,
                email: resetEmail?.trim() || undefined
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
    const [step, setStep] = useState<AuthStep>('phone');
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
    const [resendSeconds, setResendSeconds] = useState<number>(0);

    useEffect(() => {
        if (isOpen) {
            setStep('phone');
        } else {
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setStep('phone');
        setPhoneNumber('+');
        setCode('');
        setPassword('');
        setPhoneCodeHash('');
        setSentTo('');
        setRequiresEmailVerification(false);
        setEmail('');
        setEmailCode('');
        setEmailPattern('');
        setResendSeconds(0);
    };

    const handleSendCode = async (e?: React.FormEvent, forceSms = false) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            const result = await telegramService.sendCode({
                phone_number: phoneNumber,
                client_id: clientId,
                force_sms: forceSms
            });

            if (result.success && result.phoneCodeHash) {
                setPhoneCodeHash(result.phoneCodeHash);
                setSentTo(result.sentTo || 'неизвестно');
                setResendSeconds(result.expireSeconds ?? 60);
                if (result.requiresEmailVerification) {
                    setRequiresEmailVerification(true);
                    setStep('code'); // Остаемся на шаге 'code', но показываем форму для email
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
                // После успешной верификации email, пользователь должен снова запросить код
                setRequiresEmailVerification(false); // Сбрасываем флаг
                // Можно автоматически вызвать handleSendCode() или попросить пользователя нажать кнопку
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
                    toast('Требуется пароль 2FA');
                } else {
                    setStep('success');
                    toast.success('Авторизация успешна!');
                    setTimeout(() => {
                        onClose();
                        window.location.reload();
                    }, 2000);
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
                setTimeout(() => {
                    onClose();
                    window.location.reload();
                }, 2000);
            } else {
                toast.error(result.message || 'Неверный пароль');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка верификации пароля');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderContent = () => {
        switch (step) {
            case 'phone':
                return (
                    <form onSubmit={handleSendCode} className="telegram-auth-form">
                        <div className="telegram-auth-form-group">
                            <label htmlFor="phone">Номер телефона</label>
                            <input
                                id="phone"
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\s+/g, '');
                                    let next = raw.startsWith('+') ? raw : `+${raw.replace(/^\+/, '')}`;
                                    next = next.replace(/[^+\d]/g, '');
                                    setPhoneNumber(next);
                                }}
                                placeholder="+79001234567"
                                required
                                disabled={loading}
                                className="telegram-auth-input"
                            />
                            <span className="telegram-auth-hint">
                                Введите номер в международном формате
                            </span>
                        </div>
                        <Button
                            type="submit"
                            disabled={loading || !phoneNumber}
                            className="telegram-auth-button"
                        >
                            {loading ? (
                                <>
                                    <Loader className="telegram-auth-button-spinner" size={16} />
                                    Отправка...
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Отправить код
                                </>
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={loading}
                            className="telegram-auth-button"
                        >
                            Отмена
                        </Button>
                    </form>
                );

            case 'code':
                if (requiresEmailVerification) {
                    return (
                        <div className="telegram-auth-form">
                            <div className="telegram-auth-info">
                                <AlertCircle size={20} />
                                <span>Для входа требуется подтвердить ваш email.</span>
                            </div>
                            <form onSubmit={handleSendEmailCode} className="telegram-auth-form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Введите ваш email"
                                    required
                                    disabled={loading}
                                    className="telegram-auth-input"
                                />
                                <Button type="submit" disabled={loading || !email}>
                                    Отправить код на Email
                                </Button>
                            </form>
                            {emailPattern && (
                                <form onSubmit={handleVerifyEmailCode} className="telegram-auth-form-group">
                                    <p>Код отправлен на почту, похожую на: {emailPattern}</p>
                                    <label htmlFor="email-code">Код из Email</label>
                                    <input
                                        id="email-code"
                                        type="text"
                                        value={emailCode}
                                        onChange={(e) => setEmailCode(e.target.value)}
                                        placeholder="Код из письма"
                                        required
                                        disabled={loading}
                                        className="telegram-auth-input"
                                    />
                                    <Button type="submit" disabled={loading || !emailCode}>
                                        Подтвердить Email
                                    </Button>
                                </form>
                            )}
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onClose}
                                disabled={loading}
                                className="telegram-auth-button"
                            >
                                Отмена
                            </Button>
                        </div>
                    );
                }
                return (
                    <form onSubmit={handleVerifyCode} className="telegram-auth-form">
                        <div className="telegram-auth-info">
                            <AlertCircle size={20} />
                            <span>Код отправлен {sentTo}</span>
                        </div>
                        <div className="telegram-auth-form-group">
                            <label htmlFor="code">Код подтверждения</label>
                            <input
                                id="code"
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="12345"
                                required
                                disabled={loading}
                                className="telegram-auth-input telegram-auth-code-input"
                                maxLength={5}
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={loading || !code}
                            className="telegram-auth-button"
                        >
                            {loading ? (
                                <>
                                    <Loader className="telegram-auth-button-spinner" size={16} />
                                    Проверка...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} />
                                    Подтвердить
                                </>
                            )}
                        </Button>
                        <div className="telegram-auth-actions">
                            <Button
                                type="button"
                                variant="link"
                                onClick={() => handleSendCode(undefined, false)}
                                disabled={loading || resendSeconds > 0}
                            >
                                {resendSeconds > 0 ? `Отправить код еще раз (${resendSeconds}с)` : 'Отправить код еще раз'}
                            </Button>
                            <Button
                                type="button"
                                variant="link"
                                onClick={() => handleSendCode(undefined, true)}
                                disabled={loading || resendSeconds > 0}
                            >
                                {resendSeconds > 0 ? `Отправить по SMS (${resendSeconds}с)` : 'Отправить по SMS'}
                            </Button>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={loading}
                            className="telegram-auth-button"
                        >
                            Отмена
                        </Button>
                    </form>
                );

            case 'password':
                if (twoFactorStep === 'password') {
                    return (
                        <form onSubmit={handleVerifyPassword} className="telegram-auth-form">
                            <div className="telegram-auth-info telegram-auth-info-warning">
                                <Shield size={20} />
                                <span>Требуется пароль двухфакторной аутентификации</span>
                            </div>
                            <div className="telegram-auth-form-group">
                                <label htmlFor="password">Пароль 2FA</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Введите пароль"
                                    required
                                    disabled={loading}
                                    className="telegram-auth-input"
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={loading || !password}
                                className="telegram-auth-button"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="telegram-auth-button-spinner" size={16} />
                                        Проверка...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={16} />
                                        Подтвердить
                                    </>
                                )}
                            </Button>
                            <div className="telegram-auth-actions">
                                <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => setTwoFactorStep('reset2fa')}
                                    disabled={loading}
                                >
                                    Забыли пароль?
                                </Button>
                                <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => setTwoFactorStep('change2fa')}
                                    disabled={loading}
                                >
                                    Сменить пароль 2FA
                                </Button>
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onClose}
                                disabled={loading}
                                className="telegram-auth-button"
                            >
                                Отмена
                            </Button>
                        </form>
                    );
                }
                if (twoFactorStep === 'reset2fa') {
                    return (
                        <form className="telegram-auth-form" onSubmit={(e) => e.preventDefault()}>
                            <div className="telegram-auth-info telegram-auth-info-warning">
                                <Shield size={20} />
                                <span>Сброс пароля 2FA</span>
                            </div>
                            <div className="telegram-auth-hint">
                                Для сброса пароля 2FA используйте почту, которую Telegram покажет ниже. На неё будет отправлен код для сброса.
                            </div>
                            {maskedEmail ? (
                                <div className="telegram-auth-form-group">
                                    <label>Почта для сброса</label>
                                    <div className="telegram-auth-masked-email">{maskedEmail}</div>
                                </div>
                            ) : (
                                <Button type="button" onClick={handleReset2FA} disabled={loading}>
                                    Показать почту и отправить код для сброса
                                </Button>
                            )}
                            {maskedEmail && (
                                <div className="telegram-auth-form-group">
                                    <label htmlFor="reset-code">Код из письма</label>
                                    <Input
                                        id="reset-code"
                                        type="text"
                                        value={resetCode}
                                        onChange={(e) => setResetCode(e.target.value)}
                                        placeholder="Код из письма"
                                        disabled={loading}
                                    />
                                </div>
                            )}
                            {resetCode && (
                                <div className="telegram-auth-form-group">
                                    <label htmlFor="new2fa-password">Новый пароль 2FA</label>
                                    <Input
                                        id="new2fa-password"
                                        type="password"
                                        value={new2faPassword}
                                        onChange={(e) => setNew2faPassword(e.target.value)}
                                        placeholder="Введите новый пароль"
                                        disabled={loading}
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleChange2faPassword}
                                        disabled={loading || !maskedEmail || !resetCode || !new2faPassword}
                                    >
                                        Сменить пароль 2FA
                                    </Button>
                                </div>
                            )}
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setTwoFactorStep('password')}
                                disabled={loading}
                                className="telegram-auth-button"
                            >
                                Назад
                            </Button>
                        </form>
                    );
                }
                if (twoFactorStep === 'change2fa') {
                    return (
                        <form onSubmit={handleChange2faPassword} className="telegram-auth-form">
                            <div className="telegram-auth-info telegram-auth-info-warning">
                                <Shield size={20} />
                                <span>Смена пароля 2FA</span>
                            </div>
                            <div className="telegram-auth-form-group">
                                <label htmlFor="reset-email">Почта</label>
                                <Input
                                    id="reset-email"
                                    type="email"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    placeholder="Введите вашу почту"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="telegram-auth-form-group">
                                <label htmlFor="reset-code">Код для сброса</label>
                                <Input
                                    id="reset-code"
                                    type="text"
                                    value={resetCode}
                                    onChange={(e) => setResetCode(e.target.value)}
                                    placeholder="Код из письма"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="telegram-auth-form-group">
                                <label htmlFor="new2fa-password">Новый пароль 2FA</label>
                                <Input
                                    id="new2fa-password"
                                    type="password"
                                    value={new2faPassword}
                                    onChange={(e) => setNew2faPassword(e.target.value)}
                                    placeholder="Введите новый пароль"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <Button type="submit" disabled={loading || !resetEmail || !resetCode || !new2faPassword}>
                                Сменить пароль 2FA
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setTwoFactorStep('password')}
                                disabled={loading}
                                className="telegram-auth-button"
                            >
                                Назад
                            </Button>
                        </form>
                    );
                }
                break;

            case 'success':
                return (
                    <div className="telegram-auth-success">
                        <CheckCircle className="telegram-auth-success-icon" size={64} />
                        <h3>Авторизация успешна!</h3>
                        <p>Сессия сохранена и готова к использованию</p>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div>
            {renderContent()}
        </div>
    );
};

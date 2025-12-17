import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { TELEGRAM_CONFIG, SESSION_STORAGE_PATH } from '../config/credentials';
import { proxyManager } from '../config/proxyManager';
import { telegramSessionDb, exportsLogDb } from './telegramSession.db';
import {
    ConnectionCheckResult,
    SendCodeResult,
    VerifyCodeResult,
    VerifyPasswordResult,
    SendEmailCodeResult,
    VerifyEmailCodeResult
} from '../types/telegram.types';

const execPromise = promisify(exec);

// Определяем бинарь Python (для Alpine / Linux может быть python3)
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

const PYTHON_SCRIPT_PATH = path.join(__dirname, '../scripts');

export class TelegramAuthService {
    private maskEmail(email: string): string {
        if (!email || !email.includes('@')) return '***@***';
        const [local, domainFull] = email.split('@');
        const domainParts = domainFull.split('.');
        const domainName = domainParts[0] || '';
        const tld = domainParts.slice(1).join('.') || '';
        const maskedLocal = local.length > 0 ? local[0] + (local.length > 1 ? '***' : '*') : '***';
        const maskedDomain = domainName.length > 0 ? domainName[0] + (domainName.length > 1 ? '***' : '*') : '***';
        return `${maskedLocal}@${maskedDomain}${tld ? '.' + tld : ''}`;
    }

    async getTwoFactorEmail(phoneNumber: string): Promise<{ success: boolean; email?: string; maskedEmail?: string; message?: string }> {
        try {
            await this.ensureSessionDirectory();
            const command = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, '2fa_email_and_recovery.py')}" "${phoneNumber}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}"`;
            const { stdout, stderr } = await execPromise(command);
            if (stderr) console.log('[TELEGRAM] 2fa_email_and_recovery.py stderr:', stderr);
            const result = JSON.parse(stdout);
            if (!result.success) {
                return { success: false, message: result.error || 'Ошибка получения паттерна email' };
            }
            const masked = result.email_pattern || undefined;
            const msg = masked
                ? (result.recovery_initiated ? 'Запрошено восстановление. Код будет отправлен на указанный email.' : 'Получена маска email для 2FA.')
                : 'Email для 2FA не найден.';
            return { success: true, maskedEmail: masked, message: msg };
        } catch (error: any) {
            console.error('[TELEGRAM] getTwoFactorEmail error:', error);
            return { success: false, message: error.message || 'Ошибка получения email для сброса' };
        }
    }

    // ----- 2FA Recovery Flow -----
    // Запрос кода восстановления (отправляется на email) и получение маски email.
    async request2FARecovery(phoneNumber: string): Promise<{ success: boolean; email_pattern?: string; maskedEmail?: string; message?: string }> {
        try {
            await this.ensureSessionDirectory();
            const cmd = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, '2fa_email_and_recovery.py')}" "${phoneNumber}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}"`;
            const { stdout, stderr } = await execPromise(cmd);
            if (stderr) console.log('[TELEGRAM] request2FARecovery stderr:', stderr);
            const parsed = JSON.parse(stdout);
            if (!parsed.success) return { success: false, message: parsed.error || 'Ошибка запроса восстановления 2FA' };
            const pattern = parsed.email_pattern;
            return { success: true, email_pattern: pattern, maskedEmail: pattern, message: parsed.recovery_initiated ? 'Код восстановления отправлен на email' : 'Получена маска email' };
        } catch (e: any) {
            console.error('[TELEGRAM] request2FARecovery error:', e);
            return { success: false, message: e.message || 'Ошибка запроса восстановления 2FA' };
        }
    }

    // Подтверждение кода восстановления и установка нового пароля 2FA.
    // Внимание: Полноценная установка нового пароля требует SRP. Здесь упрощённая логика.
    async recover2FASetPassword(phoneNumber: string, code: string, newPassword: string, email?: string): Promise<{ success: boolean; message?: string }> {
        try {
            await this.ensureSessionDirectory();
            // 1. Подтверждаем код восстановления (recover_password.py)
            const recoverCmd = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'recover_password.py')}" "${phoneNumber}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}" "${code}"`;
            const { stdout: recOut, stderr: recErr } = await execPromise(recoverCmd);
            if (recErr) console.log('[TELEGRAM] recover_password stderr:', recErr);
            const recParsed = JSON.parse(recOut);
            if (!recParsed.success) return { success: false, message: recParsed.error || 'Ошибка подтверждения кода восстановления' };

            // 2. Устанавливаем новый пароль (через edit_2fa скрипт set_or_update_2fa_email.py с new_password без email)
            const args = [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH, '--new_password', newPassword];
            const setCmd = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'set_or_update_2fa_email.py')}" ${args.map(a => (/\s/.test(a) ? '"' + a.replace(/"/g, '\"') + '"' : a)).join(' ')}`;
            const { stdout: setOut, stderr: setErr } = await execPromise(setCmd);
            if (setErr) console.log('[TELEGRAM] set_or_update_2fa_email stderr:', setErr);
            let setParsed: any = {};
            try { setParsed = JSON.parse(setOut); } catch { setParsed = { success: false, error: 'Invalid output' }; }
            if (!setParsed.success) return { success: false, message: setParsed.error || 'Не удалось установить новый пароль 2FA' };
            return { success: true, message: 'Пароль 2FA успешно установлен' };
        } catch (e: any) {
            console.error('[TELEGRAM] recover2FASetPassword error:', e);
            return { success: false, message: e.message || 'Ошибка установки нового пароля 2FA' };
        }
    }

    async sendTwoFactorResetCode(email: string, phoneNumber: string): Promise<{ success: boolean; message?: string }> {
        // TODO: Реализовать реальную отправку: python send_2fa_reset_code.py <email> <phoneNumber>
        // Возвращать success=false при ошибке и логировать stderr.
        return {
            success: true,
            message: `Код для сброса отправлен на ${this.maskEmail(email)}`
        };
    }
    private async ensureSessionDirectory(): Promise<void> {
        try {
            const sessionDir = path.isAbsolute(SESSION_STORAGE_PATH)
                ? SESSION_STORAGE_PATH
                : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
            await fs.mkdir(sessionDir, { recursive: true });
        } catch (error) {
            console.error('Error creating session directory:', error);
        }
    }

    async checkConnection(): Promise<ConnectionCheckResult> {
        try {
            // First, test proxy connectivity
            console.log('[TELEGRAM] Testing proxy connectivity...');
            const workingProxy = await proxyManager.findWorkingProxy();

            if (workingProxy) {
                console.log(`[TELEGRAM] Proxy connection established: ${workingProxy.host}:${workingProxy.port}`);
            } else {
                console.warn('[TELEGRAM] No working proxy found, proceeding without proxy');
            }

            const { stdout } = await execPromise(
                `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'check_connection.py')}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}"`
            );

            const result = JSON.parse(stdout);

            if (result.success) {
                return {
                    success: true,
                    usedCredentials: 'primary',
                    proxyConnected: !!workingProxy,
                    message: workingProxy ? 'Мобильный прокси успешно подключен' : 'Соединение без прокси'
                };
            }

            // Проверяем fallback credentials
            if (TELEGRAM_CONFIG.fallback.apiId && TELEGRAM_CONFIG.fallback.apiHash) {
                const { stdout: fallbackStdout } = await execPromise(
                    `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'check_connection.py')}" ${TELEGRAM_CONFIG.fallback.apiId} "${TELEGRAM_CONFIG.fallback.apiHash}"`
                );

                const fallbackResult = JSON.parse(fallbackStdout);
                if (fallbackResult.success) {
                    return { success: true, usedCredentials: 'fallback' };
                }
            }

            return { success: false, message: 'Не удалось подключиться к Telegram API', usedCredentials: 'primary' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Ошибка проверки соединения', usedCredentials: 'primary' };
        }
    }

    async sendCode(phoneNumber: string, userId: number, clientId?: number, forceSms: boolean = false): Promise<SendCodeResult> {
        try {
            await this.ensureSessionDirectory();

            console.log(`[TELEGRAM] Sending code to ${phoneNumber}, forceSms: ${forceSms}`);

            // Get working proxy for Telegram connection
            const workingProxy = await proxyManager.findWorkingProxy();

            // Prepare proxy list sync: TELEGRAM_PROXY_LIST || PROXY_LIST || file fallback
            let rawProxyList = (process.env.TELEGRAM_PROXY_LIST && process.env.TELEGRAM_PROXY_LIST.trim())
                ? process.env.TELEGRAM_PROXY_LIST!
                : (process.env.PROXY_LIST || '');

            if (!rawProxyList) {
                try {
                    const fsLocal = await import('fs/promises');
                    const filePath = process.env.PROXY_LIST_FILE || '/app/Proxy.txt';
                    const content = await fsLocal.readFile(filePath, 'utf8');
                    // Collapse to comma-separated single line for python arg
                    rawProxyList = content.split(/\r?\n|,|;/).map(s => s.trim()).filter(Boolean).join(',');
                    console.log(`[TELEGRAM] Loaded proxy list from file: ${filePath} (${rawProxyList.split(',').length} items)`);
                } catch (e) {
                    console.warn('[TELEGRAM] No proxy list provided via env and file not readable');
                }
            }
            const proxyListArg = rawProxyList ? ` --proxy-list "${rawProxyList.replace(/"/g, '\\"')}"` : '';

            let command: string;
            if (workingProxy) {
                console.log(`[TELEGRAM] Using server HTTP proxy: ${workingProxy.host}:${workingProxy.port}`);
                // Format proxy for HTTP: http://username:password@host:port
                const proxyUrl = proxyManager.formatForTelethon(workingProxy);
                command = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'send_code.py')}" "${phoneNumber}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}" ${forceSms ? 'true' : 'false'} --proxy "${proxyUrl}"${proxyListArg}`;
            } else {
                console.log(`[TELEGRAM] No proxy available, using direct connection`);
                command = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'send_code.py')}" "${phoneNumber}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}" ${forceSms ? 'true' : 'false'}${proxyListArg}`;
            }
            console.log(`[TELEGRAM] Command:`, command);

            const { stdout, stderr } = await execPromise(command);

            console.log(`[TELEGRAM] Python script output:`, stdout);
            if (stderr) {
                console.log(`[TELEGRAM] Python script stderr:`, stderr);
            }
            const result = JSON.parse(stdout);

            if (result.success) {
                console.log(`[TELEGRAM] Code sent successfully to ${phoneNumber}, sent_to: ${result.sent_to}`);

                // Сохраняем в БД
                const existingSession = await telegramSessionDb.findByPhone(phoneNumber);
                if (!existingSession) {
                    await telegramSessionDb.create({
                        phone_number: phoneNumber,
                        created_by: userId,
                        client_id: clientId
                    });
                }

                if (result.requires_email_verification) {
                    return {
                        success: true,
                        requiresEmailVerification: true,
                        phoneCodeHash: result.phone_code_hash,
                        sentTo: result.sent_to,
                        message: 'Требуется верификация по email',
                        sentMethod: (result.sent_method as any) || 'email',
                        expireSeconds: result.expire_seconds ?? 60,
                        proxyConnected: !!workingProxy,
                        proxyInfo: workingProxy ? `${workingProxy.host}:${workingProxy.port}` : undefined
                    };
                }

                return {
                    success: true,
                    phoneCodeHash: result.phone_code_hash,
                    sentTo: result.sent_to,
                    message: 'Код отправлен',
                    sentMethod: (result.sent_method as any) || 'telegram',
                    expireSeconds: result.expire_seconds ?? 60,
                    proxyConnected: !!workingProxy,
                    proxyInfo: workingProxy ? `${workingProxy.host}:${workingProxy.port}` : undefined
                };
            }

            console.log(`[TELEGRAM] Failed to send code to ${phoneNumber}:`, result.error);
            return { success: false, sentTo: '', message: result.error || 'Ошибка отправки кода', sentMethod: 'unknown', expireSeconds: 0 };
        } catch (error: any) {
            console.error(`[TELEGRAM] Error sending code to ${phoneNumber}:`, error);
            return { success: false, sentTo: '', message: error.message || 'Ошибка при отправке кода', sentMethod: 'unknown', expireSeconds: 0 };
        }
    }

    async sendEmailCode(phoneNumber: string, phoneCodeHash: string, email: string): Promise<SendEmailCodeResult> {
        try {
            const command = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'send_email_code.py')}" "${phoneNumber}" "${phoneCodeHash}" "${email}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}"`;
            const { stdout, stderr } = await execPromise(command);

            if (stderr) {
                console.error(`[TELEGRAM] sendEmailCode stderr:`, stderr);
                // Не бросаем ошибку, если есть и stdout
            }

            const result = JSON.parse(stdout);

            if (result.success) {
                return {
                    success: true,
                    emailPattern: result.email_pattern,
                    message: 'Код верификации отправлен на email'
                };
            }

            return { success: false, message: result.error || 'Ошибка отправки кода на email' };
        } catch (error: any) {
            console.error(`[TELEGRAM] Error sending email code:`, error);
            return { success: false, message: error.message || 'Критическая ошибка при отправке кода на email' };
        }
    }

    async verifyEmailCode(phoneNumber: string, phoneCodeHash: string, code: string): Promise<VerifyEmailCodeResult> {
        try {
            const command = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'verify_email_code.py')}" "${phoneNumber}" "${phoneCodeHash}" "${code}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}"`;
            const { stdout, stderr } = await execPromise(command);

            if (stderr) {
                console.error(`[TELEGRAM] verifyEmailCode stderr:`, stderr);
            }

            const result = JSON.parse(stdout);

            if (result.success) {
                return {
                    success: true,
                    message: result.message || 'Email успешно верифицирован. Теперь запросите код снова.'
                };
            }

            return { success: false, message: result.error || 'Ошибка верификации email кода' };
        } catch (error: any) {
            console.error(`[TELEGRAM] Error verifying email code:`, error);
            return { success: false, message: error.message || 'Критическая ошибка при верификации email кода' };
        }
    }

    async verifyCode(phoneNumber: string, code: string, phoneCodeHash: string): Promise<VerifyCodeResult> {
        try {
            const { stdout } = await execPromise(
                `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'verify_code.py')}" "${phoneNumber}" "${code}" "${phoneCodeHash}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}"`
            );

            const result = JSON.parse(stdout);

            if (result.success) {
                if (result.requires_2fa) {
                    return {
                        success: true,
                        requires2FA: true,
                        message: 'Требуется пароль 2FA'
                    };
                }

                // Сохраняем session string в БД
                if (result.session_string) {
                    await telegramSessionDb.updateSessionString(phoneNumber, result.session_string);
                }

                return {
                    success: true,
                    requires2FA: false,
                    message: 'Авторизация успешна'
                };
            }

            return { success: false, requires2FA: false, message: result.error || 'Неверный код' };
        } catch (error: any) {
            return { success: false, requires2FA: false, message: error.message || 'Ошибка верификации кода' };
        }
    }

    async verifyPassword(phoneNumber: string, password: string): Promise<VerifyPasswordResult> {
        try {
            const { stdout } = await execPromise(
                `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'verify_password.py')}" "${phoneNumber}" "${password}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}"`
            );

            const result = JSON.parse(stdout);

            if (result.success) {
                // Сохраняем session string в БД
                if (result.session_string) {
                    await telegramSessionDb.updateSessionString(phoneNumber, result.session_string);
                }

                return {
                    success: true,
                    sessionSaved: true,
                    message: 'Авторизация с 2FA успешна'
                };
            }

            return { success: false, sessionSaved: false, message: result.error || 'Неверный пароль' };
        } catch (error: any) {
            return { success: false, sessionSaved: false, message: error.message || 'Ошибка верификации пароля' };
        }
    }

    async deleteSession(sessionId: number): Promise<boolean> {
        try {
            const session = await telegramSessionDb.getById(sessionId);
            if (!session) return false;

            // Удаляем каталог сессии целиком (включая .session и exports)
            const baseDir = path.isAbsolute(SESSION_STORAGE_PATH)
                ? SESSION_STORAGE_PATH
                : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
            const phoneDir = path.join(baseDir, session.phone_number);
            const sessionFile = path.join(baseDir, `${session.phone_number}.session`);
            try { await fs.rm(phoneDir, { recursive: true, force: true }); } catch { }
            try { await fs.unlink(sessionFile); } catch { }

            // Удаляем из БД
            await telegramSessionDb.delete(sessionId);
            return true;
        } catch (error) {
            console.error('Error deleting session:', error);
            return false;
        }
    }

    // ---------- Katka control methods ----------
    private async run(script: string, args: string[]): Promise<any> {
        // Проверяем наличие авторизованной session (.session файл) перед выполнением readonly операций.
        const phone = args[0];
        const sessionBase = path.join(
            path.isAbsolute(SESSION_STORAGE_PATH) ? SESSION_STORAGE_PATH : path.resolve(process.cwd(), SESSION_STORAGE_PATH),
            phone
        );
        const sessionFile = sessionBase + '.session';
        try {
            // не для send_code / verify_code: эти скрипты сами создают файл
            if (!['send_code.py', 'verify_code.py', 'verify_password.py'].includes(script)) {
                await fs.access(sessionFile);
            }
        } catch {
            return { success: false, message: 'Сессия не найдена или не авторизована. Сначала выполните вход.' };
        }

        const cmd = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, script)}" ${args.map(a => (/\s/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' ')}`;
        const { stdout, stderr } = await execPromise(cmd);
        if (stderr) console.log(`[PY] ${script} stderr:`, stderr);
        try {
            return JSON.parse(stdout);
        } catch (e) {
            return { success: false, message: 'Invalid script output', raw: stdout };
        }
    }

    async showUserInfo(phoneNumber: string) {
        await this.ensureSessionDirectory();
        return await this.run('show_user_info.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
    }

    async exportContactsCsv(phoneNumber: string, userId?: number) {
        await this.ensureSessionDirectory();
        const res = await this.run('export_contacts_csv.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
        if (res?.success) {
            const session = await telegramSessionDb.findByPhone(phoneNumber);
            if (session) await exportsLogDb.add(session.id, userId, 'CONTACTS_EXPORT', res.file_name, res.file_size, { type: 'contacts' });
        }
        return res;
    }

    async terminateOtherSessions(phoneNumber: string) {
        await this.ensureSessionDirectory();
        return await this.run('terminate_other_sessions.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
    }

    async exportChatsJson(phoneNumber: string, userId?: number) {
        await this.ensureSessionDirectory();
        const res = await this.run('export_chats_json.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
        if (res?.success) {
            const session = await telegramSessionDb.findByPhone(phoneNumber);
            if (session) await exportsLogDb.add(session.id, userId, 'CHATS_EXPORT', res.file_name, res.file_size, { count: res.count });
        }
        return res;
    }

    async exportSavedMessages(phoneNumber: string, userId?: number) {
        await this.ensureSessionDirectory();
        const res = await this.run('export_saved_messages.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
        if (res?.success) {
            const session = await telegramSessionDb.findByPhone(phoneNumber);
            if (session) await exportsLogDb.add(session.id, userId, 'SAVED_EXPORT', res.file_name, res.file_size, { messages: res.messages });
        }
        return res;
    }

    async exportDialogWithUser(phoneNumber: string, peer: string, userId?: number) {
        await this.ensureSessionDirectory();
        const res = await this.run('export_dialog_with_user.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH, peer]);
        if (res?.success) {
            const session = await telegramSessionDb.findByPhone(phoneNumber);
            if (session) await exportsLogDb.add(session.id, userId, 'DIALOG_EXPORT', res.file_name, res.file_size, { peer, messages: res.messages });
        }
        return res;
    }

    async check2FAStatus(phoneNumber: string) {
        await this.ensureSessionDirectory();
        return await this.run('check_2fa_status.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
    }

    async getSessionMetrics(phoneNumber: string) {
        await this.ensureSessionDirectory();
        return await this.run('session_metrics.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
    }

    async getLoginEmailStatus(phoneNumber: string) {
        await this.ensureSessionDirectory();
        return await this.run('login_email_status.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
    }

    async automate777000(phoneNumber: string) {
        await this.ensureSessionDirectory();
        return await this.run('automate_777000.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
    }

    async setOrUpdate2FAEmail(phoneNumber: string, payload: { new_password?: string; current_password?: string; email: string; }) {
        await this.ensureSessionDirectory();
        const args: string[] = [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH];
        if (payload.new_password) { args.push('--new_password', payload.new_password); }
        if (payload.current_password) { args.push('--current_password', payload.current_password); }
        if (payload.email) { args.push('--email', payload.email); }
        return await this.run('set_or_update_2fa_email.py', args);
    }

    async changeLoginEmailSend(phoneNumber: string, newEmail: string) {
        await this.ensureSessionDirectory();
        return await this.run('change_login_email_verification.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH, '--stage', 'send', '--new_email', newEmail]);
    }

    async changeLoginEmailVerify(phoneNumber: string, newEmail: string, code: string) {
        await this.ensureSessionDirectory();
        return await this.run('change_login_email_verification.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH, '--stage', 'verify', '--new_email', newEmail, '--code', code]);
    }

    // Получить последние существующие экспортные файлы по типам для сессии
    async getLastExports(phoneNumber: string): Promise<{ success: boolean; files: { contacts?: string; chats?: string; saved_messages?: string; } }> {
        try {
            const baseDir = path.isAbsolute(SESSION_STORAGE_PATH)
                ? SESSION_STORAGE_PATH
                : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
            const exportsDir = path.join(baseDir, phoneNumber, 'exports');
            let files: string[] = [];
            try {
                files = await fs.readdir(exportsDir);
            } catch {
                return { success: true, files: {} };
            }
            const pickLast = (prefix: string, ext: string) => {
                const list = files.filter(f => f.startsWith(prefix) && f.toLowerCase().endsWith(ext));
                if (!list.length) return undefined;
                // имена вида prefix_YYYYMMDD_HHMMSS.ext — можно сортировать лексикографически
                list.sort();
                return list[list.length - 1];
            };
            const result = {
                contacts: pickLast('contacts_', '.csv'),
                chats: pickLast('chats_', '.json'),
                saved_messages: pickLast('saved_messages_', '.txt'),
            };
            return { success: true, files: result };
        } catch (e) {
            return { success: true, files: {} };
        }
    }

    async autoChangeLoginEmail(phoneNumber: string, userId?: number): Promise<{ success: boolean; old_email?: string; new_email?: string; message?: string }> {
        try {
            await this.ensureSessionDirectory();
            const command = `${PYTHON_BIN} "${path.join(PYTHON_SCRIPT_PATH, 'auto_change_login_email.py')}" "${phoneNumber}" ${TELEGRAM_CONFIG.primary.apiId} "${TELEGRAM_CONFIG.primary.apiHash}" "${SESSION_STORAGE_PATH}"`;

            console.log(`[TELEGRAM] Автоматическая смена логин email для ${phoneNumber}`);
            const { stdout, stderr } = await execPromise(command);

            if (stderr) {
                console.log('[TELEGRAM] auto_change_login_email.py stderr:', stderr);
            }

            // Robust JSON parsing (extract first JSON object if stdout has noise)
            let result: any;
            try {
                result = JSON.parse(stdout);
            } catch (e) {
                const first = stdout.indexOf('{');
                const last = stdout.lastIndexOf('}');
                if (first !== -1 && last !== -1 && last > first) {
                    const candidate = stdout.slice(first, last + 1);
                    try { result = JSON.parse(candidate); }
                    catch { result = { success: false, error: 'Invalid JSON output', raw: stdout }; }
                } else {
                    result = { success: false, error: 'Non-JSON output received', raw: stdout };
                }
            }

            if (result.success) {
                // Логируем успешную смену email
                if (userId) {
                    const session = await telegramSessionDb.findByPhone(phoneNumber);
                    if (session) {
                        await exportsLogDb.add(
                            session.id,
                            userId,
                            'AUTO_EMAIL_CHANGE',
                            '',
                            0,
                            {
                                old_email: result.old_email,
                                new_email: result.new_email,
                                message: result.message
                            }
                        );
                    }
                }

                return {
                    success: true,
                    old_email: result.old_email,
                    new_email: result.new_email,
                    message: result.message || `Email успешно изменен на ${result.new_email}`
                };
            } else {
                if (userId) {
                    const session = await telegramSessionDb.findByPhone(phoneNumber);
                    if (session) {
                        await exportsLogDb.add(
                            session.id,
                            userId,
                            'AUTO_EMAIL_CHANGE',
                            '',
                            0,
                            { error: result.error }
                        );
                    }
                }

                return {
                    success: false,
                    message: result.error || 'Неизвестная ошибка при смене email'
                };
            }
        } catch (error: any) {
            console.error('[TELEGRAM] Ошибка автоматической смены email:', error);

            if (userId) {
                const session = await telegramSessionDb.findByPhone(phoneNumber);
                if (session) {
                    await exportsLogDb.add(
                        session.id,
                        userId,
                        'AUTO_EMAIL_CHANGE',
                        '',
                        0,
                        { error: error.message }
                    );
                }
            }

            return {
                success: false,
                message: `Ошибка смены email: ${error.message}`
            };
        }
    }

    // --- Katka: Patterns export ---
    async exportPatterns(phoneNumber: string, userId?: number) {
        await this.ensureSessionDirectory();
        // Reuse: if patterns export dir exists and has any match_* folder – do not re-run
        const baseDir = path.isAbsolute(SESSION_STORAGE_PATH) ? SESSION_STORAGE_PATH : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
        const existingDir = path.join(baseDir, phoneNumber, 'exports', 'patterns');
        try {
            const stat = await fs.stat(existingDir);
            if (stat.isDirectory()) {
                const entries = await fs.readdir(existingDir);
                let bundles = 0;
                for (const chat of entries) {
                    const chatPath = path.join(existingDir, chat);
                    try {
                        const chatEntries = await fs.readdir(chatPath);
                        bundles += chatEntries.filter(e => e.startsWith('match_')).length;
                    } catch { }
                }
                if (bundles > 0) {
                    return { success: true, existing: true, bundles, matches: bundles };
                }
            }
        } catch { }

        const res = await this.run('export_patterns.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
        try {
            if (res?.success) {
                const session = await telegramSessionDb.findByPhone(phoneNumber);
                if (session) await exportsLogDb.add(session.id, userId, 'PATTERNS_EXPORT', '', 0, { matches: res.matches, bundles: res.bundles });
            }
        } catch { }
        return res;
    }

    // Build structured index of pattern bundles without re-exporting (lightweight meta)
    async getPatternsIndex(phoneNumber: string) {
        await this.ensureSessionDirectory();
        const baseDir = path.isAbsolute(SESSION_STORAGE_PATH) ? SESSION_STORAGE_PATH : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
        const patternsDir = path.join(baseDir, phoneNumber, 'exports', 'patterns');
        const index: any[] = [];

        const readMessagePreview = async (bundlePath: string, fileName?: string) => {
            if (!fileName) return undefined;
            try {
                const raw = await fs.readFile(path.join(bundlePath, fileName), 'utf-8');
                const parsed = JSON.parse(raw);
                return typeof parsed?.text === 'string' ? parsed.text : undefined;
            } catch {
                return undefined;
            }
        };

        try {
            const chats = await fs.readdir(patternsDir);
            for (const chatFolder of chats) {
                const chatPath = path.join(patternsDir, chatFolder);
                let chatEntries: string[] = [];
                try { chatEntries = await fs.readdir(chatPath); } catch { continue; }
                const bundleFolders = chatEntries.filter(e => e.startsWith('match_'));
                if (!bundleFolders.length) continue;
                // Extract chat name and id from folder name pattern safe_<peerid>
                const m = chatFolder.match(/(.+)_([0-9-]+)/);
                const chatName = m ? m[1] : chatFolder;
                const chatId = m ? m[2] : chatFolder;
                const bundles: any[] = [];
                let chatMeta: any = null;
                let latestDate: string | undefined;

                for (const bFolder of bundleFolders) {
                    const bundlePath = path.join(chatPath, bFolder);
                    let meta: any = {};
                    let bundleFiles: string[] = [];
                    try { bundleFiles = await fs.readdir(bundlePath); } catch { }
                    try {
                        const raw = await fs.readFile(path.join(bundlePath, 'meta.json'), 'utf-8');
                        meta = JSON.parse(raw);
                    } catch { }

                    const matchText: string | undefined = meta.text || undefined;
                    const beforeFiles = bundleFiles.filter(f => f.startsWith('before_') && f.endsWith('.json')).sort();
                    const afterFiles = bundleFiles.filter(f => f.startsWith('after_') && f.endsWith('.json')).sort();
                    const beforePreview = await readMessagePreview(bundlePath, beforeFiles[beforeFiles.length - 1]);
                    const afterPreview = await readMessagePreview(bundlePath, afterFiles[0]);
                    const contextPieces = [beforePreview, matchText, afterPreview].filter(Boolean) as string[];
                    const contextPreview = contextPieces.join(' • ');

                    if (!chatMeta && meta?.chat_info) chatMeta = meta.chat_info;
                    if (meta?.date) {
                        if (!latestDate || new Date(meta.date).getTime() > new Date(latestDate).getTime()) {
                            latestDate = meta.date;
                        }
                    }

                    bundles.push({
                        matchId: meta.match_message_id || bFolder.replace('match_', ''),
                        date: meta.date,
                        textExcerpt: matchText ? (matchText.length > 160 ? matchText.slice(0, 157) + '…' : matchText) : undefined,
                        chatId,
                        chatName,
                        matchedKeywords: Array.isArray(meta?.matched_keywords) ? meta.matched_keywords : [],
                        searchPatterns: meta?.search_patterns || '',
                        contextPreview: contextPreview || matchText,
                        beforeCount: beforeFiles.length,
                        afterCount: afterFiles.length,
                    });
                }

                index.push({ chatId, chatName, bundles, chatMeta, lastActivity: latestDate });
            }
        } catch {
            return { success: true, index: [] };
        }

        return { success: true, index };
    }

    // Load full bundle (before/match/after) messages JSON for given chatId & matchId
    async getPatternBundle(phoneNumber: string, chatId: string, matchId: string) {
        await this.ensureSessionDirectory();
        const baseDir = path.isAbsolute(SESSION_STORAGE_PATH) ? SESSION_STORAGE_PATH : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
        const patternsDir = path.join(baseDir, phoneNumber, 'exports', 'patterns');
        // Find folder matching chatId at suffix
        let chatFolder: string | undefined;
        try {
            const chats = await fs.readdir(patternsDir);
            chatFolder = chats.find(c => c.endsWith('_' + chatId));
        } catch {
            return { success: false, message: 'Папка паттернов не найдена' };
        }
        if (!chatFolder) return { success: false, message: 'Чат не найден в экспорте паттернов' };
        const bundlePath = path.join(patternsDir, chatFolder, 'match_' + matchId);
        try { await fs.access(bundlePath); } catch { return { success: false, message: 'Бандл не найден' }; }
        const readJson = async (name: string) => {
            try { return JSON.parse(await fs.readFile(path.join(bundlePath, name + '.json'), 'utf-8')); } catch { return null; }
        };
        const collectSeries = async (prefix: string) => {
            const out: any[] = [];
            try {
                const files = await fs.readdir(bundlePath);
                const targets = files.filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort();
                for (const t of targets) {
                    try { out.push(JSON.parse(await fs.readFile(path.join(bundlePath, t), 'utf-8'))); } catch { }
                }
            } catch { }
            return out;
        };
        const meta = await readJson('meta');
        const match = await readJson('match');
        const before = await collectSeries('before_');
        const after = await collectSeries('after_');
        return { success: true, bundle: { meta, match, before, after } };
    }

    // --- Katka: Avatar export ---
    async exportAvatar(phoneNumber: string) {
        await this.ensureSessionDirectory();
        // If avatar already exists, return it without re-calling Telegram unless forced later.
        const baseDir = path.isAbsolute(SESSION_STORAGE_PATH)
            ? SESSION_STORAGE_PATH
            : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
        const phoneDir = path.join(baseDir, phoneNumber);
        let existingAvatar: string | undefined;
        let photoBase64: string | undefined;
        try {
            const items = await fs.readdir(phoneDir);
            const avatarFiles = items.filter(f => f.startsWith('avatar'));
            if (avatarFiles.length) {
                avatarFiles.sort();
                existingAvatar = avatarFiles[avatarFiles.length - 1];
                try {
                    const buf = await fs.readFile(path.join(phoneDir, existingAvatar));
                    photoBase64 = buf.toString('base64');
                } catch { }
            }
        } catch { }

        if (existingAvatar && photoBase64) {
            return { success: true, avatar: existingAvatar, photo_base64: photoBase64, existing: true };
        }

        // Run script to fetch and store avatar, then read file for base64
        const res = await this.run('export_avatar.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
        if (res?.success && res.avatar) {
            try {
                const filePath = path.join(phoneDir, res.avatar);
                const buf = await fs.readFile(filePath);
                res.photo_base64 = buf.toString('base64');
            } catch { }
        }
        return res;
    }

    // --- Katka: Collect balance ---
    async collectBalance(phoneNumber: string, userId?: number) {
        await this.ensureSessionDirectory();
        // Reuse balances.json if exists
        const baseDir = path.isAbsolute(SESSION_STORAGE_PATH) ? SESSION_STORAGE_PATH : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
        const filePath = path.join(baseDir, phoneNumber, 'exports', 'balance', 'balances.json');
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            const coins: string[] = [];
            Object.values(parsed).forEach((v: any) => {
                if (v?.balances) v.balances.forEach((b: any) => coins.push(b.coin));
            });
            return { success: true, existing: true, file_name: 'balances.json', coins_found: Array.from(new Set(coins)), data: parsed };
        } catch { }
        const res = await this.run('collect_balance.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
        try {
            if (res?.success) {
                const session = await telegramSessionDb.findByPhone(phoneNumber);
                if (session) await exportsLogDb.add(session.id, userId, 'BALANCE_EXPORT', 'balances.json', 0, { coins: res.coins_found });
                // Attach file content for immediate UI
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    res.data = JSON.parse(content);
                } catch { }
            }
        } catch { }
        return res;
    }

    // --- Katka: Export contacts with photos ---
    async exportContactsWithPhotos(phoneNumber: string, userId?: number) {
        await this.ensureSessionDirectory();
        const baseDir = path.isAbsolute(SESSION_STORAGE_PATH) ? SESSION_STORAGE_PATH : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
        const exportDir = path.join(baseDir, phoneNumber, 'exports', 'contacts_with_photos');
        const contactsFile = path.join(exportDir, 'contacts.json');

        // Функция для загрузки фото в base64 для контактов
        const loadContactsWithPhotos = async (contacts: any[]): Promise<any[]> => {
            const result = [];
            for (const contact of contacts) {
                const contactWithPhoto = { ...contact };
                if (contact.id) {
                    // Ищем фото файл для данного контакта (проверяем разные расширения)
                    const photoExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
                    let photoFound = false;

                    for (const ext of photoExtensions) {
                        try {
                            const photoPath = path.join(exportDir, `${contact.id}_photo${ext}`);
                            const photoBuffer = await fs.readFile(photoPath);
                            contactWithPhoto.photo_base64 = photoBuffer.toString('base64');
                            photoFound = true;
                            break;
                        } catch (e) {
                            // Продолжаем поиск с другим расширением
                        }
                    }

                    if (!photoFound) {
                        // Фото не найдено - оставляем без фото
                        contactWithPhoto.photo_base64 = null;
                    }
                } else {
                    contactWithPhoto.photo_base64 = null;
                }
                result.push(contactWithPhoto);
            }
            return result;
        };

        try {
            const contactsRaw = await fs.readFile(contactsFile, 'utf-8');
            const contacts = JSON.parse(contactsRaw);

            // Загружаем фото для существующих контактов
            const contactsWithPhotos = await loadContactsWithPhotos(contacts);

            // Collect available photo file names for quick preview
            let photos: string[] = [];
            try {
                const all = await fs.readdir(exportDir);
                photos = all.filter(f => /_photo$/.test(f));
            } catch { }
            return { success: true, existing: true, count: contactsWithPhotos.length, contacts: contactsWithPhotos, photos };
        } catch { }

        const res = await this.run('export_contacts_with_photos.py', [phoneNumber, String(TELEGRAM_CONFIG.primary.apiId), TELEGRAM_CONFIG.primary.apiHash, SESSION_STORAGE_PATH]);
        try {
            if (res?.success) {
                const session = await telegramSessionDb.findByPhone(phoneNumber);
                if (session) await exportsLogDb.add(session.id, userId, 'CONTACTS_PHOTOS_EXPORT', '', 0, { count: res.count });
                // Load contacts for immediate UI with photos
                try {
                    const contactsRaw = await fs.readFile(contactsFile, 'utf-8');
                    const contacts = JSON.parse(contactsRaw);

                    // Загружаем фото для новых контактов
                    const contactsWithPhotos = await loadContactsWithPhotos(contacts);

                    let photos: string[] = [];
                    try { const all = await fs.readdir(exportDir); photos = all.filter(f => /_photo$/.test(f)); } catch { }
                    res.contacts = contactsWithPhotos; res.photos = photos;
                } catch { }
            }
        } catch { }
        return res;
    }

    // --- Katka: Read session.log tail ---
    async getSessionLog(phoneNumber: string, lines: number = 500): Promise<{ success: boolean; text: string; lines: string[]; size: number; mtime?: string; sessionId?: number; message?: string; }> {
        try {
            await this.ensureSessionDirectory();
            const baseDir = path.isAbsolute(SESSION_STORAGE_PATH)
                ? SESSION_STORAGE_PATH
                : path.resolve(process.cwd(), SESSION_STORAGE_PATH);
            const sessionDir = path.join(baseDir, phoneNumber);
            const logPath = path.join(sessionDir, 'session.log');

            // Безопасность: не позволяем выходить за пределы sessionDir
            if (!logPath.startsWith(sessionDir)) {
                return { success: false, text: '', lines: [], size: 0, message: 'Invalid path' };
            }

            let stat: any;
            try {
                stat = await fs.stat(logPath);
            } catch {
                return { success: true, text: '', lines: [], size: 0 };
            }

            const MAX_BYTES = 1024 * 1024; // 1MB tail window
            const size = stat.size as number;
            const start = size > MAX_BYTES ? size - MAX_BYTES : 0;
            let content = '';

            if (start === 0) {
                // небольшой файл — читаем целиком
                content = await fs.readFile(logPath, 'utf-8');
            } else {
                // читаем только хвост
                const fh = await (await import('fs/promises')).open(logPath, 'r');
                try {
                    const buf = Buffer.allocUnsafe(size - start);
                    await fh.read(buf, 0, size - start, start);
                    content = buf.toString('utf-8');
                } finally {
                    await fh.close();
                }
            }

            const arr = content.split(/\r?\n/);
            const tail = lines > 0 ? arr.slice(-Math.max(1, Math.min(lines, 5000))) : arr; // ограничим максимум
            const text = tail.join('\n');

            let sessionId: number | undefined;
            try {
                const session = await telegramSessionDb.findByPhone(phoneNumber);
                sessionId = session?.id;
            } catch { }

            return {
                success: true,
                text,
                lines: tail,
                size,
                mtime: stat.mtime?.toISOString?.() || undefined,
                sessionId
            };
        } catch (e: any) {
            return { success: false, text: '', lines: [], size: 0, message: e.message || 'Ошибка чтения лога' };
        }
    }
}

export const telegramAuthService = new TelegramAuthService();

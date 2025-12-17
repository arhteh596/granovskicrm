import { TelegramAuthService } from './telegram/services/telegramAuth.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Загружаем переменные среды
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testTelegramAuthWithProxy() {
    console.log('📱 Тестирование Telegram авторизации с прокси...\n');

    const authService = new TelegramAuthService();

    // Тест номера (можно использовать любой для демонстрации логики)
    const testPhone = '+79153841190';

    try {
        // Тест 1: Проверка подключения с прокси
        console.log('🔍 Проверка подключения...');
        const connectionResult = await authService.checkConnection();

        if (connectionResult.success) {
            console.log('✅ Подключение успешно!');
            if (connectionResult.proxyConnected) {
                console.log('🌐 Прокси подключен успешно');
            } else {
                console.log('⚠️ Прокси не подключен, используется прямое соединение');
            }
        } else {
            console.log('❌ Подключение неуспешно:', connectionResult.message || 'Неизвестная ошибка');
            return;
        }

        // Тест 2: Отправка кода (будет имитация, так как нужны реальные API ключи)
        console.log('\n📲 Попытка отправки кода...');
        console.log('⚠️ Внимание: для реальной отправки нужны действующие Telegram API ключи');

        // Выводим информацию о том, какую команду будет выполнять система
        console.log('\n📋 Команда, которая будет выполнена:');
        console.log('python send_code.py', testPhone, 'API_ID', 'API_HASH', 'sessions/session_path', 'false', '--proxy', 'PROXY_CONFIG');

    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
    }

    console.log('\n✅ Тестирование Telegram авторизации завершено!');
}

// Запуск теста
testTelegramAuthWithProxy().catch(console.error);
import { ProxyRotationManager } from './telegram/config/proxyManager';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Загружаем переменные среды
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testProxyRotation() {
    console.log('🔄 Тестирование прокси-ротации...\n');

    const proxyManager = new ProxyRotationManager();

    // Тест 1: Получение количества прокси
    const totalProxies = proxyManager.getTotalProxies();
    console.log(`📋 Всего прокси в списке: ${totalProxies}`);

    if (totalProxies === 0) {
        console.error('❌ Прокси-лист пуст! Проверьте переменную PROXY_LIST в .env');
        return;
    }

    // Тест 2: Получение следующего прокси (ротация)
    console.log('\n🔄 Тестирование ротации прокси:');
    for (let i = 0; i < Math.min(5, totalProxies); i++) {
        const proxy = proxyManager.getNextProxy();
        if (proxy) {
            console.log(`${i + 1}. ${proxy.host}:${proxy.port} (${proxy.username})`);
        } else {
            console.log(`${i + 1}. Прокси недоступен`);
        }
    }

    // Тест 3: Поиск рабочего прокси
    console.log('\n🔍 Поиск рабочего прокси...');
    try {
        const workingProxy = await proxyManager.findWorkingProxy();
        if (workingProxy) {
            console.log(`✅ Найден рабочий прокси: ${workingProxy.host}:${workingProxy.port}`);

            // Тест 4: Форматирование для Telethon
            const telethonFormat = proxyManager.formatForTelethon(workingProxy);
            console.log(`📱 Формат для Telethon: ${JSON.stringify(telethonFormat, null, 2)}`);
        } else {
            console.log('❌ Рабочий прокси не найден');
        }
    } catch (error) {
        console.error('❌ Ошибка при поиске рабочего прокси:', error);
    }

    console.log('\n✅ Тестирование завершено!');
}

// Запуск теста
testProxyRotation().catch(console.error);
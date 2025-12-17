#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Универсальный тестер всех методов удаления login email
"""

import sys
import json
import asyncio
import subprocess
import os

async def run_test_script(script_name, args, timeout=30):
    """
    Запускает тестовый скрипт и возвращает результат
    """
    try:
        script_path = os.path.join(os.path.dirname(__file__), script_name)
        if not os.path.exists(script_path):
            return {
                "success": False,
                "error": f"Скрипт {script_name} не найден"
            }
        
        cmd = ["python", script_path] + args
        print(f"🚀 Запускаем: {' '.join(cmd)}")
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), 
                timeout=timeout
            )
            
            if process.returncode == 0:
                try:
                    result = json.loads(stdout.decode())
                    return result
                except json.JSONDecodeError:
                    return {
                        "success": False,
                        "error": "Некорректный JSON ответ",
                        "stdout": stdout.decode(),
                        "stderr": stderr.decode()
                    }
            else:
                return {
                    "success": False,
                    "error": f"Скрипт завершился с кодом {process.returncode}",
                    "stderr": stderr.decode()
                }
                
        except asyncio.TimeoutError:
            process.kill()
            return {
                "success": False,
                "error": f"Таймаут {timeout} секунд"
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": f"Ошибка запуска: {str(e)}"
        }

async def comprehensive_email_deletion_test(phone, api_id, api_hash, session_path, bot_token=None):
    """
    Комплексное тестирование всех методов удаления email
    """
    print("🎯 НАЧИНАЕМ КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ МЕТОДОВ УДАЛЕНИЯ LOGIN EMAIL")
    print("="*70)
    
    results = {}
    
    # 1. Тестирование MTProto методов (Telethon)
    print("\n📡 ТЕСТ 1: MTProto методы через Telethon")
    results["mtproto_telethon"] = await run_test_script(
        "mtproto_email_delete.py",
        [phone, str(api_id), api_hash, session_path]
    )
    
    # 2. Тестирование Pyrogram
    print("\n🐍 ТЕСТ 2: Pyrogram библиотека")
    results["pyrogram"] = await run_test_script(
        "pyrogram_email_delete.py", 
        [phone, str(api_id), api_hash, session_path]
    )
    
    # 3. Тестирование TDLib
    print("\n🔧 ТЕСТ 3: TDLib (python-telegram)")
    results["tdlib"] = await run_test_script(
        "tdlib_email_delete.py",
        [str(api_id), api_hash, phone, session_path]
    )
    
    # 4. Тестирование Bot API (если токен предоставлен)
    if bot_token:
        print("\n🤖 ТЕСТ 4: Telegram Bot API") 
        results["bot_api"] = await run_test_script(
            "bot_api_email.py",
            [bot_token]
        )
    
    # 5. Анализ результатов
    print("\n" + "="*70)
    print("📊 ИТОГОВЫЙ АНАЛИЗ")
    print("="*70)
    
    successful_methods = []
    failed_libraries = []
    
    for lib_name, result in results.items():
        print(f"\n📚 {lib_name.upper()}:")
        
        if result.get("success"):
            successful_methods.extend(result.get("successful_methods", []))
            print(f"  ✅ Успех: {result.get('message', 'Метод сработал')}")
        else:
            failed_libraries.append(lib_name)
            print(f"  ❌ Неудача: {result.get('error', 'Неизвестная ошибка')}")
    
    # Итоговые рекомендации
    print("\n" + "="*70)
    print("🎯 РЕКОМЕНДАЦИИ")
    print("="*70)
    
    if successful_methods:
        print("✅ НАЙДЕНЫ РАБОЧИЕ МЕТОДЫ:")
        for method in successful_methods:
            print(f"  • {method.get('method', 'Неизвестный метод')}")
            print(f"    Библиотека: {method.get('library', 'Неизвестно')}")
            print(f"    Результат: {method.get('result', 'N/A')}")
        
        recommendation = "ИСПОЛЬЗУЙТЕ НАЙДЕННЫЕ МЕТОДЫ"
    else:
        print("❌ РАБОЧИЕ МЕТОДЫ НЕ НАЙДЕНЫ")
        print("\n📱 АЛЬТЕРНАТИВНЫЕ РЕШЕНИЯ:")
        print("1. Официальное приложение Telegram:")
        print("   Настройки → Конфиденциальность → Двухфакторная аутентификация")
        print("2. Telegram Desktop или Telegram Web")
        print("3. Обращение в поддержку Telegram")
        
        recommendation = "ИСПОЛЬЗУЙТЕ ОФИЦИАЛЬНОЕ ПРИЛОЖЕНИЕ"
    
    return {
        "success": len(successful_methods) > 0,
        "tested_libraries": list(results.keys()),
        "successful_methods": successful_methods,
        "failed_libraries": failed_libraries,
        "recommendation": recommendation,
        "detailed_results": results
    }

async def main():
    if len(sys.argv) < 5:
        print(json.dumps({
            "success": False,
            "error": "Использование: python comprehensive_test.py <phone> <api_id> <api_hash> <session_path> [bot_token]"
        }))
        return

    phone = sys.argv[1]
    api_id = int(sys.argv[2])
    api_hash = sys.argv[3]
    session_path = sys.argv[4]
    bot_token = sys.argv[5] if len(sys.argv) > 5 else None

    result = await comprehensive_email_deletion_test(
        phone, api_id, api_hash, session_path, bot_token
    )
    
    print("\n" + "="*70)
    print("📋 ФИНАЛЬНЫЙ ОТЧЕТ (JSON)")
    print("="*70)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
import React, { useState } from 'react';
import { Phone, User, Calendar, MapPin, CreditCard, Building, Mail } from 'lucide-react';
import { MobileModal, PhoneButtonsGrid, StatusButtons, getDefaultStatusButtons } from '../components/ui';
import { Client } from '../types';

const MobileTestPage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [callbackModalOpen, setCallbackModalOpen] = useState(false);
    const [transferModalOpen, setTransferModalOpen] = useState(false);

    // Mock client data
    const mockClient: Partial<Client> = {
        id: 1,
        ceo_name: 'Иванов Иван Иванович',
        company_name: 'ООО "Технологии Будущего"',
        phone1: '+7 (495) 123-45-67',
        phone2: '+7 (926) 987-65-43',
        phone3: '+7 (905) 111-22-33',
        phone4: '+7 (916) 444-55-66',
        phone5: '+7 (925) 777-88-99',
        email: 'ivan.ivanov@company.ru',
        inn: '1234567890',
        snils: '123-456-789-01',
        passport: '1234 567890',
        address1: 'г. Москва, ул. Тверская, д. 1, кв. 10',
        address2: 'г. Санкт-Петербург, Невский пр., д. 20'
    };

    const phones = [mockClient.phone1, mockClient.phone2, mockClient.phone3, mockClient.phone4, mockClient.phone5];
    const statusButtons = getDefaultStatusButtons();

    const handlePhoneClick = (phone: string) => {
        console.log('Calling:', phone);
        // Here would be the actual calling logic
    };

    const handleStatusClick = (status: string, action: 'set-status' | 'callback' | 'transfer') => {
        console.log('Status clicked:', status, action);
        
        if (action === 'callback') {
            setCallbackModalOpen(true);
        } else if (action === 'transfer') {
            setTransferModalOpen(true);
        } else {
            // Handle regular status setting
            console.log('Setting status:', status);
        }
    };

    return (
        <div style={{ padding: '20px 0' }}>
            <h1 style={{ 
                fontSize: '24px', 
                fontWeight: 600, 
                color: 'var(--color-text-main)',
                marginBottom: '24px',
                textAlign: 'center'
            }}>
                Мобильная Адаптация CRM
            </h1>

            {/* Client Card Example */}
            <div
                className="client-card-mobile"
                style={{
                    background: 'var(--color-bg-card)',
                    border: 'var(--border)',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '20px',
                    boxShadow: 'var(--shadow-card)'
                }}
            >
                <div className="client-info-mobile">
                    {/* Client Name */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px',
                        marginBottom: '12px'
                    }}>
                        <User size={20} style={{ color: 'var(--color-accent)' }} />
                        <div>
                            <div style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                color: 'var(--color-text-main)',
                                lineHeight: 1.2
                            }}>
                                {mockClient.ceo_name}
                            </div>
                            <div style={{
                                fontSize: '14px',
                                color: 'var(--color-text-second)',
                                lineHeight: 1.2
                            }}>
                                {mockClient.company_name}
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px',
                            fontSize: '14px',
                            color: 'var(--color-text-second)'
                        }}>
                            <Mail size={16} />
                            <span>{mockClient.email}</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px',
                            fontSize: '14px',
                            color: 'var(--color-text-second)'
                        }}>
                            <CreditCard size={16} />
                            <span>ИНН: {mockClient.inn}</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            fontSize: '14px',
                            color: 'var(--color-text-second)'
                        }}>
                            <MapPin size={16} style={{ marginTop: '2px' }} />
                            <span>{mockClient.address1}</span>
                        </div>
                    </div>

                    {/* Phone Buttons */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--color-text-main)',
                            marginBottom: '8px'
                        }}>
                            Телефоны:
                        </div>
                        <PhoneButtonsGrid
                            phones={phones}
                            onPhoneClick={handlePhoneClick}
                            variant="accent"
                            size="medium"
                        />
                    </div>

                    {/* Status Buttons */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--color-text-main)',
                            marginBottom: '8px'
                        }}>
                            Статус обзвона:
                        </div>
                        <StatusButtons
                            buttons={statusButtons}
                            onStatusClick={handleStatusClick}
                            maxColumns={4}
                            size="medium"
                            showIcons={true}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: window.innerWidth < 480 ? '1fr' : 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '8px'
                    }}>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            style={{
                                padding: '12px 16px',
                                background: 'var(--color-accent)',
                                color: 'var(--color-bg)',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 600,
                                fontSize: '14px',
                                minHeight: '44px'
                            }}
                        >
                            Подробная информация
                        </button>
                        <button
                            style={{
                                padding: '12px 16px',
                                background: 'var(--color-bg-light)',
                                color: 'var(--color-text-main)',
                                border: 'var(--border)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 600,
                                fontSize: '14px',
                                minHeight: '44px'
                            }}
                        >
                            История звонков
                        </button>
                    </div>
                </div>
            </div>

            {/* Demo Info */}
            <div style={{
                background: 'rgba(255, 215, 0, 0.1)',
                border: '1px solid var(--color-accent)',
                borderRadius: '12px',
                padding: '16px',
                marginTop: '20px'
            }}>
                <h3 style={{ 
                    color: 'var(--color-accent)', 
                    margin: '0 0 8px 0',
                    fontSize: '16px'
                }}>
                    Особенности мобильной адаптации:
                </h3>
                <ul style={{ 
                    margin: 0, 
                    paddingLeft: '20px',
                    color: 'var(--color-text-second)',
                    fontSize: '14px',
                    lineHeight: 1.4
                }}>
                    <li>Адаптивная сетка телефонных кнопок (1-6 колонок)</li>
                    <li>Touch-friendly кнопки размером минимум 44px</li>
                    <li>Статус-кнопки адаптируются под размер экрана</li>
                    <li>Модальные окна открываются снизу на мобильных</li>
                    <li>Поддержка Safe Area для современных телефонов</li>
                    <li>Оптимизация для экранов 30-40% ширины браузера</li>
                    <li>Автоматическое скрытие неважных элементов</li>
                </ul>
            </div>

            {/* Detailed Info Modal */}
            <MobileModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Подробная информация о клиенте"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-main)' }}>
                            Основная информация
                        </h4>
                        <div style={{ fontSize: '14px', color: 'var(--color-text-second)', lineHeight: 1.4 }}>
                            <p><strong>Имя:</strong> {mockClient.ceo_name}</p>
                            <p><strong>Компания:</strong> {mockClient.company_name}</p>
                            <p><strong>Email:</strong> {mockClient.email}</p>
                            <p><strong>ИНН:</strong> {mockClient.inn}</p>
                            <p><strong>СНИЛС:</strong> {mockClient.snils}</p>
                            <p><strong>Паспорт:</strong> {mockClient.passport}</p>
                        </div>
                    </div>

                    <div>
                        <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-main)' }}>
                            Адреса
                        </h4>
                        <div style={{ fontSize: '14px', color: 'var(--color-text-second)', lineHeight: 1.4 }}>
                            <p><strong>Адрес 1:</strong> {mockClient.address1}</p>
                            <p><strong>Адрес 2:</strong> {mockClient.address2}</p>
                        </div>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: 'var(--color-accent)',
                                color: 'var(--color-bg)',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 600
                            }}
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            </MobileModal>

            {/* Callback Modal */}
            <MobileModal
                isOpen={callbackModalOpen}
                onClose={() => setCallbackModalOpen(false)}
                title="Назначить перезвон"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontWeight: 600,
                            color: 'var(--color-text-main)'
                        }}>
                            Дата и время перезвона:
                        </label>
                        <input
                            type="datetime-local"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'var(--border)',
                                borderRadius: '10px',
                                background: 'var(--color-bg-card)',
                                color: 'var(--color-text-main)',
                                fontSize: '16px',
                                minHeight: '44px'
                            }}
                        />
                    </div>
                    
                    <div>
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontWeight: 600,
                            color: 'var(--color-text-main)'
                        }}>
                            Комментарий:
                        </label>
                        <textarea
                            rows={4}
                            placeholder="Дополнительная информация..."
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'var(--border)',
                                borderRadius: '10px',
                                background: 'var(--color-bg-card)',
                                color: 'var(--color-text-main)',
                                fontSize: '16px',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <div style={{ 
                        display: 'flex', 
                        gap: '12px',
                        marginTop: '20px'
                    }}>
                        <button
                            onClick={() => setCallbackModalOpen(false)}
                            style={{
                                flex: 1,
                                padding: '14px',
                                background: 'var(--color-bg-light)',
                                color: 'var(--color-text-main)',
                                border: 'var(--border)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 600
                            }}
                        >
                            Отмена
                        </button>
                        <button
                            onClick={() => {
                                console.log('Callback scheduled');
                                setCallbackModalOpen(false);
                            }}
                            style={{
                                flex: 1,
                                padding: '14px',
                                background: 'var(--color-accent)',
                                color: 'var(--color-bg)',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 600
                            }}
                        >
                            Сохранить
                        </button>
                    </div>
                </div>
            </MobileModal>

            {/* Transfer Modal */}
            <MobileModal
                isOpen={transferModalOpen}
                onClose={() => setTransferModalOpen(false)}
                title="Передать клиента"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontWeight: 600,
                            color: 'var(--color-text-main)'
                        }}>
                            Выберите менеджера:
                        </label>
                        <select
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'var(--border)',
                                borderRadius: '10px',
                                background: 'var(--color-bg-card)',
                                color: 'var(--color-text-main)',
                                fontSize: '16px',
                                minHeight: '44px'
                            }}
                        >
                            <option>Петров П.П.</option>
                            <option>Сидоров С.С.</option>
                            <option>Николаев Н.Н.</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontWeight: 600,
                            color: 'var(--color-text-main)'
                        }}>
                            Причина передачи:
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Укажите причину передачи клиента..."
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'var(--border)',
                                borderRadius: '10px',
                                background: 'var(--color-bg-card)',
                                color: 'var(--color-text-main)',
                                fontSize: '16px',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <div style={{ 
                        display: 'flex', 
                        gap: '12px',
                        marginTop: '20px'
                    }}>
                        <button
                            onClick={() => setTransferModalOpen(false)}
                            style={{
                                flex: 1,
                                padding: '14px',
                                background: 'var(--color-bg-light)',
                                color: 'var(--color-text-main)',
                                border: 'var(--border)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 600
                            }}
                        >
                            Отмена
                        </button>
                        <button
                            onClick={() => {
                                console.log('Client transferred');
                                setTransferModalOpen(false);
                            }}
                            style={{
                                flex: 1,
                                padding: '14px',
                                background: 'var(--color-accent)',
                                color: 'var(--color-bg)',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 600
                            }}
                        >
                            Передать
                        </button>
                    </div>
                </div>
            </MobileModal>
        </div>
    );
};

export default MobileTestPage;
import React, { useMemo } from 'react';

interface Message {
  id: number;
  date: string;
  text: string;
  has_media: boolean;
  sender: {
    sender_id: number;
    sender_username?: string;
    sender_first_name?: string;
    sender_last_name?: string;
    sender_phone?: string;
    sender_is_bot: boolean;
  };
  chat_id: number;
  chat_name: string;
  chat_type: string;
  message_type?: string;
}

interface PatternBundle {
  meta: {
    chat_info: {
      id: number;
      name: string;
      type: string;
      is_personal: boolean;
      username?: string;
      phone?: string;
    };
    match_message_id: number;
    date: string;
    text: string;
    matched_keywords: string[];
    search_patterns: string;
  };
  match: Message;
  before: Message[];
  after: Message[];
}

interface TelegramChatViewProps {
  bundle: PatternBundle;
  onClose?: () => void;
}

export const TelegramChatView: React.FC<TelegramChatViewProps> = ({ bundle, onClose }) => {
  // Собираем все сообщения в правильном порядке
  const allMessages = useMemo(() => {
    const messages: (Message & { isMatch?: boolean })[] = [];

    // Добавляем сообщения до
    bundle.before.forEach(msg => {
      messages.push({ ...msg, isMatch: false });
    });

    // Добавляем основное сообщение с паттерном
    messages.push({ ...bundle.match, isMatch: true });

    // Добавляем сообщения после
    bundle.after.forEach(msg => {
      messages.push({ ...msg, isMatch: false });
    });

    return messages.sort((a, b) => a.id - b.id);
  }, [bundle]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'short',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getSenderName = (msg: Message) => {
    if (msg.sender?.sender_first_name || msg.sender?.sender_last_name) {
      return `${msg.sender.sender_first_name || ''} ${msg.sender.sender_last_name || ''}`.trim();
    }
    if (msg.sender?.sender_username) {
      return `@${msg.sender.sender_username}`;
    }
    if (msg.sender?.sender_phone) {
      return msg.sender.sender_phone;
    }
    return msg.chat_name || 'Неизвестный';
  };

  const highlightKeywords = (text: string, keywords: string[]) => {
    if (!keywords.length) return text;

    let highlightedText = text;
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark style="background: #ffd700; color: #000; padding: 1px 3px; border-radius: 2px; font-weight: 700; box-shadow: 0 1px 3px rgba(255,215,0,0.5);">$1</mark>');
    });

    return highlightedText;
  };

  // Группируем сообщения по дням для заголовков
  const messagesByDate = useMemo(() => {
    const groups: { [date: string]: typeof allMessages } = {};
    allMessages.forEach(msg => {
      const date = new Date(msg.date).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  }, [allMessages]);

  return (
    <div style={{
      height: '85vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#212121',
      borderRadius: '0',
      overflow: 'hidden',
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxShadow: 'none',
      border: 'none'
    }}>
      {/* Header - точно как в Telegram */}
      <div style={{
        background: '#2481cc',
        color: 'white',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '56px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: '#54a3d6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: '500',
            color: 'white'
          }}>
            {bundle.meta.chat_info.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '500', lineHeight: '20px' }}>
              {bundle.meta.chat_info.name}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.8, lineHeight: '18px' }}>
              🔍 {bundle.meta.matched_keywords.join(' • ')}
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '24px',
              opacity: 0.8,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            ×
          </button>
        )}
      </div>

      {/* Messages - точно как в Telegram */}
      <div style={{
        flex: 1,
        padding: '0',
        overflowY: 'auto',
        background: '#0f1419',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='52' height='52' viewBox='0 0 52 52' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='m10 10 2-2m0 2-2-2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        scrollBehavior: 'smooth'
      }}>
        {Object.entries(messagesByDate).map(([date, messages]) => (
          <div key={date}>
            {/* Date separator - как в Telegram */}
            <div style={{
              textAlign: 'center',
              margin: '16px 0',
              position: 'relative'
            }}>
              <div style={{
                background: 'rgba(0,0,0,0.5)',
                color: '#adbac7',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '13px',
                display: 'inline-block',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {formatDate(messages[0].date)}
              </div>
            </div>

            {/* Messages for this date */}
            {messages.map((message) => {
              const isOutgoing = message.sender?.sender_id === bundle.meta.chat_info.id;
              const isMatch = message.isMatch;

              return (
                <div
                  key={message.id}
                  style={{
                    marginBottom: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isOutgoing ? 'flex-end' : 'flex-start',
                    padding: '0 12px'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      minWidth: '80px',
                      background: isMatch
                        ? '#ff8c00'  // Оранжевый для найденного паттерна
                        : isOutgoing
                          ? '#2b5278'  // Синий для исходящих
                          : '#182533', // Темный для входящих
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: isOutgoing ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                      position: 'relative',
                      boxShadow: isMatch ? '0 0 16px rgba(255, 140, 0, 0.4)' : '0 1px 2px rgba(0,0,0,0.3)',
                      border: isMatch ? '2px solid #ffd700' : 'none',
                      fontSize: '15px',
                      lineHeight: '20px'
                    }}
                  >
                    {/* Sender name (if not own message) */}
                    {!isOutgoing && (
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#64a5e3',
                        marginBottom: '2px'
                      }}>
                        {getSenderName(message)}
                      </div>
                    )}

                    {/* Message text */}
                    <div
                      style={{
                        fontSize: '15px',
                        lineHeight: '20px',
                        wordBreak: 'break-word',
                        margin: '0'
                      }}
                      dangerouslySetInnerHTML={{
                        __html: isMatch
                          ? highlightKeywords(message.text, bundle.meta.matched_keywords)
                          : message.text
                      }}
                    />

                    {/* Time and indicators */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      marginTop: '4px'
                    }}>
                      {/* Media indicator */}
                      {message.has_media && (
                        <span style={{
                          fontSize: '12px',
                          opacity: 0.7
                        }}>
                          📎
                        </span>
                      )}

                      {/* Match indicator */}
                      {isMatch && (
                        <span style={{
                          fontSize: '12px',
                          color: '#ffd700'
                        }}>
                          🎯
                        </span>
                      )}

                      {/* Time */}
                      <span style={{
                        fontSize: '12px',
                        opacity: 0.6,
                        color: isMatch ? '#fff' : 'rgba(255,255,255,0.7)'
                      }}>
                        {formatTime(message.date)}
                      </span>

                      {/* Read status for outgoing */}
                      {isOutgoing && (
                        <span style={{
                          fontSize: '12px',
                          opacity: 0.7,
                          color: '#4fc3f7'
                        }}>
                          ✓✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer - как в Telegram */}
      <div style={{
        background: '#2c2c2c',
        padding: '12px 16px',
        borderTop: '1px solid #3a3a3a',
        fontSize: '13px',
        color: '#999',
        textAlign: 'center',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{
          background: 'rgba(0,0,0,0.3)',
          padding: '4px 12px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          📊 Контекст: {bundle.before.length} до • <span style={{ color: '#ff8c00', fontWeight: 'bold' }}>ПАТТЕРН</span> • {bundle.after.length} после
        </span>
      </div>
    </div>
  );
};

export default TelegramChatView;
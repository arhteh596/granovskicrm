import React, { useState, useRef, useCallback } from 'react';
import { Upload, ZoomIn, ZoomOut, RotateCw, X, Check } from 'lucide-react';

interface AvatarUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (file: File, cropData: CropData) => Promise<void>;
}

interface CropData {
    scale: number;
    rotation: number;
    offsetX: number;
    offsetY: number;
}

export const AvatarUploadModal: React.FC<AvatarUploadModalProps> = ({ isOpen, onClose, onSave }) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setSelectedImage(event.target?.result as string);
                setScale(1);
                setRotation(0);
                setPosition({ x: 0, y: 0 });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleSave = async () => {
        if (!selectedFile) return;

        setIsLoading(true);
        try {
            await onSave(selectedFile, {
                scale,
                rotation,
                offsetX: position.x,
                offsetY: position.y
            });
            handleClose();
        } catch (error) {
            console.error('Error saving avatar:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedImage(null);
        setSelectedFile(null);
        setScale(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
            }}
            onClick={handleClose}
        >
            <div
                style={{
                    background: 'var(--color-bg-card)',
                    borderRadius: '20px',
                    padding: '32px',
                    maxWidth: '672px',
                    width: '100%',
                    margin: '0 16px',
                    border: '1px solid #333'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-accent)', margin: 0 }}>Загрузка аватара</h2>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-second)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {!selectedImage ? (
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                width: '100%',
                                padding: '64px 0',
                                border: '2px dashed #333',
                                borderRadius: '15px',
                                background: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '16px',
                                transition: 'border-color 0.3s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
                        >
                            <Upload size={48} style={{ color: 'var(--color-accent)' }} />
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ color: 'var(--color-text-main)', fontWeight: 600, marginBottom: '8px', margin: 0 }}>Выберите изображение</p>
                                <p style={{ color: 'var(--color-text-second)', fontSize: '0.875rem', margin: 0 }}>или перетащите файл сюда</p>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Предпросмотр */}
                        <div style={{
                            position: 'relative',
                            background: 'var(--color-bg)',
                            borderRadius: '15px',
                            overflow: 'hidden',
                            height: '400px'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <div
                                    style={{
                                        position: 'relative',
                                        width: '300px',
                                        height: '300px',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: '3px solid var(--color-accent)',
                                        cursor: 'move'
                                    }}
                                    onMouseDown={handleMouseDown}
                                >
                                    <img
                                        src={selectedImage}
                                        alt="Preview"
                                        style={{
                                            transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x / scale}px, ${position.y / scale}px)`,
                                            transformOrigin: 'center',
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            userSelect: 'none',
                                            pointerEvents: 'none'
                                        }}
                                        draggable={false}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Контролы */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Масштаб */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={{ color: 'var(--color-text-second)', fontWeight: 500 }}>Масштаб</label>
                                    <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{scale.toFixed(1)}x</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                                        style={{
                                            padding: '8px',
                                            background: '#2a2a2a',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: 'var(--color-text-main)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#3c3c3c'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                    >
                                        <ZoomOut size={20} />
                                    </button>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="3"
                                        step="0.1"
                                        value={scale}
                                        onChange={(e) => setScale(parseFloat(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        onClick={() => setScale(Math.min(3, scale + 0.1))}
                                        style={{
                                            padding: '8px',
                                            background: '#2a2a2a',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: 'var(--color-text-main)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#3c3c3c'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                    >
                                        <ZoomIn size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Поворот */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={{ color: 'var(--color-text-second)', fontWeight: 500 }}>Поворот</label>
                                    <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{rotation}°</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        onClick={() => setRotation((rotation - 90 + 360) % 360)}
                                        style={{
                                            padding: '8px',
                                            background: '#2a2a2a',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: 'var(--color-text-main)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#3c3c3c'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                    >
                                        <RotateCw size={20} style={{ transform: 'scaleX(-1)' }} />
                                    </button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="360"
                                        step="1"
                                        value={rotation}
                                        onChange={(e) => setRotation(parseInt(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        onClick={() => setRotation((rotation + 90) % 360)}
                                        style={{
                                            padding: '8px',
                                            background: '#2a2a2a',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: 'var(--color-text-main)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#3c3c3c'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                    >
                                        <RotateCw size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Кнопки действий */}
                        <div style={{ display: 'flex', gap: '12px', paddingTop: '16px' }}>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    background: '#2a2a2a',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: 'var(--color-text-main)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'background 0.3s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#3c3c3c'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
                            >
                                Выбрать другое фото
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isLoading}
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    background: isLoading ? '#999' : 'var(--color-accent)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: '#1a1a1a',
                                    fontWeight: 'bold',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'background 0.3s',
                                    opacity: isLoading ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => !isLoading && (e.currentTarget.style.background = '#e6c300')}
                                onMouseLeave={(e) => !isLoading && (e.currentTarget.style.background = 'var(--color-accent)')}
                            >
                                {isLoading ? (
                                    <>Сохранение...</>
                                ) : (
                                    <>
                                        <Check size={20} />
                                        Сохранить
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

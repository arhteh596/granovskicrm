import React, { useEffect, useState, useRef } from 'react';
import { statisticsService } from '../services';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface StatsData {
    summary: {
        totalCalls: number;
        successfulCalls: number;
        averageCallDuration: number;
        callsByStatus: Record<string, number>;
    };
    topOperators: Array<{
        userId: number;
        username: string;
        totalCalls: number;
        successfulCalls: number;
        efficiency: number;
    }>;
    callsByDay: Array<{
        date: string;
        count: number;
        successCount?: number;
    }>;
}

interface ManagerStatsData {
    summary: {
        totalCalls: number;
        successfulCalls: number;
        averageCallDuration: number;
        callsByStatus: Record<string, number>;
    };
    callsByDay?: Array<{
        date: string;
        count: number;
        successCount?: number;
    }>;
}

interface CallHistoryItem {
    id: number;
    client_id: number;
    call_date: string;
    call_status: string;
    call_duration: number;
    notes?: string;
    client_name?: string;
    client_phone?: string;
}

export const Statistics: React.FC = () => {
    const { user } = useAuthStore();
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTablePage, setCurrentTablePage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<StatsData | null>(null);
    const [managerData, setManagerData] = useState<ManagerStatsData | null>(null);
    const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'period'>('today');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    const doughnutCanvasRef = useRef<HTMLCanvasElement>(null);
    const performanceCanvasRef = useRef<HTMLCanvasElement>(null);
    const doughnutAnimationRef = useRef<number | null>(null);
    const performanceAnimationRef = useRef<number | null>(null);

    const resolvePeriodRange = () => {
        const now = new Date();

        if (selectedPeriod === 'today') {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            return { date_from: start.toISOString(), date_to: end.toISOString() };
        }

        if (selectedPeriod === 'week') {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            start.setDate(now.getDate() - 6);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            return { date_from: start.toISOString(), date_to: end.toISOString() };
        }

        if (selectedPeriod === 'period') {
            return {
                date_from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
                date_to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined
            };
        }

        return {};
    };

    const loadStatistics = async () => {
        try {
            setIsLoading(true);

            const range = resolvePeriodRange();

            if (user?.role === 'admin') {
                // Загружаем глобальную статистику для администратора
                const stats = await statisticsService.getGlobal({ date_from: range.date_from, date_to: range.date_to });
                setData(stats);
            } else if (user?.role === 'manager') {
                // Загружаем личную статистику и историю звонков для менеджера
                const [personalStats, callHistoryData] = await Promise.all([
                    statisticsService.getManagerPersonal({ date_from: range.date_from, date_to: range.date_to }),
                    statisticsService.getManagerCallHistory({ limit: 100, date_from: range.date_from, date_to: range.date_to })
                ]);

                console.log('Manager Personal Stats:', personalStats);
                console.log('Manager Call History:', callHistoryData);

                setManagerData(personalStats);
                setCallHistory(callHistoryData.calls || []);
            }
        } catch (error: any) {
            console.error('Ошибка загрузки статистики:', error);
            toast.error('Ошибка загрузки статистики');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStatistics();
    }, [selectedPeriod, dateFrom, dateTo]);

    // Отрисовка кастомной овальной doughnut диаграммы
    useEffect(() => {
        const currentChartData = user?.role === 'admin' ? data : managerData;
        if (!currentChartData || !doughnutCanvasRef.current) return;

        const canvas = doughnutCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const callsByStatus = currentChartData?.summary?.callsByStatus || {};
        const labels = Object.keys(callsByStatus);
        const values = Object.values(callsByStatus);

        const labelColorMap: Record<string, string> = {
            'автоответчик': '#4bc0c0',
            'не дозвон': '#ff9f40',
            'не дожал': '#E53E3E',
            'взял док': '#ffd700',
            'взял код': '#ffd700',
            'другой человек': '#9966ff',
            'не существует': '#FFB800',
            'питон': '#9966ff',
            'срез': '#FFB800',
            'перезвон': '#36a2eb',
            'передать': '#5AE37D',
            '3 лица': '#718096'
        };

        const chartDataArr = labels.map((label, i) => ({
            label,
            value: values[i] || 0,
            color: labelColorMap[label.toLowerCase()] || '#cccccc'
        })).filter(item => item.value > 0);

        const totalValue = chartDataArr.reduce((s, it) => s + it.value, 0);
        if (totalValue === 0) return;

        let animationProgress = 0;
        let hoveredSlice = -1;
        let labelPositions: any[] = [];
        let layoutCalculated = false;

        const setupCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            const w = rect.width || 400;
            const h = rect.height || 400;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            layoutCalculated = false;
            animationProgress = 0;
        };

        const drawDecorativeRings = (cx: number, cy: number, radius: number) => {
            ctx.save();
            // Внешнее пунктирное кольцо
            ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 8]);
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 60, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);

            // Внутреннее тонкое кольцо
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([2, 6]);
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(8, radius - 6), 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        };

        const calculateLabelLayout = () => {
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const cx = width / 2;
            const cy = height / 2;
            const labelRadius = Math.min(width, height) * 0.35;
            const labelBoxWidth = 110;
            const labelBoxHeight = 40;
            const labels: any[] = [];
            let startAngle = -Math.PI / 2;

            chartDataArr.forEach((item, i) => {
                const sliceAngle = (item.value / totalValue) * 2 * Math.PI;
                const midAngle = startAngle + sliceAngle / 2;
                labels.push({
                    x: cx + Math.cos(midAngle) * labelRadius,
                    y: cy + Math.sin(midAngle) * labelRadius,
                    width: labelBoxWidth,
                    height: labelBoxHeight,
                    data: item,
                    index: i
                });
                startAngle += sliceAngle;
            });

            // Простая релаксация для избежания наложения
            for (let iter = 0; iter < 150; iter++) {
                for (let i = 0; i < labels.length; i++) {
                    for (let j = i + 1; j < labels.length; j++) {
                        const a = labels[i];
                        const b = labels[j];
                        const dx = a.x - b.x;
                        const dy = a.y - b.y;
                        const minHDist = (a.width + b.width) / 2;
                        const minVDist = (a.height + b.height) / 2;
                        if (Math.abs(dx) < minHDist && Math.abs(dy) < minVDist) {
                            const overlapX = (minHDist - Math.abs(dx)) * Math.sign(dx || 1);
                            const overlapY = (minVDist - Math.abs(dy)) * Math.sign(dy || 1);
                            a.x += overlapX / 2;
                            a.y += overlapY / 2;
                            b.x -= overlapX / 2;
                            b.y -= overlapY / 2;
                        }
                    }
                }
            }
            return labels;
        };

        const drawLabels = (cx: number, cy: number) => {
            let startAngle = -Math.PI / 2;
            const baseRadius = Math.min(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height) * 0.18;

            labelPositions.forEach((pos, i) => {
                const { x, y, data, index } = pos;
                const isRightSide = x > cx;
                const sliceAngle = (data.value / totalValue) * (2 * Math.PI);
                const midAngle = startAngle + sliceAngle / 2;
                const segmentOuterRadius = baseRadius + 20 + Math.sin(i * 1.5) * 15;
                const lineStartX = cx + Math.cos(midAngle) * (segmentOuterRadius + 2);
                const lineStartY = cy + Math.sin(midAngle) * (segmentOuterRadius + 2);

                ctx.beginPath();
                ctx.moveTo(lineStartX, lineStartY);
                ctx.quadraticCurveTo(x, lineStartY, x, y);
                ctx.strokeStyle = '#4A5568';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = (hoveredSlice === -1 || hoveredSlice === index) ? 0.8 : 0.2;
                ctx.stroke();

                ctx.globalAlpha = (hoveredSlice === -1 || hoveredSlice === index) ? 1 : 0.4;
                ctx.textAlign = isRightSide ? 'left' : 'right';
                ctx.textBaseline = 'middle';
                const textX = x + (isRightSide ? 10 : -10);
                const fontBase = baseRadius * 0.24;

                ctx.font = `500 ${Math.max(10, fontBase)}px Inter`;
                ctx.fillStyle = data.color;
                ctx.fillText(data.label, textX, y - 12);

                const percentage = ((data.value / totalValue) * 100).toFixed(1);
                ctx.font = `300 ${Math.max(9, baseRadius * 0.20)}px Inter`;
                ctx.fillStyle = '#A0AEC0';
                ctx.fillText(`${data.value} (${percentage}%)`, textX, y + 16);

                startAngle += sliceAngle;
            });
            ctx.globalAlpha = 1;
        };

        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const width = rect.width;
            const height = rect.height;
            const cx = width / 2;
            const cy = height / 2;

            const baseRadius = Math.min(width, height) * 0.18;
            const segmentThickness = baseRadius * 0.35;

            if (animationProgress >= 1 && !layoutCalculated) {
                labelPositions = calculateLabelLayout();
                layoutCalculated = true;
            }

            drawDecorativeRings(cx, cy, baseRadius);

            let startAngle = -Math.PI / 2;
            const gapAngle = 0.02; // зазор между сегментами

            chartDataArr.forEach((item, i) => {
                const rawSliceAngle = (item.value / totalValue) * (2 * Math.PI);
                const sliceAngle = Math.max(0, rawSliceAngle - gapAngle);
                const halfGap = (rawSliceAngle - sliceAngle) / 2;
                const segStart = startAngle + halfGap * animationProgress;
                const segEnd = segStart + sliceAngle * animationProgress;

                const segmentOuterRadius = baseRadius + 22 + Math.sin(i * 1.5) * 12;
                const segmentInnerRadius = segmentOuterRadius - segmentThickness;
                const currentOuterRadius = segmentOuterRadius * (hoveredSlice === i ? 1.06 : 1);
                const currentInnerRadius = segmentInnerRadius * (hoveredSlice === i ? 0.94 : 1);

                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, currentOuterRadius, segStart, segEnd);
                ctx.arc(cx, cy, currentInnerRadius, segEnd, segStart, true);
                ctx.closePath();
                ctx.fillStyle = item.color;
                ctx.shadowColor = 'rgba(0,0,0,0.45)';
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.shadowBlur = 0;

                // Тонкая подсветка на внешнем крае
                ctx.beginPath();
                ctx.arc(cx, cy, currentOuterRadius - (segmentThickness * 0.06), segStart, segEnd);
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();

                startAngle += rawSliceAngle * animationProgress;
            });

            ctx.globalAlpha = 1;
            if (layoutCalculated) drawLabels(cx, cy);
        };

        const animate = () => {
            if (animationProgress < 1) {
                animationProgress = Math.min(1, animationProgress + 0.035);
            }
            draw();
            doughnutAnimationRef.current = requestAnimationFrame(animate);
        };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dx = x - rect.width / 2;
            const dy = y - rect.height / 2;
            const distance = Math.sqrt(dx * dx + dy * dy);
            let angle = Math.atan2(dy, dx);
            if (angle < -Math.PI / 2) angle += 2 * Math.PI;

            let startAngle = -Math.PI / 2;
            let found = -1;
            const baseRadius = Math.min(rect.width, rect.height) * 0.18;
            const segmentThickness = baseRadius * 0.35;

            for (let i = 0; i < chartDataArr.length; i++) {
                const segmentOuterRadius = baseRadius + 20 + Math.sin(i * 1.5) * 15;
                const segmentInnerRadius = segmentOuterRadius - segmentThickness;
                const sliceAngle = (chartDataArr[i].value / totalValue) * 2 * Math.PI;
                const endAngle = startAngle + sliceAngle;

                if (distance >= segmentInnerRadius && distance <= segmentOuterRadius &&
                    angle >= startAngle && angle <= endAngle) {
                    found = i;
                    break;
                }
                startAngle = endAngle;
            }
            hoveredSlice = found;
        };

        const handleResize = () => {
            setupCanvas();
        };

        setupCanvas();
        animate();
        canvas.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', handleResize);

        return () => {
            if (doughnutAnimationRef.current) {
                cancelAnimationFrame(doughnutAnimationRef.current);
            }
            canvas.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
        };
    }, [data, managerData, user?.role]);

    // Отрисовка линейного графика производительности
    useEffect(() => {
        const currentChartData = user?.role === 'admin' ? data : managerData;
        if (!currentChartData || !performanceCanvasRef.current) return;

        const canvas = performanceCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const callsByDay = currentChartData.callsByDay || [];

        const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const labels = callsByDay.map((d) => {
            const dt = new Date(d.date);
            return weekdays[dt.getDay()] || '';
        });
        const values = callsByDay.map(d => (d.successCount ?? d.count ?? 0));

        if (values.length === 0) return;
        const maxVal = Math.max(...values, 1);

        let progress = 0;

        const hexToRgba = (hex: string, alpha: number = 1) => {
            const h = hex.replace('#', '');
            const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
            const bigint = parseInt(full, 16);
            const r = (bigint >> 16) & 255;
            const g = (bigint >> 8) & 255;
            const b = bigint & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        const setupCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            const w = rect.width || 400;
            const h = rect.height || 300;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            ctx.clearRect(0, 0, width, height);

            const padding = { top: 40, right: 20, bottom: 40, left: 20 };

            const getPoints = (vals: number[], maxV: number) => {
                const numPoints = vals.length;
                if (numPoints === 0) return [];

                return vals.map((val, i) => {
                    const xRatio = numPoints === 1 ? 0.5 : i / (numPoints - 1);
                    return {
                        x: padding.left + xRatio * (width - padding.left - padding.right),
                        y: (height - padding.bottom) - (val / maxV) * (height - padding.top - padding.bottom)
                    };
                });
            };

            const points = getPoints(values, maxVal);

            const successColor = '#ffd700';
            const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
            fillGrad.addColorStop(0, hexToRgba(successColor, 0.5));
            fillGrad.addColorStop(1, hexToRgba(successColor, 0));

            // Рисуем область под линией
            const visibleCount = Math.max(1, Math.ceil(points.length * progress));
            const visiblePoints = points.slice(0, visibleCount);

            if (visiblePoints.length > 0) {
                ctx.beginPath();
                ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
                for (let i = 1; i < visiblePoints.length; i++) {
                    ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
                }
                const lastPoint = visiblePoints[visiblePoints.length - 1];
                ctx.lineTo(lastPoint.x, height - padding.bottom);
                ctx.lineTo(padding.left, height - padding.bottom);
                ctx.closePath();
                ctx.fillStyle = fillGrad;
                ctx.fill();
            }

            // Рисуем линию
            if (visiblePoints.length > 0) {
                ctx.beginPath();
                ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
                for (let i = 1; i < visiblePoints.length; i++) {
                    ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
                }
                ctx.strokeStyle = successColor;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
            }

            // Рисуем точки и значения
            ctx.font = '500 13px Inter';
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                const pointProg = Math.max(0, (progress - (i / points.length)) * (points.length / 2));
                if (pointProg <= 0) continue;

                ctx.globalAlpha = Math.min(1, pointProg);

                // Точка
                ctx.beginPath();
                ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
                ctx.fillStyle = successColor;
                ctx.fill();
                ctx.strokeStyle = '#1E1E1E';
                ctx.lineWidth = 2.5;
                ctx.stroke();

                // Значение над точкой
                const text = values[i].toString();
                const textWidth = ctx.measureText(text).width;
                const yOffset = -18;

                ctx.fillStyle = 'rgba(20,20,20,0.85)';
                ctx.fillRect(point.x - textWidth / 2 - 8, point.y + yOffset - 12, textWidth + 16, 24);
                ctx.fillStyle = '#E0E0E0';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, point.x, point.y + yOffset);
            }
            ctx.globalAlpha = 1;

            // Подписи дней недели
            ctx.font = '500 14px Inter';
            ctx.fillStyle = 'rgba(138,138,138,0.85)';
            ctx.textAlign = 'center';
            for (let i = 0; i < labels.length && i < points.length; i++) {
                ctx.fillText(labels[i], points[i].x, height - 15);
            }
        };

        const animate = () => {
            if (progress < 1) {
                progress = Math.min(1, progress + 0.02);
            }
            draw();
            performanceAnimationRef.current = requestAnimationFrame(animate);
        };

        // Очищаем предыдущую анимацию
        if (performanceAnimationRef.current) {
            cancelAnimationFrame(performanceAnimationRef.current);
        }

        setupCanvas();
        animate();

        const handleResize = () => {
            setupCanvas();
        };

        window.addEventListener('resize', handleResize);

        return () => {
            if (performanceAnimationRef.current) {
                cancelAnimationFrame(performanceAnimationRef.current);
            }
            window.removeEventListener('resize', handleResize);
        };
    }, [data, managerData, user?.role]);

    if (isLoading) {
        return (
            <div className="main-container" style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px'
            }}>
                <div style={{ color: 'var(--color-text-second)', fontSize: '1.2rem' }}>
                    Загрузка статистики...
                </div>
            </div>
        );
    }

    // Для менеджеров используем другую структуру данных
    const currentData = user?.role === 'admin' ? data : managerData;

    if (!currentData) {
        return (
            <div className="main-container" style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px'
            }}>
                <div style={{ color: 'var(--color-text-second)', fontSize: '1.2rem' }}>
                    Нет данных
                </div>
            </div>
        );
    }

    // @ts-ignore - переменная для будущего использования  
    const callsByStatus = currentData?.summary?.callsByStatus || {};
    const totalCalls = currentData?.summary?.totalCalls || 0;
    const successfulCalls = currentData?.summary?.successfulCalls || 0;
    const callsPerDoc = totalCalls > 0 && successfulCalls > 0 ? Math.round(totalCalls / successfulCalls) : 0;
    const notClosed = totalCalls - successfulCalls;

    console.log('Current data summary:', currentData?.summary);
    console.log('Calls by status:', callsByStatus);
    console.log('Total calls:', totalCalls);
    console.log('Successful calls:', successfulCalls);
    console.log('Calls per doc:', callsPerDoc);

    // Для менеджеров фильтруем историю звонков, для админов - операторов
    const isManager = user?.role === 'manager';

    const filteredData = isManager
        ? callHistory.filter(call =>
            call.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            call.client_phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            call.call_status?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : (data?.topOperators || []).filter(op =>
            op.username.toLowerCase().includes(searchQuery.toLowerCase())
        );

    const paginatedData = filteredData.slice(
        (currentTablePage - 1) * rowsPerPage,
        currentTablePage * rowsPerPage
    );

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    // Только для администраторов
    const topByCalls = isManager ? [] : [...(data?.topOperators || [])].sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 10);
    const topByEfficiency = isManager ? [] : [...(data?.topOperators || [])].sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);

    const handleSelectPeriod = (period: 'today' | 'week' | 'period') => {
        if (period === 'period') {
            if (!dateFrom || !dateTo) {
                const now = new Date();
                const start = new Date();
                start.setDate(now.getDate() - 6);
                setDateFrom(start.toISOString().slice(0, 10));
                setDateTo(now.toISOString().slice(0, 10));
            }
        } else {
            setDateFrom('');
            setDateTo('');
        }
        setSelectedPeriod(period);
    };

    return (
        <div className="main-container" style={{
            paddingTop: '20px'
        }}>
            <header className="page-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-lg)',
                marginTop: 'var(--space-xl)'
            }}>
                <h1 style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--color-accent)',
                    margin: 0,
                    fontSize: 'var(--size-text-h1)',
                    fontWeight: 'var(--weight-text-h1)',
                    textTransform: 'uppercase'
                }}>Статистика</h1>

                {/* Выбор периода */}
                <div style={{
                    display: 'flex'
                }}>
                    <div style={{
                        display: 'flex',
                        backgroundColor: 'var(--color-bg-card)',
                        border: 'var(--border)',
                        borderRadius: 'var(--border-radius-element)',
                        padding: '8px',
                        boxShadow: 'var(--shadow-main)'
                    }}>
                        <button
                            onClick={() => handleSelectPeriod('today')}
                            style={{
                                background: selectedPeriod === 'today' ? 'var(--color-accent)' : 'transparent',
                                border: 'none',
                                color: selectedPeriod === 'today' ? '#1a1a1a' : 'var(--color-text-second)',
                                padding: '8px 30px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: selectedPeriod === 'today' ? 700 : 500,
                                transition: 'all 0.3s ease',
                                whiteSpace: 'nowrap',
                                boxShadow: selectedPeriod === 'today' ? '0 4px 10px rgba(255, 215, 0, 0.2)' : 'none'
                            }}
                        >
                            Сегодня
                        </button>
                        <button
                            onClick={() => handleSelectPeriod('week')}
                            style={{
                                background: selectedPeriod === 'week' ? 'var(--color-accent)' : 'transparent',
                                border: 'none',
                                color: selectedPeriod === 'week' ? '#1a1a1a' : 'var(--color-text-second)',
                                padding: '8px 30px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: selectedPeriod === 'week' ? 700 : 500,
                                transition: 'all 0.3s ease',
                                whiteSpace: 'nowrap',
                                boxShadow: selectedPeriod === 'week' ? '0 4px 10px rgba(255, 215, 0, 0.2)' : 'none'
                            }}
                        >
                            Неделя
                        </button>
                        <button
                            onClick={() => handleSelectPeriod('period')}
                            style={{
                                background: selectedPeriod === 'period' ? 'var(--color-accent)' : 'transparent',
                                border: 'none',
                                color: selectedPeriod === 'period' ? '#1a1a1a' : 'var(--color-text-second)',
                                padding: '8px 30px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: selectedPeriod === 'period' ? 700 : 500,
                                transition: 'all 0.3s ease',
                                whiteSpace: 'nowrap',
                                boxShadow: selectedPeriod === 'period' ? '0 4px 10px rgba(255, 215, 0, 0.2)' : 'none'
                            }}
                        >
                            Период
                        </button>
                    </div>
                    {selectedPeriod === 'period' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: 'var(--color-text-second)', fontSize: '0.85rem' }}>C</span>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    style={{ minWidth: '0', width: '170px', padding: '8px 10px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: 'var(--color-text-second)', fontSize: '0.85rem' }}>По</span>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    style={{ minWidth: '0', width: '170px', padding: '8px 10px' }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <main>
                <section className="stats-summary-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 'var(--margin-main)',
                    marginBottom: 'var(--space-md)',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div className="card stat-card" style={{
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div className="label" style={{
                            fontSize: '1.1rem',
                            color: 'var(--color-text-main)',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            marginBottom: '5px',
                            textAlign: 'center'
                        }}>Всего звонков</div>
                        <div className="value" style={{
                            fontSize: '3rem',
                            fontWeight: 700,
                            color: 'var(--color-accent)',
                            fontFamily: 'var(--font-heading)',
                            textAlign: 'center'
                        }}>{totalCalls}</div>
                    </div>
                    <div className="card stat-card" style={{
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div className="label" style={{
                            fontSize: '1.1rem',
                            color: 'var(--color-text-main)',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            marginBottom: '5px',
                            textAlign: 'center'
                        }}>Звонков на 1 док</div>
                        <div className="value" style={{
                            fontSize: '3rem',
                            fontWeight: 700,
                            color: 'var(--color-accent)',
                            fontFamily: 'var(--font-heading)',
                            textAlign: 'center'
                        }}>{callsPerDoc}</div>
                    </div>
                    <div className="card stat-card" style={{
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div className="label" style={{
                            fontSize: '1.1rem',
                            color: 'var(--color-text-main)',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            marginBottom: '5px',
                            textAlign: 'center'
                        }}>Взял док (всего)</div>
                        <div className="value" style={{
                            fontSize: '3rem',
                            fontWeight: 700,
                            color: 'var(--color-accent)',
                            fontFamily: 'var(--font-heading)',
                            textAlign: 'center'
                        }}>{successfulCalls}</div>
                    </div>
                    <div className="card stat-card" style={{
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div className="label" style={{
                            fontSize: '1.1rem',
                            color: 'var(--color-text-main)',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            marginBottom: '5px',
                            textAlign: 'center'
                        }}>Не дожал (всего)</div>
                        <div className="value" style={{
                            fontSize: '3rem',
                            fontWeight: 700,
                            color: 'var(--color-accent)',
                            fontFamily: 'var(--font-heading)',
                            textAlign: 'center'
                        }}>{notClosed}</div>
                    </div>
                </section>

                <section className="main-content-grid" style={{
                    marginBottom: 'var(--space-md)'
                }}>
                    <div className="card chart-card">
                        <h3 style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-text-second)',
                            marginBottom: 'var(--gap3)',
                            fontSize: 'var(--size-text-h3)',
                            fontWeight: 'var(--weight-text-h3)',
                            textTransform: 'uppercase',
                            textAlign: 'center'
                        }}>Статусы за период</h3>
                        <div className="chart-container" style={{
                            position: 'relative',
                            width: '100%',
                            height: '350px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <canvas
                                ref={doughnutCanvasRef}
                                className="statusChart"
                                style={{
                                    width: '100%',
                                    height: '100%'
                                }}
                            ></canvas>
                        </div>
                    </div>

                    <div className="card chart-card">
                        <div className="chart-header" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--gap2)',
                            marginBottom: 'var(--gap3)'
                        }}>
                            <button
                                className="prev-week"
                                onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--color-text-second)',
                                    cursor: 'pointer',
                                    fontSize: '1.2rem',
                                    padding: 'var(--gap1)',
                                    transition: 'color 0.3s ease'
                                }}
                            >
                                ‹
                            </button>
                            <h3 style={{
                                margin: 0,
                                fontFamily: 'var(--font-heading)',
                                color: 'var(--color-text-second)',
                                fontSize: 'var(--size-text-h3)',
                                fontWeight: 'var(--weight-text-h3)',
                                textTransform: 'uppercase'
                            }}>Производительность за неделю</h3>
                            <button
                                className="next-week"
                                onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
                                disabled={currentWeekOffset >= 0}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: currentWeekOffset >= 0 ? 'rgba(138, 138, 138, 0.5)' : 'var(--color-text-second)',
                                    cursor: currentWeekOffset >= 0 ? 'not-allowed' : 'pointer',
                                    fontSize: '1.2rem',
                                    padding: 'var(--gap1)',
                                    transition: 'color 0.3s ease'
                                }}
                            >
                                ›
                            </button>
                        </div>
                        <div className="bar-chart-container" style={{
                            width: '100%',
                            height: '300px',
                            minHeight: '260px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <canvas
                                ref={performanceCanvasRef}
                                className="performanceChart"
                                style={{
                                    width: '100%',
                                    height: '100%'
                                }}
                            ></canvas>
                        </div>
                    </div>
                </section>

                {/* Условные таблицы в зависимости от роли */}
                {isManager ? (
                    // Для менеджеров - только таблица истории звонков
                    <section className="manager-call-history" style={{
                        marginBottom: 'var(--space-md)'
                    }}>
                        <div className="card table-card">
                            <div className="table-header">
                                <h3 style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-heading)',
                                    fontSize: '1.2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    color: 'var(--color-accent)'
                                }}>
                                    История звонков
                                </h3>
                            </div>
                            <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 'var(--space-lg)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--color-bg-light)' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Дата звонка</th>
                                            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Клиент</th>
                                            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Телефон</th>
                                            <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Статус</th>
                                            <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Длительность</th>
                                            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Заметки</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(paginatedData as CallHistoryItem[]).map((call) => (
                                            <tr key={call.id} style={{ borderBottom: '1px solid var(--color-bg-light)' }}>
                                                <td style={{ padding: '12px', color: 'var(--color-text-main)' }}>
                                                    {new Date(call.call_date).toLocaleDateString('ru-RU', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </td>
                                                <td style={{ padding: '12px', color: 'var(--color-text-main)' }}>{call.client_name || 'Неизвестно'}</td>
                                                <td style={{ padding: '12px', color: 'var(--color-text-main)' }}>{call.client_phone || 'Не указан'}</td>
                                                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-main)' }}>{call.call_status}</td>
                                                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-main)' }}>
                                                    {call.call_duration ? `${Math.floor(call.call_duration / 60)}:${(call.call_duration % 60).toString().padStart(2, '0')}` : '0:00'}
                                                </td>
                                                <td style={{ padding: '12px', color: 'var(--color-text-second)', fontSize: '0.9rem' }}>
                                                    {call.notes ? (call.notes.length > 50 ? call.notes.substring(0, 50) + '...' : call.notes) : 'Нет заметок'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                ) : (
                    // Для администраторов - таблицы топов
                    <section className="top-tables-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                        gap: 'var(--margin-main)',
                        marginBottom: 'var(--space-md)'
                    }}>
                        <div className="card table-card">
                            <div className="table-header">
                                <h3 style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-heading)',
                                    fontSize: '1.2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    color: 'var(--color-accent)'
                                }}>
                                    Топ 10 по звонкам
                                </h3>
                            </div>
                            <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 'var(--space-lg)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--color-bg-light)' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Оператор</th>
                                            <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Звонки</th>
                                            <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Взял Код</th>
                                            <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Эффект.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topByCalls.map((op) => (
                                            <tr key={op.userId} style={{ borderBottom: '1px solid var(--color-bg-light)' }}>
                                                <td style={{ padding: '12px', color: 'var(--color-text-main)' }}>
                                                    {op.username}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-main)' }}>{op.totalCalls}</td>
                                                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-success)' }}>{op.successfulCalls}</td>
                                                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-accent)', fontWeight: 600 }}>{op.efficiency.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="card table-card">
                            <div className="table-header">
                                <h3 style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-heading)',
                                    fontSize: '1.2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    color: 'var(--color-accent)'
                                }}>
                                    Топ 10 по эффективности
                                </h3>
                            </div>
                            <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 'var(--space-lg)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--color-bg-light)' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Оператор</th>
                                            <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Звонки</th>
                                            <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Взял Код</th>
                                            <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Эффект.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topByEfficiency.map((op) => (
                                            <tr key={op.userId} style={{ borderBottom: '1px solid var(--color-bg-light)' }}>
                                                <td style={{ padding: '12px', color: 'var(--color-text-main)' }}>
                                                    {op.username}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-main)' }}>{op.totalCalls}</td>
                                                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-success)' }}>{op.successfulCalls}</td>
                                                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-accent)', fontWeight: 600 }}>{op.efficiency.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                {/* Таблица статистики операторов - только для администраторов */}
                {!isManager && (
                    <section className="card table-card">
                        <div className="table-header" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--space-lg)',
                            flexWrap: 'wrap',
                            gap: 'var(--space-md)'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontFamily: 'var(--font-heading)',
                                fontSize: '1.2rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                color: 'var(--color-accent)'
                            }}>
                                Статистика по операторам
                            </h3>
                            <div className="search-container" style={{ position: 'relative' }}>
                                <input
                                    type="search"
                                    className="search-input"
                                    placeholder="Поиск по операторам..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentTablePage(1);
                                    }}
                                    style={{
                                        backgroundColor: 'var(--color-bg)',
                                        border: 'var(--border)',
                                        borderRadius: 'var(--border-radius-element)',
                                        padding: '10px 15px',
                                        color: 'var(--color-text-main)',
                                        fontSize: 'var(--size-text-base)',
                                        outline: 'none',
                                        minWidth: '250px'
                                    }}
                                />
                            </div>
                        </div>

                        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--color-bg-light)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Оператор</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Всего звонков</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Взял Код</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Срез</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-second)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Эффективность</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(paginatedData as any[]).map((op) => (
                                        <tr key={op.userId} style={{ borderBottom: '1px solid var(--color-bg-light)' }}>
                                            <td style={{ padding: '12px', color: 'var(--color-text-main)' }}>{op.username}</td>
                                            <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-main)' }}>{op.totalCalls}</td>
                                            <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-success)' }}>{op.successfulCalls}</td>
                                            <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-danger)' }}>{op.totalCalls - op.successfulCalls}</td>
                                            <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-accent)', fontWeight: 600 }}>{op.efficiency.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="pagination-footer" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: 'var(--space-lg)',
                            marginTop: 'var(--space-md)',
                            borderTop: '1px solid var(--color-bg-light)',
                            flexWrap: 'wrap',
                            gap: 'var(--gap2)'
                        }}>
                            <div className="rows-per-page" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <label style={{ fontSize: '0.9rem', color: 'var(--color-text-second)' }}>
                                    Строк на странице:
                                </label>
                                <select
                                    className="rows-select"
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentTablePage(1);
                                    }}
                                    style={{
                                        backgroundColor: 'var(--color-bg-light)',
                                        border: 'var(--border)',
                                        borderRadius: 'var(--border-button)',
                                        color: 'var(--color-text-main)',
                                        padding: '5px 10px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={15}>15</option>
                                    <option value={30}>30</option>
                                </select>
                            </div>

                            <div className="pagination-controls" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <button
                                    className="prev-page"
                                    onClick={() => setCurrentTablePage(Math.max(1, currentTablePage - 1))}
                                    disabled={currentTablePage === 1}
                                    style={{
                                        background: 'var(--color-bg-light)',
                                        border: 'var(--border)',
                                        color: 'var(--color-text-main)',
                                        width: '35px',
                                        height: '35px',
                                        borderRadius: 'var(--border-button)',
                                        cursor: currentTablePage === 1 ? 'not-allowed' : 'pointer',
                                        opacity: currentTablePage === 1 ? 0.5 : 1,
                                        transition: 'background-color 0.3s ease'
                                    }}
                                >
                                    ‹
                                </button>
                                <span className="page-info" style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--color-text-second)'
                                }}>
                                    Страница {currentTablePage} из {totalPages || 1}
                                </span>
                                <button
                                    className="next-page"
                                    onClick={() => setCurrentTablePage(Math.min(totalPages, currentTablePage + 1))}
                                    disabled={currentTablePage === totalPages || totalPages === 0}
                                    style={{
                                        background: 'var(--color-bg-light)',
                                        border: 'var(--border)',
                                        color: 'var(--color-text-main)',
                                        width: '35px',
                                        height: '35px',
                                        borderRadius: 'var(--border-button)',
                                        cursor: currentTablePage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer',
                                        opacity: currentTablePage === totalPages || totalPages === 0 ? 0.5 : 1,
                                        transition: 'background-color 0.3s ease'
                                    }}
                                >
                                    ›
                                </button>
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

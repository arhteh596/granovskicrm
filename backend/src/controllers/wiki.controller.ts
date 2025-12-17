import { Response, NextFunction } from 'express';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import pool from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// Нормализация заголовков CSV -> внутренние поля таблицы clients
const mapHeader = (header: string): string => {
    const h = header.trim().toLowerCase();
    switch (h) {
        case 'ссылка': return 'source_url';
        case 'фио': return 'ceo_name';
        case 'дата рождения': return 'birthdate';
        case 'место рождения': return 'birthplace';
        case 'телефон1': return 'phone';
        case 'телефон2': return 'phone1';
        case 'телефон3': return 'phone2';
        case 'телефон4': return 'phone3';
        case 'телефон5': return 'phone4_extra';
        case 'телефон6': return 'phone5_extra';
        case 'телефон7': return 'phone6_extra';
        case 'снилс': return 'snils';
        case 'инн': return 'inn';
        case 'паспорт': return 'passport';
        case 'адрес1': return 'address';
        case 'адрес2': return 'address1';
        case 'адрес3': return 'address2';
        case 'адрес4': return 'address3';
        case 'адрес5': return 'address4';
        default: return h;
    }
};

export const uploadWikiDatabase = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const file = req.file;
        const { name, notes } = req.body;

        if (!file) throw new AppError('No file uploaded', 400);
        if (!name) throw new AppError('Database name is required', 400);

        const userId = req.user?.id;

        // 1) Создаем запись базы
        const dbResult = await pool.query(
            `INSERT INTO databases (name, file_name, uploaded_by, notes)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, path.basename(file.filename), userId, notes || null]
        );

        const databaseId = dbResult.rows[0].id;

        // 2) Парсим CSV с разделителем ';' и маппингом заголовков
        const rows: any[] = [];
        fs.createReadStream(file.path)
            .pipe(csv({ separator: ';', mapHeaders: ({ header }) => mapHeader(header) }))
            .on('data', (row) => rows.push(row))
            .on('end', async () => {
                try {
                    let imported = 0;
                    for (const r of rows) {
                        // Собираем дополнительные телефоны и место рождения в tags
                        const extras: string[] = [];
                        if (r.phone4_extra) extras.push(`extra_phone=${r.phone4_extra}`);
                        if (r.phone5_extra) extras.push(`extra_phone=${r.phone5_extra}`);
                        if (r.phone6_extra) extras.push(`extra_phone=${r.phone6_extra}`);
                        if (r.birthplace) extras.push(`birthplace=${String(r.birthplace).replace(/;/g, ',')}`);
                        const tags = extras.length ? extras.join('; ') : null;

                        await pool.query(
                            `INSERT INTO clients (
                                database_id, is_wiki, ceo_name, company_name, company_inn,
                                address, address_data, address1, address1_data, address2, address2_data, address3, address3_data, address4, address4_data,
                                source_url,
                                phone, phone1, phone2, phone3,
                                passport, birthdate, snils, inn,
                                tags
                             ) VALUES (
                                $1, true, $2, NULL, NULL,
                                $3, NULL, $4, NULL, $5, NULL, $6, NULL, $7, NULL,
                                $8,
                                $9, $10, $11, $12,
                                $13, $14, $15, $16,
                                $17
                             )`,
                            [
                                databaseId, r.ceo_name || null,
                                r.address || null, r.address1 || null, r.address2 || null, r.address3 || null, r.address4 || null,
                                r.source_url || null,
                                r.phone || null, r.phone1 || null, r.phone2 || null, r.phone3 || null,
                                r.passport || null, r.birthdate || null, r.snils || null, r.inn || null,
                                tags
                            ]
                        );
                        imported++;
                    }

                    await pool.query(
                        `UPDATE databases SET total_clients = $1 WHERE id = $2`,
                        [imported, databaseId]
                    );
                    await pool.query(`UPDATE databases SET is_wiki = true WHERE id = $1`, [databaseId]);

                    res.status(201).json({
                        success: true,
                        data: { ...dbResult.rows[0], total_clients: imported },
                        message: `Wiki база загружена. Импортировано ${imported} клиентов.`,
                    });
                } catch (e) {
                    next(e);
                }
            })
            .on('error', (e) => next(e));
    } catch (error) {
        next(error);
    }
};

// Возвращает следующего клиента из Wiki-источника (is_wiki = true)
export const getNextWikiClient = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) return next(new AppError('Unauthorized', 401));

    const db = await pool.connect();
    try {
        await db.query('BEGIN');

        // Для менеджера обязателен активный фильтр; админ может без фильтра
        let databaseIds: number[] | null = null;
        let statuses: string[] | null = null;

        if (userRole !== 'admin') {
            const filterRes = await db.query(
                `SELECT id, database_ids, statuses
                 FROM call_filters
                 WHERE is_active = true
                   AND (user_ids IS NULL OR $1 = ANY(user_ids))
                 LIMIT 1`,
                [userId]
            );

            if (filterRes.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ message: 'Нет активного фильтра для Wiki' });
            }
            // Берем только те базы из фильтра, которые являются Wiki
            const originalDbIds: number[] = filterRes.rows[0].database_ids || [];
            const wikiDbRes = await db.query<{ id: number }>(
                `SELECT id FROM databases WHERE id = ANY($1::int[]) AND is_wiki = true`,
                [originalDbIds]
            );
            const wikiDbIds = wikiDbRes.rows.map(r => r.id);
            if (wikiDbIds.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ message: 'Активный фильтр не содержит Wiki-баз' });
            }
            databaseIds = wikiDbIds;
            statuses = filterRes.rows[0].statuses;
        }

        const conditions: string[] = ['c.is_wiki = true'];
        const params: any[] = [];
        let idx = 1;

        if (databaseIds && databaseIds.length > 0) {
            conditions.push(`c.database_id = ANY($${idx}::int[])`);
            params.push(databaseIds);
            idx++;
        }

        if (statuses && statuses.length > 0) {
            const hasNew = statuses.includes('новый');
            const other = statuses.filter((s) => s !== 'новый');
            const parts: string[] = [];
            if (hasNew) parts.push('c.call_status IS NULL');
            if (other.length > 0) {
                parts.push(`c.call_status = ANY($${idx}::varchar[])`);
                params.push(other);
                idx++;
            }
            if (parts.length > 0) conditions.push(`(${parts.join(' OR ')})`);
        } else {
            // По умолчанию новые или "не дозвон" для админа
            if (userRole === 'admin') {
                conditions.push(`(c.call_status IS NULL OR c.call_status = 'не дозвон')`);
            }
        }

        // только не назначенные или назначенные текущему пользователю
        conditions.push(`(c.assigned_to IS NULL OR c.assigned_to = $${idx})`);
        params.push(userId);
        idx++;

        // Не выдаём клиентов, которых пользователь уже обзванивал
        conditions.push(`NOT EXISTS (
            SELECT 1 FROM call_history ch
            WHERE ch.client_id = c.id AND ch.user_id = $${idx}
        )`);
        params.push(userId);

        const selectRes = await db.query<{ id: number }>(
            `SELECT c.id
             FROM clients c
             WHERE ${conditions.join(' AND ')}
             ORDER BY c.return_priority DESC, c.updated_at DESC, c.created_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1`,
            params
        );

        if (selectRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Нет доступных Wiki-клиентов' });
        }

        const claimed = await db.query(
            `UPDATE clients
             SET assigned_to = COALESCE(assigned_to, $1), updated_at = NOW()
             WHERE id = $2 AND (assigned_to IS NULL OR assigned_to = $1)
             RETURNING *`,
            [userId, selectRes.rows[0].id]
        );

        await db.query('COMMIT');
        return res.json({ client: claimed.rows[0] });
    } catch (e) {
        await db.query('ROLLBACK');
        next(e);
    } finally {
        db.release();
    }
};

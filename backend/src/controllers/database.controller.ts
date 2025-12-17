import { Response, NextFunction } from 'express';
import pool from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import fs from 'fs';
import csv from 'csv-parser';

// Upload CSV Database
export const uploadDatabase = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const file = req.file;
        const { name, notes } = req.body;

        if (!file) {
            throw new AppError('No file uploaded', 400);
        }

        if (!name) {
            throw new AppError('Database name is required', 400);
        }

        const userId = req.user?.id;

        // Save database record
        const dbResult = await pool.query(
            `INSERT INTO databases (name, file_name, uploaded_by, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [name, file.filename, userId, notes || null]
        );

        const databaseId = dbResult.rows[0].id;

        // Parse CSV and insert clients
        const clients: any[] = [];

        fs.createReadStream(file.path)
            .pipe(csv())
            .on('data', (row) => {
                clients.push(row);
            })
            .on('end', async () => {
                try {
                    // Insert clients in batch
                    for (const client of clients) {
                        await pool.query(
                            `INSERT INTO clients (
                database_id, ceo_name, company_name, company_inn, postal_code, region,
                address_rest, authorized_capital, main_activity, source_url,
                phone, phone_data, phone1, phone1_data, phone2, phone2_data, phone3, phone3_data,
                address, address_data, address1, address1_data, address2, address2_data,
                address3, address3_data, address4, address4_data,
                email, email_data, email1, email1_data, email2, email2_data,
                email3, email3_data, email4, email4_data,
                passport, passport_data, birthdate, birthdate_data,
                snils, snils_data, inn, inn_data,
                vehicles, social, relatives, tags
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
                $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
                $39, $40, $41, $42, $43, $44, $45, $46,
                $47, $48, $49, $50
              )`,
                            [
                                databaseId, client.ceo_name, client.company_name, client.company_inn, client.postal_code, client.region,
                                client.address_rest, client.authorized_capital, client.main_activity, client.source_url,
                                client.phone, client.phone_data, client.phone1, client.phone1_data, client.phone2, client.phone2_data,
                                client.phone3, client.phone3_data, client.address, client.address_data, client.address1, client.address1_data,
                                client.address2, client.address2_data, client.address3, client.address3_data, client.address4, client.address4_data,
                                client.email, client.email_data, client.email1, client.email1_data, client.email2, client.email2_data,
                                client.email3, client.email3_data, client.email4, client.email4_data,
                                client.passport, client.passport_data, client.birthdate, client.birthdate_data,
                                client.snils, client.snils_data, client.inn, client.inn_data,
                                client.vehicles, client.social, client.relatives, client.tags
                            ]
                        );
                    }

                    // Update total_clients count
                    await pool.query(
                        `UPDATE databases SET total_clients = $1 WHERE id = $2`,
                        [clients.length, databaseId]
                    );

                    res.status(201).json({
                        success: true,
                        data: { ...dbResult.rows[0], total_clients: clients.length },
                        message: `Database uploaded successfully. ${clients.length} clients imported.`,
                    });
                } catch (error) {
                    next(error);
                }
            });
    } catch (error) {
        next(error);
    }
};

// Get all databases (excluding wiki databases)
export const getDatabases = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query(
            `SELECT 
                d.*, 
                u.full_name as uploaded_by_name,
                (SELECT COUNT(*) FROM clients WHERE database_id = d.id AND call_status IS NULL) as new_clients_count
            FROM databases d
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE d.is_active = true AND (d.is_wiki = false OR d.is_wiki IS NULL)
            ORDER BY d.upload_date DESC`
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        next(error);
    }
};

// Get all Wiki databases
export const getWikiDatabases = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query(
            `SELECT 
                d.*, 
                u.full_name as uploaded_by_name,
                (SELECT COUNT(*) FROM clients WHERE database_id = d.id AND call_status IS NULL AND is_wiki = true) as new_clients_count
            FROM databases d
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE d.is_active = true AND d.is_wiki = true
            ORDER BY d.upload_date DESC`
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        next(error);
    }
};

// Get database by ID
export const getDatabaseById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT d.*, u.full_name as uploaded_by_name
       FROM databases d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            throw new AppError('Database not found', 404);
        }

        res.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

// Assign clients to managers (по очереди)
export const assignClientsToManagers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        let { managerIds, includeAdmin } = req.body; // Array of manager IDs, includeAdmin flag

        // Если managerIds не переданы или пустой массив, получаем всех активных менеджеров
        if (!managerIds || !Array.isArray(managerIds) || managerIds.length === 0) {
            const role = includeAdmin ? `role IN ('manager', 'admin')` : `role = 'manager'`;
            const managersResult = await pool.query(
                `SELECT id FROM users WHERE ${role} AND is_active = true ORDER BY id`
            );

            if (managersResult.rows.length === 0) {
                throw new AppError('No active managers found', 400);
            }

            managerIds = managersResult.rows.map(row => row.id);
        }

        // Get unassigned clients from this database
        const clientsResult = await pool.query(
            `SELECT id FROM clients WHERE database_id = $1 AND assigned_to IS NULL ORDER BY id`,
            [id]
        );

        const clients = clientsResult.rows;
        let assignedCount = 0;

        // Round-robin assignment
        for (let i = 0; i < clients.length; i++) {
            const managerId = managerIds[i % managerIds.length];
            await pool.query(
                `UPDATE clients SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [managerId, clients[i].id]
            );
            assignedCount++;
        }

        // Update assigned_clients count
        await pool.query(
            `UPDATE databases SET assigned_clients = assigned_clients + $1 WHERE id = $2`,
            [assignedCount, id]
        );

        res.json({
            success: true,
            message: `${assignedCount} clients assigned to ${managerIds.length} users`,
        });
    } catch (error) {
        next(error);
    }
};

// Get database statistics
export const getDatabaseStatistics = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // Get database info
        const dbResult = await pool.query(
            `SELECT * FROM databases WHERE id = $1 AND is_active = true`,
            [id]
        );

        if (dbResult.rows.length === 0) {
            throw new AppError('Database not found', 404);
        }

        const database = dbResult.rows[0];

        // Get statistics by call status
        const statsResult = await pool.query(
            `SELECT 
                call_status,
                COUNT(*) as count
            FROM clients
            WHERE database_id = $1
            GROUP BY call_status`,
            [id]
        );

        const statistics = {
            total: database.total_clients,
            new: 0,
            statuses: {} as Record<string, number>
        };

        statsResult.rows.forEach(row => {
            if (row.call_status === null) {
                statistics.new = parseInt(row.count);
            } else {
                statistics.statuses[row.call_status] = parseInt(row.count);
            }
        });

        res.json({
            database,
            statistics
        });
    } catch (error) {
        next(error);
    }
};

// Delete database
export const deleteDatabase = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        await pool.query(
            `UPDATE databases SET is_active = false WHERE id = $1`,
            [id]
        );

        res.json({
            success: true,
            message: 'Database deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

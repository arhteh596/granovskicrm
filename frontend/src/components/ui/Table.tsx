import React from 'react';

interface Column<T> {
    key: string;
    label: string;
    render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    onRowClick?: (item: T) => void;
    emptyMessage?: string;
}

export function Table<T extends Record<string, any>>({
    data,
    columns,
    onRowClick,
    emptyMessage = 'Нет данных для отображения'
}: TableProps<T>) {
    return (
        <div className="table-wrapper">
            <table>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key}>
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                style={{
                                    padding: 'var(--space-xl)',
                                    textAlign: 'center',
                                    color: 'var(--color-text-second)'
                                }}
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((item, index) => (
                            <tr
                                key={index}
                                onClick={() => onRowClick?.(item)}
                                style={{
                                    cursor: onRowClick ? 'pointer' : 'default'
                                }}
                            >
                                {columns.map((column) => (
                                    <td key={column.key}>
                                        {column.render
                                            ? column.render(item)
                                            : item[column.key]?.toString() || '-'}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

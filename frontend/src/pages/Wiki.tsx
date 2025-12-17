// Копия страницы "Звонить" для работы с данными Wiki (структура полей под CSV enriched_results)
// Вся логика звонков и интерфейс сохранены. Данные берутся из общей таблицы clients,
// т.к. загрузка Wiki кладёт записи в clients через /databases/upload-wiki с корректным маппингом полей.
import { ManagerCall } from './ManagerCall';

export const Wiki = () => <ManagerCall mode="wiki" />;

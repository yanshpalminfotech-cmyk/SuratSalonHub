export interface MySqlError {
    code: string;
    errno: number;
    sqlMessage: string;
}
export interface ApiResponse<T = any> {
    success: boolean;
    statusCode: number;
    data?: T;
    message?: string | object;
    path?: string;
    timestamp: string;
}
import {HttpStatus} from "@nestjs/common";
import {ApiResponse} from "../interfaces/api-response.interface";

export const successResponse = <T>(
    data: T,
    statusCode = HttpStatus.OK,
): ApiResponse<T> => ({
    success: true,
    statusCode,
    data,
    timestamp: new Date().toISOString(),
});

export const errorResponse = (
    statusCode: number,
    message: string | object,
    path?: string,
): ApiResponse => ({
    success: false,
    statusCode,
    message,
    path,
    timestamp: new Date().toISOString(),
});
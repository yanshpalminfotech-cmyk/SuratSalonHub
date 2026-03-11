import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: HttpException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const statusCode = exception.getStatus();
        const exResponse = exception.getResponse();

        // extract message — could be string or validation error object
        const message =
            typeof exResponse === 'string'
                ? exResponse
                : (exResponse as any).message ?? exception.message;

        this.logger.error(`${statusCode} — ${JSON.stringify(message)}`);

        response.status(statusCode).json({
            success: false,
            statusCode,
            message: Array.isArray(message) ? message : [message],
            timestamp: new Date().toISOString(),
        });
    }
}
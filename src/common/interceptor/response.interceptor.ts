import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';



export class ApiResponse<T> {
    success!: boolean;
    data?: T;
    message?: string;
    statusCode!: number;
    timestamp: string;

    constructor(partial: Partial<ApiResponse<T>>) {
        Object.assign(this, partial);
        this.timestamp = new Date().toISOString();
    }

    static success<T>(data: T, statusCode = 200): ApiResponse<T> {
        return new ApiResponse<T>({ success: true, data, statusCode });
    }

    static error(message: string, statusCode: number): ApiResponse<null> {
        return new ApiResponse<null>({ success: false, message, statusCode });
    }
}



@Injectable()
export class ResponseInterceptor<T>
    implements NestInterceptor<T, ApiResponse<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<ApiResponse<T>> {
        const statusCode = context
            .switchToHttp()
            .getResponse().statusCode;

        return next.handle().pipe(
            map((data) => ({
                success: true,
                data,
                statusCode,
                timestamp: new Date().toISOString(),
            })),
        );
    }
}


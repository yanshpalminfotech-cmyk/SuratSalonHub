import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'src/modules/user/entities/user.entity';


// usage: @CurrentUser() user: User
// export const CurrentUser = createParamDecorator(
//     (_data: unknown, ctx: ExecutionContext): User => {
//         const request = ctx.switchToHttp().getRequest();
//         return request.user as User;
//     },
// );

// export const CurrentUser = createParamDecorator(
//     (data: string | undefined, ctx: ExecutionContext) => {
//         const request = ctx.switchToHttp().getRequest();
//         const user = request.user;
//         return data ? user?.[data] : user;
//     },
// );

// usage: @CurrentUser() user: User
export const CurrentUser = createParamDecorator(
    (data: string | undefined, ctx: ExecutionContext): User => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;
        return data ? user?.[data] : user;
    },
);
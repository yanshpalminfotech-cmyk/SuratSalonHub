import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'src/modules/user/entities/user.entity';


// usage: @CurrentUser() user: User
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): User => {
        const request = ctx.switchToHttp().getRequest();
        return request.user as User;
    },
);
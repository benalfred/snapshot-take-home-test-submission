import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';

export const RequiredHeader = createParamDecorator(
    (headerName: string, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest();

        const value = request.headers[headerName.toLowerCase()];

        if (!value) {
            throw new BadRequestException(
                `${headerName} header is required`,
            );
        }

        return value;
    },
);
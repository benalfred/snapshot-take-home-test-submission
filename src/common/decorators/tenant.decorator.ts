import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';

export const Tenant = createParamDecorator(
    (_: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest();

        const tenantId = request.headers['x-tenant-id'];

        if (!tenantId) {
            throw new BadRequestException(
                'x-tenant-id header is required',
            );
        }

        if (Array.isArray(tenantId)) {
            return tenantId[0];
        }

        return tenantId;
    },
);
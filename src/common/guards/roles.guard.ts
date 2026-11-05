import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = context
      .switchToHttp()
      .getRequest<{ user?: { rol: string } }>().user;
    if (
      !user ||
      !(
        roles.includes(user.rol) ||
        (user.rol === 'Superadministrador' && roles.includes('Administrador'))
      )
    )
      throw new ForbiddenException(
        'No tienes permisos para acceder a este recurso',
      );
    return true;
  }
}

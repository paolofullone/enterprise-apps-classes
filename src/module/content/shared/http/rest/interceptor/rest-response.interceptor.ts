import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable()
export class RestResponseInterceptor<T extends object>
  implements NestInterceptor<any, T>
{
  constructor(private readonly dto: new () => T) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<T> {
    return next.handle().pipe(
      switchMap(async (data) => {
        const transformedData = plainToInstance(
          this.dto,
          instanceToPlain(data),
          { excludeExtraneousValues: true },
        );
        const errors = await validate(transformedData);

        if (errors.length > 0) {
          throw new BadRequestException({
            message: 'Response validation failed',
            errors,
          });
        }
        return transformedData;
      }),
    );
  }
}

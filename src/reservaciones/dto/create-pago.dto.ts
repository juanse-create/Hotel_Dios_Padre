import { IsString, IsNumber, IsOptional, MaxLength } from 'class-validator';

export class CreatePagoDto {
  @IsString() metodo_pago: string;
  @IsNumber() importe: number;
  @IsOptional() @IsString() banco?: string;
  @IsString() fecha_pago: string;
  @IsOptional() @IsString() @MaxLength(4) terminacion_tarjeta?: string;
  @IsOptional() @IsString() referencia?: string;
}
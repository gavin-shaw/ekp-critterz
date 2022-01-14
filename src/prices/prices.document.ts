import { DocumentDto } from '@earnkeeper/ekp-sdk-nestjs';

export interface PricesDocument extends DocumentDto {
  readonly blockPrice: number;
  readonly fiatSymbol: string;
  readonly scritterzPrice: number;
}

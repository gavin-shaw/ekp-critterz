import { DocumentDto } from '@earnkeeper/ekp-sdk-nestjs';

export interface RentalCheckerDocument extends DocumentDto {
  readonly estimatedCostTotal: number;
  readonly ethCost: number;
  readonly gasCost: number;
  readonly lockExpiration: number;
  readonly notForSale: boolean;
  readonly sellerAddress: string;
  readonly sellerAddressMasked: string;
  readonly sellerIsOwner: boolean;
  readonly tokenId: string;
}

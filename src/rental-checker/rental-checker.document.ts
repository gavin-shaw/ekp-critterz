import { EkDocument } from 'src/rental-market/ek-document';

export class RentalCheckerDocument extends EkDocument {
  constructor(properties: RentalCheckerDocument) {
    super(properties);
  }

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

import { EkDocument } from './ek-document';

export class RentalListingDocument extends EkDocument {
  constructor(properties: RentalListingDocument) {
    super(properties);
  }

  readonly estBlock: number;
  readonly estProfit: number;
  readonly ethCost: number;
  readonly ethGasCost: number;
  readonly expiresAt: number;
  readonly fiatSymbol: string;
  readonly tokenId: string;
  readonly tokenIdLink: string;
  readonly listed: number;
  readonly name: string;
  readonly seller: string;
  readonly sold: boolean;
  readonly soldTime: number;
  readonly totalCost: number;
}

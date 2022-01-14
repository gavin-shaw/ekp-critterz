import { DocumentDto } from '@earnkeeper/ekp-sdk-nestjs';

export interface RentedCritterDocument extends DocumentDto {
  readonly tokenId: string;
  readonly expiryDate: number;
  readonly renterAddress: string;
  readonly ownerAddress: string;
}

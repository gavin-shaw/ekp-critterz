import { SdkModule } from '@earnkeeper/ekp-sdk-nestjs';
import { Module } from '@nestjs/common';
import { RentalCheckerService } from './rental-checker/rental-checker.service';
import { RentalMarketService } from './rental-market/rental-market.service';
import { UiProcessor } from './ui/ui.processor';

@Module({
  imports: [SdkModule],
  providers: [
    // PricesProcessor,
    RentalCheckerService,
    // RentedCritterzProcessor,
    UiProcessor,
    RentalMarketService,
  ],
})
export class WorkerApp {}

import { SdkModule } from '@earnkeeper/ekp-sdk-nestjs';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { RentalCheckerService } from './rental-checker/rental-checker.service';
import { RentalMarketService } from './rental-market/rental-market.service';
import { UiProcessor } from './ui/ui.processor';
import { DEFAULT_QUEUE } from './util';

@Module({
  imports: [SdkModule, BullModule.registerQueue({ name: DEFAULT_QUEUE })],
  providers: [
    // PricesProcessor,
    RentalCheckerService,
    // RentedCritterzProcessor,
    UiProcessor,
    RentalMarketService,
  ],
})
export class WorkerApp {}

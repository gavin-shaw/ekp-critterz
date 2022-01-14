import { SocketModule } from '@earnkeeper/ekp-sdk-nestjs';
import { BullModule, BullModuleOptions } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QUEUE_NAMES } from './util/queue.names';

@Module({
  imports: [
    SocketModule,
    BullModule.registerQueue(
      ...QUEUE_NAMES.map((name: string) => <BullModuleOptions>{ name }),
    ),
  ],
  providers: [QueueService],
})
export class PrimaryModule {}

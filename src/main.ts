import { runCluster } from '@earnkeeper/ekp-sdk-nestjs';
import { PrimaryModule } from './primary.module';
import { WorkerModule } from './worker.module';

runCluster(PrimaryModule, WorkerModule);

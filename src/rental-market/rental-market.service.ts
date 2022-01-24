import {
  ClientService,
  ClientStateChangedEvent,
  ClientStateDto,
  CoingeckoService,
  EthersService,
  LayerDto,
  MoralisService,
  opensea,
  OpenseaService,
} from '@earnkeeper/ekp-sdk-nestjs';
import { AssetEvent } from '@earnkeeper/ekp-sdk-nestjs/dist/sdk/opensea/model';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { ethers } from 'ethers';
import _ from 'lodash';
import moment from 'moment';
import * as Rx from 'rxjs';
import {
  BLOCK_CONTRACT_ADDRESS,
  collection,
  DEFAULT_QUEUE,
  scritterzAbi,
  SCRITTERZ_CONTRACT_ADDRESS,
} from '../util';
import { RentalListingDocument } from './rental-listing.document';

@Injectable()
export class RentalMarketService {
  constructor(
    @InjectQueue(DEFAULT_QUEUE) protected queue: Queue,
    private clientService: ClientService,
    private coingeckoService: CoingeckoService,
    private ethersService: EthersService,
    private openseaService: OpenseaService,
    private moralisService: MoralisService,
  ) {
    this.clientService.clientStateEvents$
      .pipe(
        this.filterPath(),
        this.emitBusy(),
        this.initContext(),
        this.fetchPrices(),
        this.fetchAssetEvents(),
        this.forkJoin(this.splitByAssetId, (obs) =>
          obs.pipe(this.mapListingDocument(), this.emitListingLayer()),
        ),
        this.removeOldListingLayers(),
        this.emitDone(),
      )
      .subscribe();

    // this.eventsChangedSub = this.openseaService
    //   .pollEvents$(SCRITTERZ_CONTRACT_ADDRESS)
    //   .pipe(
    //     this.splitEventsPerClients(),
    //     this.emitBusy(),
    //     this.mapListingDocuments(),
    //     this.emitListingDocuments(),
    //     this.emitDone(),
    //   )
    //   .subscribe();
  }

  // TODO: make this dry
  filterPath() {
    return Rx.filter(
      (event: ClientStateChangedEvent) =>
        event?.state?.client?.path === '/plugin/critterz/rental-market',
    );
  }

  // TODO: make this DRY
  protected emitBusy() {
    return Rx.tap((event: ClientStateChangedEvent) => {
      const collectionName = collection(RentalListingDocument);

      const addLayers = [
        {
          id: `busy-${collectionName}`,
          collectionName: 'busy',
          set: [{ id: collectionName }],
        },
      ];
      this.clientService.addLayers(event.clientId, addLayers);
    });
  }

  // TODO: make this DRY
  protected emitDone() {
    const collectionName = collection(RentalListingDocument);

    return Rx.tap((context: RentalListingContext) => {
      const removeQuery = {
        id: `busy-${collectionName}`,
      };

      this.clientService.removeLayers(context.clientId, removeQuery);
    });
  }

  fetchPrices(): Rx.OperatorFunction<
    RentalListingContext,
    RentalListingContext
  > {
    return Rx.mergeMap(async (context: RentalListingContext) => {
      const currency = context.clientState.client.selectedCurrency;
      const gasPriceBn = await this.ethersService.wrapProviderCall(
        'eth',
        async (provider) => provider.getGasPrice(),
      );
      const nativeTokenPrices = await this.coingeckoService.nativeCoinPrices(
        currency.id,
      );

      const ethGasCost = Number(
        ethers.utils.formatEther(gasPriceBn.mul(204764)),
      );

      const ethPrice = nativeTokenPrices['eth'];

      const blockErc20Price = await this.moralisService.latestTokenPriceOf(
        'eth',
        BLOCK_CONTRACT_ADDRESS,
      );

      const blockPrice = !!blockErc20Price
        ? Number(ethers.utils.formatEther(blockErc20Price.nativePrice.value)) *
          ethPrice
        : undefined;

      return { ...context, ethPrice, ethGasCost, blockPrice };
    });
  }

  initContext(): Rx.OperatorFunction<
    ClientStateChangedEvent,
    RentalListingContext
  > {
    return Rx.map((clientStateChangedEvent) => ({
      clientState: clientStateChangedEvent.state,
      clientId: clientStateChangedEvent.clientId,
      startTimestamp: moment().unix(),
    }));
  }

  splitByAssetId(context: RentalListingContext): RentalListingContext[] {
    return _.chain(context.assetEvents)
      .groupBy((it: opensea.AssetEvent) => it.asset.id)
      .mapValues(
        (assetEvents: AssetEvent[]) =>
          <RentalListingContext>{
            ...context,
            asset: assetEvents[0].asset,
            assetEvents,
          },
      )
      .values()
      .value();
  }

  fetchAssetEvents(): Rx.OperatorFunction<
    RentalListingContext,
    RentalListingContext
  > {
    return Rx.mergeMap(async (context: RentalListingContext) => {
      const [created, successful] = await Promise.all([
        this.openseaService.eventsOf(SCRITTERZ_CONTRACT_ADDRESS, 'created'),
        this.openseaService.eventsOf(SCRITTERZ_CONTRACT_ADDRESS, 'successful'),
      ]);

      const assetEvents: AssetEvent[] = _.chain(created)
        .union(successful)
        .value();

      return { ...context, assetEvents };
    });
  }

  emitListingLayer(): Rx.OperatorFunction<
    RentalListingContext,
    RentalListingContext
  > {
    return Rx.tap((context) => {
      if (!context.document) {
        return;
      }

      const collectionName = collection(RentalListingDocument);

      const addLayers: LayerDto[] = [
        {
          id: `${collectionName}-${context.document.id}`,
          collectionName,
          set: [context.document],
          tags: [collectionName],
          timestamp: moment().unix(),
        },
      ];
      this.clientService.addLayers(context.clientId, addLayers);
    });
  }

  removeOldListingLayers(): Rx.OperatorFunction<
    RentalListingContext,
    RentalListingContext
  > {
    return Rx.tap((context) => {
      this.clientService.removeLayers(context.clientId, {
        tags: [collection(RentalListingDocument)],
        timestamp: {
          lt: context.startTimestamp,
        },
      });
    });
  }

  mapWithJob<C>(queue: Queue, jobName: string): Rx.OperatorFunction<C, C> {
    return Rx.mergeMap(async (context: C) => {
      const job = await queue.add(jobName, context);
      return await job.finished();
    });
  }

  splitEventsPerClients() {
    return Rx.flatMap(async (events) => {
      const clientStates = await this.clientService.latestClientStateEvents;
      return clientStates.map((clientState) => ({
        clientState,
        events,
      }));
    });
  }

  mapListingDocument() {
    return Rx.mergeMap(async (context: RentalListingContext) => {
      const nowMoment = moment.unix(context.startTimestamp);
      const form = context.clientState?.forms?.critterzMarketParams;
      const numCritter = form?.ownedCritterz ?? 0;
      const numHours = form?.playHours ?? 3;

      const createdEvent = context.assetEvents.find(
        (it) => it.event_type === 'created',
      );

      if (!createdEvent) {
        return context;
      }

      const soldEvent = context.assetEvents.find(
        (it) => it.event_type === 'successful',
      );

      const ethCost = Number(
        ethers.utils.formatEther(createdEvent.starting_price),
      );

      const tokenId = context.asset.token_id;

      let expiresAt = await this.getExpiresAt(tokenId);

      if (!expiresAt) {
        expiresAt = context.startTimestamp + 7 * 86400;
      }
      let hoursLeft = moment.unix(expiresAt).diff(nowMoment, 'hours');

      if (hoursLeft < 0) {
        hoursLeft = 0;
      }

      const calcBlock = (numCritter) =>
        ((24 * numCritter + Math.sqrt(numCritter * numHours) * 100) *
          0.66 *
          hoursLeft) /
        24;

      const estBlock = calcBlock(numCritter + 1) - calcBlock(numCritter);

      const totalCost = (ethCost + context.ethGasCost) * context.ethPrice;

      const document = new RentalListingDocument({
        estBlock,
        estProfit: !!context.blockPrice
          ? estBlock * context.blockPrice - totalCost
          : undefined,
        ethCost,
        ethGasCost: context.ethGasCost,
        expiresAt,
        fiatSymbol: context.clientState.client.selectedCurrency.symbol,
        id: context.asset.id.toString(),
        tokenId,
        tokenIdLink: `https://opensea.io/assets/${SCRITTERZ_CONTRACT_ADDRESS}/${context.asset.token_id}`,
        listed: moment(`${createdEvent.listing_time}Z`).unix(),
        name: context.asset.name,
        updated: context.startTimestamp,
        seller: createdEvent.seller?.address,
        sold: !!soldEvent,
        soldTime: !!soldEvent
          ? moment(`${soldEvent.created_date}Z`).unix()
          : undefined,
        totalCost,
      });

      return { ...context, document };
    });
  }

  private async getExpiresAt(tokenId: string): Promise<number> {
    return await this.ethersService.wrapProviderCall(
      'eth',
      async (provider) => {
        const contract = new ethers.Contract(
          SCRITTERZ_CONTRACT_ADDRESS,
          scritterzAbi,
          provider,
        );

        let tokenUri: string = await contract.tokenURI(Number(tokenId));

        tokenUri = tokenUri.replace('data:application/json;base64,', '');

        const tokenDetails = JSON.parse(atob(tokenUri));

        const lockExpirationAttribute = tokenDetails.attributes.find(
          (it) => it.trait_type === 'Lock Expiration',
        );

        if (!!lockExpirationAttribute) {
          return lockExpirationAttribute.value;
        }

        return undefined;
      },
    );
  }
  private forkJoin<T, R>(
    splitter: (input: T) => R[],
    projection: (obs: Rx.Observable<R>) => Rx.Observable<R>,
  ): Rx.OperatorFunction<T, T> {
    return Rx.mergeMap((context: T) =>
      Rx.forkJoin(
        splitter(context).map((item) => projection(Rx.of(item))),
      ).pipe(Rx.mapTo(context)),
    );
  }
}

interface RentalListingContext {
  readonly clientState: ClientStateDto;
  readonly clientId: string;
  readonly asset?: opensea.Asset;
  readonly assetEvents?: opensea.AssetEvent[];
  readonly blockPrice?: number;
  readonly document?: RentalListingDocument;
  readonly ethPrice?: number;
  readonly ethGasCost?: number;
  readonly startTimestamp: number;
}

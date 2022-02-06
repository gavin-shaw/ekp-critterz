import {
  AssetEventDto,
  ClientService,
  ClientStateChangedEvent,
  CoingeckoService,
  collection,
  EkDocument,
  EthersService,
  LayerDto,
  MoralisService,
  OpenseaService,
} from '@earnkeeper/ekp-sdk-nestjs';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';
import _ from 'lodash';
import moment from 'moment';
import { filter, map } from 'rxjs';
import {
  BLOCK_CONTRACT_ADDRESS,
  scritterzAbi,
  SCRITTERZ_CONTRACT_ADDRESS,
} from '../util';
import { RentalListingDocument } from './rental-listing.document';

const FILTER_PATH = '/plugin/critterz/rental-market';
const COLLECTION_NAME = collection(RentalListingDocument);

function filterPath(event: ClientStateChangedEvent, path: string) {
  return event.state?.client?.path === path;
}

@Injectable()
export class RentalMarketService {
  async handleClientStateEvent(
    clientStateChangedEvent: ClientStateChangedEvent,
  ) {
    await this.emitBusy(clientStateChangedEvent, COLLECTION_NAME);

    const assetEvents24h = await this.fetchAssetEvents24h();

    const prices = await this.fetchPrices(clientStateChangedEvent);

    const listings = assetEvents24h.filter(
      (it) => it.event_type === 'created' && Number(it.quantity) === 1,
    );

    const sales = _.chain(assetEvents24h)
      .filter(
        (it) => it.event_type === 'successful' && Number(it.quantity) === 1,
      )
      .groupBy((it) => `${it.seller.address}-${it.asset?.token_id}`)
      .mapValues((it) => it[0])
      .value();

    await Promise.all(
      listings.map(async (listing) => {
        const sale =
          sales[`${listing.seller.address}-${listing.asset?.token_id}`];
        const document = await this.mapListingDocument(
          clientStateChangedEvent,
          listing,
          sale,
          prices,
        );

        if (!!document) {
          await this.emitDocuments(clientStateChangedEvent, COLLECTION_NAME, [
            document,
          ]);
        }
      }),
    );

    await this.removeOldLayers(clientStateChangedEvent, COLLECTION_NAME);

    await this.emitDone(clientStateChangedEvent, COLLECTION_NAME);
  }

  async handleOpenseaAssetEvents(newAssetEvents: AssetEventDto[]) {
    const clientStates = await this.clientService.latestClientStateEvents.then(
      (events) =>
        events.filter(
          (event) => filterPath(event, FILTER_PATH) && !!event.received,
        ),
    );

    if (clientStates.length === 0) {
      return;
    }

    const assetEvents24h = await this.fetchAssetEvents24h();

    const newSales = _.chain(newAssetEvents)
      .filter(
        (it) => it.event_type === 'successful' && Number(it.quantity) === 1,
      )
      .groupBy((it) => `${it.seller.address}-${it.asset?.token_id}`)
      .mapValues((it) => it[0])
      .value();

    const allListings = _.chain(assetEvents24h)
      .filter((it) => it.event_type === 'created' && Number(it.quantity) === 1)
      .groupBy((it) => `${it.seller.address}-${it.asset?.token_id}`)
      .mapValues((it) => it[0])
      .value();

    await Promise.all(
      clientStates.map(async (clientStateChangedEvent) => {
        await this.emitBusy(clientStateChangedEvent, COLLECTION_NAME);

        const prices = await this.fetchPrices(clientStateChangedEvent);

        await Promise.all(
          newAssetEvents.map(async (assetEvent) => {
            let listing: AssetEventDto;
            let sale: AssetEventDto;

            if (assetEvent.event_type === 'created') {
              listing = assetEvent;
              sale =
                newSales[
                  `${assetEvent.seller.address}-${assetEvent.asset?.token_id}`
                ];
            }

            if (assetEvent.event_type === 'successful') {
              listing =
                allListings[
                  `${assetEvent.seller.address}-${assetEvent.asset?.token_id}`
                ];

              sale = assetEvent;
            }

            if (!listing) {
              return;
            }

            const document = await this.mapListingDocument(
              clientStateChangedEvent,
              listing,
              sale,
              prices,
            );

            await this.emitDocuments(clientStateChangedEvent, COLLECTION_NAME, [
              document,
            ]);
          }),
        );

        await this.emitDone(clientStateChangedEvent, COLLECTION_NAME);
      }),
    );
  }

  constructor(
    private coingeckoService: CoingeckoService,
    private ethersService: EthersService,
    private openseaService: OpenseaService,
    private moralisService: MoralisService,
    private clientService: ClientService,
  ) {
    this.openseaService.syncAssetEvents(SCRITTERZ_CONTRACT_ADDRESS);

    this.clientService.clientStateEvents$
      .pipe(filter((event) => filterPath(event, FILTER_PATH)))
      .subscribe((event) => {
        this.handleClientStateEvent(event);
      });

    this.openseaService.assetPolls$
      .pipe(
        filter((poll) => poll.contractAddress === SCRITTERZ_CONTRACT_ADDRESS),
        map((poll) =>
          poll.events.filter((it) =>
            ['created', 'successful'].includes(it.event_type),
          ),
        ),
        filter((events) => events.length > 0),
      )
      .subscribe((events) => {
        this.handleOpenseaAssetEvents(events);
      });
  }

  async fetchPrices(
    event: ClientStateChangedEvent,
  ): Promise<{ ethPrice: number; ethGasCost: number; blockPrice: number }> {
    const currency = event.state.client.selectedCurrency;
    const gasPriceBn = await this.ethersService.wrapProviderCall(
      'eth',
      async (provider) => provider.getGasPrice(),
    );
    const nativeTokenPrices = await this.coingeckoService.nativeCoinPrices(
      currency.id,
    );

    const ethGasCost = Number(ethers.utils.formatEther(gasPriceBn.mul(204764)));

    const ethPrice = nativeTokenPrices['eth'];

    const blockErc20Price = await this.moralisService.latestTokenPriceOf(
      'eth',
      BLOCK_CONTRACT_ADDRESS,
    );

    const blockPrice = !!blockErc20Price
      ? Number(ethers.utils.formatEther(blockErc20Price.nativePrice.value)) *
        ethPrice
      : undefined;

    return { ethPrice, ethGasCost, blockPrice };
  }

  async fetchAssetEvents24h(): Promise<AssetEventDto[]> {
    const since = moment().subtract(1, 'day').unix();

    return this.openseaService.eventsOf(SCRITTERZ_CONTRACT_ADDRESS, since, [
      'created',
      'successful',
    ]);
  }

  async mapListingDocument(
    clientEvent: ClientStateChangedEvent,
    listing: AssetEventDto,
    sale: AssetEventDto,
    prices: { ethPrice: number; ethGasCost: number; blockPrice: number },
  ) {
    const nowMoment = moment.unix(clientEvent.received);
    const form = clientEvent.state?.forms?.critterzMarketParams;
    const numCritter = form?.ownedCritterz ?? 0;
    const numHours = form?.playHours ?? 3;

    const ethCost = Number(ethers.utils.formatEther(listing.starting_price));

    if (!listing.asset) {
      console.log(listing);
    }
    const tokenId = listing.asset.token_id;

    let expiresAt = await this.getExpiresAt(tokenId);

    if (!expiresAt) {
      expiresAt = clientEvent.received + 7 * 1440 * 60;
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

    const totalCost = (ethCost + prices.ethGasCost) * prices.ethPrice;

    const document = new RentalListingDocument({
      estBlock,
      estProfit: !!prices.blockPrice
        ? estBlock * prices.blockPrice - totalCost
        : undefined,
      ethCost,
      ethGasCost: prices.ethGasCost,
      expiresAt,
      fiatSymbol: clientEvent.state.client.selectedCurrency.symbol,
      id: listing.asset.id.toString(),
      tokenId,
      tokenIdLink: `https://opensea.io/assets/${SCRITTERZ_CONTRACT_ADDRESS}/${listing.asset.token_id}`,
      listed: moment(`${listing.listing_time}Z`).unix(),
      name: listing.asset.name,
      updated: nowMoment.unix(),
      seller: listing.seller?.address,
      sold: !!sale,
      soldTime: !!sale ? moment(`${sale.created_date}Z`).unix() : undefined,
      totalCost,
    });

    return document;
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

  async emitBusy(event: ClientStateChangedEvent, collectionName: string) {
    const addLayers = [
      {
        id: `busy-${collectionName}`,
        collectionName: 'busy',
        set: [{ id: collectionName }],
      },
    ];
    await this.clientService.addLayers(event.clientId, addLayers);
  }

  async emitDone(event: ClientStateChangedEvent, collectionName: string) {
    const removeQuery = {
      id: `busy-${collectionName}`,
    };

    await this.clientService.removeLayers(event.clientId, removeQuery);
  }

  async emitDocuments(
    clientEvent: ClientStateChangedEvent,
    collectionName: string,
    documents: EkDocument[],
  ) {
    const addLayers: LayerDto[] = [
      {
        id: randomUUID(),
        collectionName,
        set: documents,
        tags: [collectionName],
        timestamp: moment().unix(),
      },
    ];
    await this.clientService.addLayers(clientEvent.clientId, addLayers);
  }

  async removeOldLayers(
    clientStateChangedEvent: ClientStateChangedEvent,
    collectionName: string,
  ) {
    await this.clientService.removeLayers(clientStateChangedEvent.clientId, {
      tags: [collectionName],
      timestamp: {
        lt: clientStateChangedEvent.received,
      },
    });
  }
}

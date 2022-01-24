import {
  ClientService,
  ClientStateChangedEvent,
  EthersService,
  MoralisService,
  OpenseaService,
} from '@earnkeeper/ekp-sdk-nestjs';
import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import _ from 'lodash';
import * as Rx from 'rxjs';
import {
  collection,
  NULL_ADDRESS,
  scritterzAbi,
  SCRITTERZ_CONTRACT_ADDRESS,
} from '../util';
import { RentalCheckerDocument } from './rental-checker.document';

@Injectable()
export class RentalCheckerService {
  constructor(
    private clientService: ClientService,
    private ethersService: EthersService,
    private moralisService: MoralisService,
    private openseaService: OpenseaService,
  ) {
    this.clientService.clientStateEvents$
      .pipe(
        this.emitBusy(),
        this.mapRentalCheckerDocuments(),
        this.emitDocuments(),
        this.emitDone(),
      )
      .subscribe();
  }

  private mapRentalCheckerDocuments() {
    return Rx.mergeMap(async (event: ClientStateChangedEvent) => {
      const form = event.state.forms?.critterzRentalCheck;

      const tokenId = form?.tokenId;

      if (!form || !tokenId || isNaN(tokenId)) {
        return { event, documents: [] };
      }

      let lockExpiration = undefined;
      let gasCost: number = undefined;

      await this.ethersService.wrapProviderCall('eth', async (provider) => {
        const gasPriceBn = await provider.getGasPrice();

        gasCost = Number(ethers.utils.formatEther(gasPriceBn.mul(204764)));

        const contract = new ethers.Contract(
          SCRITTERZ_CONTRACT_ADDRESS,
          scritterzAbi,
          provider,
        );

        let tokenUri: string = await contract.tokenURI(tokenId);

        tokenUri = tokenUri.replace('data:application/json;base64,', '');

        const tokenDetails = JSON.parse(atob(tokenUri));

        const lockExpirationAttribute = tokenDetails.attributes.find(
          (it) => it.trait_type === 'Lock Expiration',
        );

        if (!!lockExpirationAttribute) {
          lockExpiration = lockExpirationAttribute.value;
        }
      });

      const openseaAsset = await this.openseaService.assetOf(
        SCRITTERZ_CONTRACT_ADDRESS,
        tokenId.toString(),
      );

      const sellOrders =
        openseaAsset.orders?.filter((it: any) => it.side === 1) ?? [];

      const notForSale = sellOrders.length === 0;

      let sellerAddress = 'Unknown';
      let sellerAddressMasked = 'Unknown';
      let ethCost = undefined;
      let estimatedCostTotal = undefined;

      if (!notForSale) {
        const sellOrder = sellOrders[0];

        ethCost = Number(ethers.utils.formatEther(sellOrder.base_price));

        estimatedCostTotal = ethCost + gasCost;

        sellerAddress = sellOrder.maker.address;
        sellerAddressMasked = sellerAddress
          .substring(sellerAddress.length - 6)
          .toUpperCase();
      }

      const tokenIdTransfers = await this.moralisService.nftTransfersOfTokenId(
        'eth',
        SCRITTERZ_CONTRACT_ADDRESS,
        tokenId.toString(),
      );

      const lastStakingTransfer = _.chain(tokenIdTransfers)
        .filter((it) => it.from_address === NULL_ADDRESS)
        .first()
        .value();

      const sellerIsOwner =
        lastStakingTransfer?.to_address.toLowerCase() === sellerAddress;

      // const sellerAddress = lastStakingTransfer.to_address;

      const document: RentalCheckerDocument = {
        estimatedCostTotal,
        ethCost,
        gasCost,
        id: '0',
        notForSale,
        lockExpiration,
        sellerAddress,
        sellerAddressMasked,
        sellerIsOwner,
        tokenId,
      };

      return {
        event,
        documents: [document],
      };
    });
  }

  // TODO: make this DRY
  protected emitBusy() {
    return Rx.tap((event: ClientStateChangedEvent) => {
      const collectionName = collection(RentalCheckerDocument);

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
    const collectionName = collection(RentalCheckerDocument);

    return Rx.tap(({ event }) => {
      const removeQuery = {
        id: `busy-${collectionName}`,
      };

      this.clientService.removeLayers(event.clientId, removeQuery);
    });
  }

  private emitDocuments() {
    return Rx.tap(({ event, documents }) => {
      if (documents.length === 0) {
        const removeQuery = {
          id: collection(RentalCheckerDocument),
        };

        this.clientService.removeLayers(event.clientId, removeQuery);
      } else {
        const addLayers = [
          {
            id: collection(RentalCheckerDocument),
            collectionName: collection(RentalCheckerDocument),
            set: documents,
          },
        ];
        this.clientService.addLayers(event.clientId, addLayers);
      }
    });
  }
}

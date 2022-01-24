import {
  Button,
  Col,
  Container,
  Datatable,
  Form,
  formatCurrency,
  formatTemplate,
  formatTimeToNow,
  formatToken,
  Input,
  isBusy,
  Layout,
  Link,
  PageHeaderTile,
  PremiumOnly,
  Row,
  Span,
  UiElement,
} from '@earnkeeper/ekp-ui';
import { documents } from '../util';
import { collection } from '../util/paths';
import { RentalListingDocument } from './rental-listing.document';

export default function element(): UiElement {
  return Container({
    children: [
      Row({
        className: 'mb-2',
        children: [
          Col({
            className: 'col-auto',
            children: [
              PageHeaderTile({
                title: 'Rental Market',
                icon: 'cil-cart',
              }),
            ],
          }),
          Col({
            className: 'my-auto col-auto',
            children: [
              Link({
                content: 'Opensea listings',
                href: 'https://opensea.io/collection/staked-critterz?tab=activity',
                external: true,
                externalIcon: true,
              }),
            ],
          }),
        ],
      }),
      marketParamsForm(),
      marketRow(),
    ],
  });
}

function marketRow(): UiElement {
  return Datatable({
    defaultSortFieldId: 'listed',
    defaultSortAsc: false,
    data: documents(RentalListingDocument),
    columns: [
      {
        id: 'tokenId',
        value: '$.tokenId',
        cell: Link({
          content: formatTemplate('#{{ tokenId }}', { tokenId: '$.tokenId' }),
          href: '$.tokenIdLink',
          external: true,
          externalIcon: true,
        }),
      },
      {
        id: 'listed',
        value: '$.listed',
        label: formatTimeToNow('$.listed'),
      },
      {
        id: 'soldTime',
        name: 'Sold',
        value: '$.soldTime',
        label: formatTimeToNow('$.soldTime'),
      },
      {
        id: 'expiresIn',
        name: 'Expires',
        value: '$.expiresAt',
        label: formatTimeToNow('$.expiresAt'),
      },
      {
        id: 'totalCost',
        value: '$.totalCost',
        label: formatCurrency('$.totalCost', '$.fiatSymbol'),
      },
      {
        id: 'estBlock',
        label: formatToken('$.estBlock'),
      },
      {
        id: 'estProfit',
        cell: PremiumOnly({
          child: Span({
            content: formatCurrency('$.estProfit', '$.fiatSymbol'),
          }),
        }),
      },
    ],
  });
}

function marketParamsForm(): UiElement {
  return Form({
    name: 'critterzMarketParams',
    className: 'mb-2',
    schema: {
      type: 'object',
      properties: {
        playHours: {
          type: 'number',
        },
        ownedCritterz: {
          type: 'number',
        },
      },
      default: {
        playHours: 3,
        ownedCritterz: 0,
      },
    },
    child: Layout.autocol([
      Input({
        label: 'Daily Play Hours',
        name: 'playHours',
      }),
      Input({
        label: 'Already Owned Critterz',
        name: 'ownedCritterz',
      }),
      Button({
        label: 'Update',
        isSubmit: true,
        isBusy: isBusy(collection(RentalListingDocument)),
      }),
    ]),
  });
}

import {
  Col,
  Container,
  Datatable,
  Form,
  formatCurrency,
  formatMaskAddress,
  formatTimeToNow,
  formatToken,
  navigate,
  PageHeaderTile,
  Row,
  UiElement,
} from '@earnkeeper/ekp-ui';
import { documents } from '../util';
import { RentalListingDocument } from './rental-listing.document';

export default function element(): UiElement {
  return Container({
    children: [
      Row({
        children: [
          Col({
            children: [
              PageHeaderTile({
                title: 'Rental Market',
                icon: 'cil-cart',
              }),
            ],
          }),
        ],
      }),
      // marketParamsForm(),
      marketRow(),
    ],
  });
}

function marketRow(): UiElement {
  return Datatable({
    defaultSortFieldId: 'listed',
    defaultSortAsc: false,
    data: documents(RentalListingDocument),
    onRowClicked: navigate('$.tokenIdLink', true, true),
    columns: [
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
        id: 'name',
      },
      {
        id: 'seller',
        label: formatMaskAddress('$.seller'),
      },
      {
        id: 'expiresIn',
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
        label: formatCurrency('$.estProfit', '$.fiatSymbol'),
      },
    ],
  });
}

function marketParamsForm(): UiElement {
  return Row({
    children: [
      Col({
        children: [
          Form({
            name: 'critterzMarketParams',
            uischema: {
              type: 'Control',
              scope: '#/properties/ownedCritterz',
              label: 'Already Owned Critterz',
            },
            schema: {
              type: 'object',
              properties: {
                playHours: {
                  type: 'string',
                },
                ownedCritterz: {
                  type: 'string',
                },
              },
              default: {
                playHours: 3,
                ownedCritterz: 0,
              },
            },
            submitLabel: 'Update',
          }),
        ],
      }),
    ],
  });
}

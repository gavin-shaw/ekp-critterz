import { collection, path } from '@earnkeeper/ekp-sdk-nestjs';
import {
  Button,
  Card,
  Col,
  Container,
  Form,
  formatDatetime,
  formatTemplate,
  formatTimeToNow,
  formatToken,
  Fragment,
  Icon,
  Input,
  isBusy,
  JsonSchema,
  LabelWrapper,
  Layout,
  Link,
  PageHeaderTile,
  Row,
  Span,
  UiElement,
} from '@earnkeeper/ekp-ui';
import { RentalCheckerDocument } from './rental-checker.document';

export default function element(): UiElement {
  return Container({
    children: [
      Row({
        children: [
          Col({
            children: [
              PageHeaderTile({
                title: 'Rental Checker',
                icon: 'cil-search',
              }),
            ],
          }),
        ],
      }),
      tokenIdForm(),
      Card({
        className: 'mt-1',
        when: `${path(RentalCheckerDocument)}[0]`,
        children: [
          Fragment({
            when: { not: `${path(RentalCheckerDocument)}[0].notForSale` },
            children: [sellerInfo(), sellerIsOwner(), sellerIsNotOwner()],
          }),
          Fragment({
            when: `${path(RentalCheckerDocument)}[0].notForSale`,
            children: [notForSale()],
          }),
          lockExpirationAndCost(),
        ],
      }),
    ],
  });
}

function tokenIdForm(): UiElement {
  return Row({
    children: [
      Col({
        children: [
          Form({
            name: 'critterzRentalCheck',
            schema: JsonSchema.simple({
              tokenId: 'number',
            }),
            child: Layout.autocol([
              Input({
                label: 'Token Id',
                name: 'tokenId',
              }),
              Button({
                label: 'Check',
                isSubmit: true,
                isBusy: isBusy(collection(RentalCheckerDocument)),
              }),
            ]),
          }),
        ],
      }),
    ],
  });
}

function sellerInfo(): UiElement {
  return Row({
    children: [
      Col({
        children: [
          LabelWrapper({
            label: 'Seller',
            child: Link({
              className: 'font-medium-5 mb-2',
              content: '$.critterzRentalChecker[0].sellerAddressMasked',
              href: formatTemplate(
                'https://etherscan.io/address/{{ seller }}',
                {
                  seller: `${path(RentalCheckerDocument)}[0].sellerAddress`,
                },
              ),
            }),
          }),
        ],
      }),
    ],
  });
}

function sellerIsOwner() {
  return Container({
    className: 'px-0 py-2',
    when: `${path(RentalCheckerDocument)}[0].sellerIsOwner`,
    children: [
      Row({
        children: [
          Col({
            className: 'col-auto font-medium-1 mb-1',
            children: [Span({ content: 'Seller is Owner' })],
          }),
          Col({
            className: 'col-auto',
            children: [
              Icon({
                size: 'xl',
                name: 'cil-check-circle',
              }),
            ],
          }),
        ],
      }),
      Row({
        children: [
          Col({
            children: [
              Span({
                content:
                  'This means that as soon as you buy this item, the lock expiration will reset to 7 days in the future. Thumbs up! You can ignore the lock expiration below.',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function lockExpirationAndCost(): UiElement {
  return Row({
    className: 'px-0 py-2',
    children: [
      Col({
        children: [
          LabelWrapper({
            label: 'Lock Expiration',
            child: Fragment({
              children: [
                Span({
                  className: 'font-medium-4',
                  when: `${path(RentalCheckerDocument)}[0].lockExpiration`,
                  content: formatTimeToNow(
                    `${path(RentalCheckerDocument)}[0].lockExpiration`,
                  ),
                }),
                Span({
                  className: 'font-medium-4',
                  when: {
                    not: `${path(RentalCheckerDocument)}[0].lockExpiration`,
                  },
                  content: '?',
                }),
              ],
            }),
            feedbackText: formatDatetime(
              `${path(RentalCheckerDocument)}[0].lockExpiration`,
            ),
          }),
        ],
      }),
      Col({
        children: [
          LabelWrapper({
            label: 'Estimated Total Cost',
            when: { not: `${path(RentalCheckerDocument)}[0].notForSale` },
            child: Span({
              className: 'font-medium-4',
              content: formatTemplate('{{ eth }} ETH', {
                eth: formatToken(
                  `${path(RentalCheckerDocument)}[0].estimatedCostTotal`,
                ),
              }),
            }),
            feedbackText: formatTemplate('{{ eth }} + {{ gas }} gas', {
              eth: formatToken(`${path(RentalCheckerDocument)}[0].ethCost`),
              gas: formatToken(`${path(RentalCheckerDocument)}[0].gasCost`),
            }),
          }),
          LabelWrapper({
            label: 'Estimated Total Cost',
            when: `${path(RentalCheckerDocument)}[0].notForSale`,
            child: Span({
              className: 'font-medium-4',
              content: '?',
            }),
          }),
        ],
      }),
    ],
  });
}

function sellerIsNotOwner(): UiElement {
  return Container({
    className: 'px-0 py-2',
    when: {
      not: `${path(RentalCheckerDocument)}[0].sellerIsOwner`,
    },
    children: [
      Row({
        children: [
          Col({
            className: 'col-auto font-medium-1 mb-1',
            children: [Span({ content: 'Seller is NOT Owner' })],
          }),
          Col({
            className: 'col-auto',
            children: [
              Icon({
                size: 'xl',
                name: 'cil-x-circle',
              }),
            ],
          }),
        ],
      }),
      Row({
        children: [
          Col({
            children: [
              Span({
                content:
                  'Be careful, this means that at the end of the lock expiration below, the critter may be revoked and you will lose access to it',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function notForSale(): UiElement {
  return Container({
    className: 'px-0 py-2',
    children: [
      Row({
        children: [
          Col({
            className: 'col-auto font-medium-1 mb-1',
            children: [Span({ content: 'Not for sale' })],
          }),
          Col({
            className: 'col-auto',
            children: [
              Icon({
                size: 'xl',
                name: 'cil-x-circle',
              }),
            ],
          }),
        ],
      }),
      Row({
        children: [
          Col({
            children: [
              Span({
                content:
                  "This item is not currently for sale, so we can't tell whether it is safe to buy just yet",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

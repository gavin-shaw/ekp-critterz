import { formatCurrency, PriceLink } from '@earnkeeper/ekp-ui';
import { PRICES_DOCUMENT } from '../util';

export default function menus() {
  return [
    {
      id: 'critterz',
      header: 'Critterz',
    },
    {
      id: 'critterz-rental-market',
      title: 'Rental Market',
      navLink: 'critterz/rental-market',
      icon: 'cil-cart',
    },

    // {
    //   id: 'critterz-rental-checker',
    //   title: 'Rental Checker',
    //   navLink: 'critterz/rental-checker',
    //   icon: 'cil-search',
    // },
    // {
    //   id: 'critterz-rented-critterz',
    //   title: 'Rented Critterz',
    //   navLink: 'critterz/rented-critterz',
    //   icon: 'cil-paw',
    // },
  ];
}

import rentalMarket from '../rental-market/rental-market.uielement';

export default function pages() {
  return [
    {
      id: 'critterz/rental-market',
      element: rentalMarket(),
    },
    // {
    //   id: 'critterz/rented-critterz',
    //   element: rentedCritterz(),
    // },
  ];
}

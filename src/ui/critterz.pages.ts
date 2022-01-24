import rentalChecker from '../rental-checker/rental-checker.uielement';
import rentalMarket from '../rental-market/rental-market.uielement';

export default function pages() {
  return [
    {
      id: 'critterz/rental-checker',
      element: rentalChecker(),
    },
    {
      id: 'critterz/rental-market',
      element: rentalMarket(),
    },
  ];
}

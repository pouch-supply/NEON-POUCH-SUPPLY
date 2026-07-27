import { Discount, CartItem } from './types';

export function calculateDiscountAmount(
  discount: Discount | null,
  cartItems: CartItem[],
  subtotal: number,
  products: any[] = [],
  collections: any[] = []
): number {
  if (!discount || discount.status !== 'Active') return 0;

  switch (discount.type) {
    case 'Amount off order': {
      // Check minimum purchase requirements first
      if (discount.minRequirementsType === 'Minimum purchase amount ($)') {
        if (subtotal < (discount.minRequirementsValue || 0)) return 0;
      }
      if (discount.minRequirementsType === 'Minimum quantity of items') {
        const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        if (totalQty < (discount.minRequirementsValue || 0)) return 0;
      }

      // Calculate discount value
      const amount = discount.valueAmount || 0;
      if (discount.valueType === 'Percentage') {
        return subtotal * (amount / 100);
      } else {
        return Math.min(amount, subtotal);
      }
    }

    case 'Amount off products': {
      // Check minimum purchase requirements
      if (discount.minRequirementsType === 'Minimum purchase amount ($)') {
        if (subtotal < (discount.minRequirementsValue || 0)) return 0;
      }
      if (discount.minRequirementsType === 'Minimum quantity of items') {
        const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        if (totalQty < (discount.minRequirementsValue || 0)) return 0;
      }

      const appliesToIds = discount.appliesToIds || [];
      const appliesToType = discount.appliesToType || 'Specific products';

      let discountSum = 0;
      const amount = discount.valueAmount || 0;

      for (const item of cartItems) {
        let matches = false;
        if (appliesToIds.length === 0) {
          matches = true;
        } else if (appliesToType === 'Specific products') {
          matches = appliesToIds.includes(item.productId);
        } else if (appliesToType === 'Specific collections') {
          const colls = collections.filter(c => appliesToIds.includes(c.id));
          matches = colls.some(c => c.productIds && c.productIds.includes(item.productId));
        }

        if (matches) {
          if (discount.valueType === 'Percentage') {
            discountSum += (item.price * item.quantity) * (amount / 100);
          } else {
            discountSum += Math.min(amount, item.price) * item.quantity;
          }
        }
      }
      return Math.min(discountSum, subtotal);
    }

    case 'Buy X get Y': {
      const buyQty = discount.customerBuysValue || 1;
      const buyType = discount.customerBuysType || 'Minimum quantity of items';
      const buyAppliesType = discount.customerBuysAppliesToType || 'Specific products';
      const buyIds = discount.customerBuysAppliesToIds || [];

      const buyMatchingItems = cartItems.filter(item => {
        if (buyIds.length === 0) return true;
        if (buyAppliesType === 'Specific products') {
          return buyIds.includes(item.productId);
        } else {
          const colls = collections.filter(c => buyIds.includes(c.id));
          return colls.some(c => c.productIds && c.productIds.includes(item.productId));
        }
      });

      const totalBuyQtyInCart = buyMatchingItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalBuyValueInCart = buyMatchingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      if (buyType === 'Minimum quantity of items' && totalBuyQtyInCart < buyQty) return 0;
      if (buyType === 'Minimum purchase amount' && totalBuyValueInCart < buyQty) return 0;

      let triggers = 1;
      if (buyType === 'Minimum quantity of items') {
        triggers = Math.floor(totalBuyQtyInCart / buyQty);
      } else {
        triggers = Math.floor(totalBuyValueInCart / buyQty);
      }
      if (triggers < 1) triggers = 1;

      const getQtyRequired = (discount.customerGetsValue || 1) * triggers;
      const getAppliesType = discount.customerGetsAppliesToType || 'Specific products';
      const getIds = discount.customerGetsAppliesToIds || [];

      const getMatchingItems = cartItems.filter(item => {
        if (getIds.length === 0) return true;
        if (getAppliesType === 'Specific products') {
          return getIds.includes(item.productId);
        } else {
          const colls = collections.filter(c => getIds.includes(c.id));
          return colls.some(c => c.productIds && c.productIds.includes(item.productId));
        }
      });

      if (getMatchingItems.length === 0) return 0;

      const flatGetItems: { price: number; productId: string }[] = [];
      for (const item of getMatchingItems) {
        for (let i = 0; i < item.quantity; i++) {
          flatGetItems.push({ price: item.price, productId: item.productId });
        }
      }

      flatGetItems.sort((a, b) => a.price - b.price);

      let itemsToDiscountCount = getQtyRequired;
      if (discount.maxUsesPerOrder) {
        itemsToDiscountCount = Math.min(itemsToDiscountCount, discount.maxUsesPerOrder);
      }
      itemsToDiscountCount = Math.min(itemsToDiscountCount, flatGetItems.length);

      let discountSum = 0;
      const getDiscountType = discount.customerGetsDiscountType || 'Percentage';
      const getDiscountVal = discount.customerGetsDiscountValue || 0;

      for (let i = 0; i < itemsToDiscountCount; i++) {
        const item = flatGetItems[i];
        if (getDiscountType === 'Free') {
          discountSum += item.price;
        } else if (getDiscountType === 'Percentage') {
          discountSum += item.price * (getDiscountVal / 100);
        } else if (getDiscountType === 'Amount off each') {
          discountSum += Math.min(getDiscountVal, item.price);
        }
      }

      return Math.min(discountSum, subtotal);
    }

    case 'Free shipping': {
      return 0;
    }

    default:
      if (discount.title.includes('15') || discount.details.includes('15')) {
        return subtotal * 0.15;
      }
      return Math.min(5.00, subtotal);
  }
}

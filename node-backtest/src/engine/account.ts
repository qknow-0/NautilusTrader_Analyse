import Decimal from 'decimal.js';
import { Price, Quantity } from '../core/types.js';
import { OrderSide, OrderType } from '../core/enums.js';

// Account balance for a single currency
export class AccountBalance {
  public total: Decimal;
  public locked: Decimal;

  constructor(public readonly currency: string, initial: Decimal = new Decimal(0)) {
    this.total = initial;
    this.locked = new Decimal(0);
  }

  get free(): Decimal {
    return this.total.sub(this.locked);
  }

  deposit(amount: Decimal): void {
    this.total = this.total.add(amount);
  }

  withdraw(amount: Decimal): void {
    if (this.free.lt(amount)) {
      throw new Error(`Insufficient ${this.currency} balance: free=${this.free}, need=${amount}`);
    }
    this.total = this.total.sub(amount);
  }

  lock(amount: Decimal): void {
    if (this.free.lt(amount)) {
      throw new Error(`Insufficient free ${this.currency}: free=${this.free}, need=${amount}`);
    }
    this.locked = this.locked.add(amount);
  }

  unlock(amount: Decimal): void {
    this.locked = this.locked.sub(amount);
    if (this.locked.lt(0)) {
      this.locked = new Decimal(0);
    }
  }

  toString(): string {
    return `${this.total} ${this.currency} (free: ${this.free}, locked: ${this.locked})`;
  }
}

// Cash account for spot trading
export class CashAccount {
  public balances: Map<string, AccountBalance>;

  constructor(initialBalances: Map<string, Decimal>) {
    this.balances = new Map();
    for (const [currency, amount] of initialBalances) {
      this.balances.set(currency, new AccountBalance(currency, amount));
    }
  }

  getBalance(currency: string): AccountBalance {
    let balance = this.balances.get(currency);
    if (!balance) {
      balance = new AccountBalance(currency);
      this.balances.set(currency, balance);
    }
    return balance;
  }

  getFree(currency: string): Decimal {
    return this.getBalance(currency).free;
  }

  // Lock funds for a buy order
  lockForBuy(quoteCurrency: string, cost: Decimal): void {
    this.getBalance(quoteCurrency).lock(cost);
  }

  // Unlock funds when order is cancelled or partially filled
  unlockForCancel(quoteCurrency: string, amount: Decimal): void {
    this.getBalance(quoteCurrency).unlock(amount);
  }

  // Execute a fill
  fillOrder(
    side: OrderSide,
    type: OrderType,
    quoteCurrency: string,
    baseCurrency: string,
    cost: Decimal,
    quantity: Decimal,
  ): void {
    if (side === OrderSide.Buy) {
      // Pay quote currency, receive base currency
      const quoteBal = this.getBalance(quoteCurrency);
      quoteBal.locked = quoteBal.locked.sub(cost);
      quoteBal.total = quoteBal.total.sub(cost);

      const baseBal = this.getBalance(baseCurrency);
      baseBal.total = baseBal.total.add(quantity);
    } else {
      // Pay base currency, receive quote currency
      const baseBal = this.getBalance(baseCurrency);
      baseBal.total = baseBal.total.sub(quantity);

      const quoteBal = this.getBalance(quoteCurrency);
      quoteBal.total = quoteBal.total.add(cost);
      quoteBal.locked = quoteBal.locked.sub(cost);
      if (quoteBal.locked.lt(0)) quoteBal.locked = new Decimal(0);
    }
  }

  toString(): string {
    const parts: string[] = [];
    for (const [, bal] of this.balances) {
      parts.push(bal.toString());
    }
    return parts.join(', ');
  }
}

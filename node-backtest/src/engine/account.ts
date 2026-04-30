import Decimal from 'decimal.js';
import { OrderSide, OrderType } from '../core/enums.js';

// 单币种账户余额
export class AccountBalance {
  public total: Decimal;  // 总余额
  public locked: Decimal; // 冻结金额

  // 初始化币种和初始余额
  constructor(public readonly currency: string, initial: Decimal = new Decimal(0)) {
    this.total = initial;
    this.locked = new Decimal(0);
  }

  // 可用余额 = 总余额 - 冻结金额
  get free(): Decimal {
    return this.total.sub(this.locked);
  }

  // 存入资金
  deposit(amount: Decimal): void {
    this.total = this.total.add(amount);
  }

  // 提取资金，需检查可用余额充足
  withdraw(amount: Decimal): void {
    if (this.free.lt(amount)) {
      throw new Error(`Insufficient ${this.currency} balance: free=${this.free}, need=${amount}`);
    }
    this.total = this.total.sub(amount);
  }

  // 冻结指定金额，需检查可用余额充足
  lock(amount: Decimal): void {
    if (this.free.lt(amount)) {
      throw new Error(`Insufficient free ${this.currency}: free=${this.free}, need=${amount}`);
    }
    this.locked = this.locked.add(amount);
  }

  // 解冻指定金额，冻结金额不低于零
  unlock(amount: Decimal): void {
    this.locked = this.locked.sub(amount);
    if (this.locked.lt(0)) {
      this.locked = new Decimal(0);
    }
  }

  // 格式化输出余额信息
  toString(): string {
    return `${this.total} ${this.currency} (free: ${this.free}, locked: ${this.locked})`;
  }
}

// 现货现金账户，支持多币种
export class CashAccount {
  public balances: Map<string, AccountBalance>;

  // 用初始余额初始化各币种账户
  constructor(initialBalances: Map<string, Decimal>) {
    this.balances = new Map();
    for (const [currency, amount] of initialBalances) {
      this.balances.set(currency, new AccountBalance(currency, amount));
    }
  }

  // 获取币种余额，不存在则自动创建
  getBalance(currency: string): AccountBalance {
    let balance = this.balances.get(currency);
    if (!balance) {
      balance = new AccountBalance(currency);
      this.balances.set(currency, balance);
    }
    return balance;
  }

  // 获取币种可用余额
  getFree(currency: string): Decimal {
    return this.getBalance(currency).free;
  }

  // 为买单冻结计价币资金
  lockForBuy(quoteCurrency: string, cost: Decimal): void {
    this.getBalance(quoteCurrency).lock(cost);
  }

  // 订单取消时解冻剩余资金
  unlockForCancel(quoteCurrency: string, amount: Decimal): void {
    this.getBalance(quoteCurrency).unlock(amount);
  }

  // 执行成交，更新买卖双方的币种余额
  fillOrder(
    side: OrderSide,       // 买卖方向
    type: OrderType,       // 订单类型
    quoteCurrency: string, // 计价币
    baseCurrency: string,  // 基础币
    cost: Decimal,         // 成交金额
    quantity: Decimal,     // 成交数量
  ): void {
    if (side === OrderSide.Buy) {
      // 买单：支付计价币，获得基础币
      const quoteBal = this.getBalance(quoteCurrency);
      quoteBal.locked = quoteBal.locked.sub(cost);
      quoteBal.total = quoteBal.total.sub(cost);

      const baseBal = this.getBalance(baseCurrency);
      baseBal.total = baseBal.total.add(quantity);
    } else {
      // 卖单：支付基础币，获得计价币
      const baseBal = this.getBalance(baseCurrency);
      baseBal.total = baseBal.total.sub(quantity);

      const quoteBal = this.getBalance(quoteCurrency);
      quoteBal.total = quoteBal.total.add(cost);
      quoteBal.locked = quoteBal.locked.sub(cost);
      if (quoteBal.locked.lt(0)) quoteBal.locked = new Decimal(0);
    }
  }

  // 格式化输出所有币种余额
  toString(): string {
    const parts: string[] = [];
    for (const [, bal] of this.balances) {
      parts.push(bal.toString());
    }
    return parts.join(', ');
  }
}

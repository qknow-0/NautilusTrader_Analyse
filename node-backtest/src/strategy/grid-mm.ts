// 网格做市策略 — 对称限价订单网格 + 库存倾斜

import { Strategy } from './strategy.js';
import { Bar, TradeTick } from '../model/data.js';
import { Order } from '../model/order.js';
import { InstrumentId } from '../core/identifiers.js';
import { Price, Quantity } from '../core/types.js';
import { OrderSide, TimeInForce } from '../core/enums.js';
import Decimal from 'decimal.js';

// 网格做市配置接口
export interface GridMMConfig {
  instrumentId: InstrumentId;           // 交易对 ID
  tradeSize?: Quantity | string;        // 每笔交易数量
  gridLevels: number;                   // 网格层数
  gridStepBps: number;                  // 网格间距（基点）
  rethresholdBps: number;               // 最小价格变动触发重新报价（基点）
  skewFactor: number;                   // 每单位净持仓的价格倾斜系数
  maxPosition: Quantity | string;       // 每侧最大持仓量
  expireTimeSecs?: number;              // 订单 GTD 过期时间（秒）
  onCancelResubmit?: boolean;           // 取消后是否重新提交网格
}

export class GridMarketMaker extends Strategy {
  private mmConfig: GridMMConfig;                    // 做市配置
  private instrumentId: InstrumentId;                // 交易对 ID
  private tradeSize: Quantity;                       // 每笔交易数量
  private pricePrecision = 8;                        // 价格精度
  private lastQuotedMid: number | null = null;       // 上次报价的中间价
  private pendingCancels = new Set<string>();        // 等待取消的订单集合

  constructor(id: string, config: GridMMConfig) {
    super(id);
    this.mmConfig = config;
    this.instrumentId = config.instrumentId;
    this.tradeSize = config.tradeSize instanceof Quantity
      ? config.tradeSize
      : Quantity.from(config.tradeSize ?? '0.001');
  }

  protected override onStart(): void {
    super.onStart();
    this.log(`Grid MM started: levels=${this.mmConfig.gridLevels}, step=${this.mmConfig.gridStepBps}bps`);
  }

  protected override onStop(): void {
    super.onStop();
    this.cancelAllOrders(this.instrumentId);         // 取消所有订单
    this.closeAllPositions(this.instrumentId);       // 平掉所有持仓
  }

  // K 线回调
  onBar(bar: Bar): void {
    super.onBar(bar);
    this.processQuote(bar);
  }

  // 成交回调
  onTrade(trade: TradeTick): void {
    this.processTradePrice(Number(trade.price.value));
  }

  // 订单成交回调
  onOrderFilled(order: Order): void {
    this.pendingCancels.delete(order.clientId.value);
    this.log(`Grid fill: ${order.side} ${order.filledQty}`);
  }

  // 订单取消回调
  onOrderCancelled(order: Order): void {
    this.pendingCancels.delete(order.clientId.value);
    if (this.mmConfig.onCancelResubmit) {
      this.lastQuotedMid = null;                     // 重置中间价以触发重新报价
    }
  }

  // 处理报价数据（基于 K 线）
  private processQuote(bar: Bar): void {
    const midF64 = (Number(bar.open.value) + Number(bar.close.value)) / 2;  // 计算中间价
    this.placeGrid(midF64);
  }

  // 处理成交价格
  private processTradePrice(price: number): void {
    this.placeGrid(price);
  }

  // 是否需要重新报价（价格变动未超过阈值则跳过）
  private shouldRequote(mid: number): boolean {
    if (this.lastQuotedMid === null) return true;
    const threshold = this.mmConfig.rethresholdBps / 10_000;
    return Math.abs(mid - this.lastQuotedMid) / this.lastQuotedMid >= threshold;
  }

  // 放置网格订单
  private placeGrid(mid: number): void {
    if (!this.shouldRequote(mid)) return;

    this.log(`Requoting grid: mid=${mid.toFixed(2)}`);

    // 取消已有订单
    this.cancelAllOrders(this.instrumentId);

    // 计算库存倾斜
    const netPosition = this.portfolio.netPosition(this.instrumentId).toNumber();
    const skew = this.mmConfig.skewFactor * netPosition;
    const step = this.mmConfig.gridStepBps / 10_000;
    const maxPos = this.mmConfig.maxPosition instanceof Quantity
      ? this.mmConfig.maxPosition.value.toNumber()
      : Quantity.from(this.mmConfig.maxPosition).value.toNumber();

    // 追踪预期持仓以防止超出限制
    let projectedLong = netPosition;
    let projectedShort = netPosition;
    const orders: [OrderSide, number][] = [];

    for (let level = 1; level <= this.mmConfig.gridLevels; level++) {
      // 买入价：中间价 × (1 - step)^level - 倾斜
      const buyPrice = mid * Math.pow(1 - step, level) - skew;
      // 卖出价：中间价 × (1 + step)^level - 倾斜
      const sellPrice = mid * Math.pow(1 + step, level) - skew;

      // 多头未超限时添加买单
      if (projectedLong < maxPos) {
        orders.push([OrderSide.Buy, buyPrice]);
        projectedLong += this.tradeSize.value.toNumber();
      }

      // 空头未超限时添加卖单
      if (projectedShort > -maxPos) {
        orders.push([OrderSide.Sell, sellPrice]);
        projectedShort -= this.tradeSize.value.toNumber();
      }
    }

    if (orders.length === 0) return;

    // 确定有效期限策略
    const tif = this.mmConfig.expireTimeSecs ? 'GTD' : 'GTC';

    // 提交所有限价订单
    for (const [side, price] of orders) {
      const order = this.orderFactory.limit(
        this.instrumentId,
        side,
        this.tradeSize,
        Price.from(price.toFixed(this.pricePrecision)),
        { timeInForce: tif as TimeInForce },
      );
      this.submitOrder(order!);
    }

    this.lastQuotedMid = mid;  // 记录本次报价的中间价
  }

  protected override onReset(): void {
    super.onReset();
    this.lastQuotedMid = null;
    this.pendingCancels.clear();
  }
}

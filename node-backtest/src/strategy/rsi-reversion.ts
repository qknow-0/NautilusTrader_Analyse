// RSI 均值回归策略 — 超卖买入、超卖出卖出

import { Strategy } from './strategy.js';
import { RSI } from './indicators/rsi.js';
import { Bar } from '../model/data.js';
import { Order } from '../model/order.js';
import { InstrumentId } from '../core/identifiers.js';
import { Price, Quantity } from '../core/types.js';

// RSI 均值回归配置接口
export interface RSIReversionConfig {
  instrumentId: InstrumentId;            // 交易对 ID
  quantity: Quantity | string;           // 交易数量
  rsiPeriod?: number;                    // RSI 周期（默认 14）
  oversoldThreshold?: number;            // 超卖阈值（默认 30，低于此值买入）
  overboughtThreshold?: number;          // 超买阈值（默认 70，高于此值卖出）
  takeProfitPct?: number;                // 止盈比例（默认 2%）
  stopLossPct?: number;                  // 止损比例（默认 1%）
}

export class RSIReversionStrategy extends Strategy {
  private rsiConfig: RSIReversionConfig;    // 回归配置
  private instrumentId: InstrumentId;       // 交易对 ID
  private quantity: Quantity;               // 交易数量
  private rsi: RSI;                         // RSI 指标
  private entryPrice: number | null = null; // 入场价格（用于止盈止损）

  constructor(id: string, config: RSIReversionConfig) {
    super(id);
    this.rsiConfig = config;
    this.instrumentId = config.instrumentId;
    this.quantity = config.quantity instanceof Quantity
      ? config.quantity
      : Quantity.from(config.quantity);
    this.rsi = new RSI(config.rsiPeriod ?? 14);
  }

  protected override onStart(): void {
    super.onStart();
    this.log(`RSI Reversion started: period=${this.rsiConfig.rsiPeriod ?? 14}, OB=${this.rsiConfig.overboughtThreshold ?? 70}, OS=${this.rsiConfig.oversoldThreshold ?? 30}`);
  }

  // K 线回调 — 核心交易逻辑
  onBar(bar: Bar): void {
    super.onBar(bar);

    const close = Number(bar.close.value);
    const rsiValue = this.rsi.update(close);

    if (!this.rsi.isReady) return;  // RSI 尚未就绪，跳过

    const oversold = this.rsiConfig.oversoldThreshold ?? 30;
    const overbought = this.rsiConfig.overboughtThreshold ?? 70;
    const takeProfit = this.rsiConfig.takeProfitPct ?? 0.02;
    const stopLoss = this.rsiConfig.stopLossPct ?? 0.01;

    // 止损检查
    if (this.entryPrice !== null) {
      const pnlPct = (close - this.entryPrice) / this.entryPrice;
      if (pnlPct <= -stopLoss) {
        this.sellMarket(this.instrumentId, this.quantity);
        this.log(`STOP LOSS @ ${close} (PnL: ${(pnlPct * 100).toFixed(2)}%)`);
        this.entryPrice = null;
        return;
      }
      // 止盈检查
      if (pnlPct >= takeProfit) {
        this.sellMarket(this.instrumentId, this.quantity);
        this.log(`TAKE PROFIT @ ${close} (PnL: ${(pnlPct * 100).toFixed(2)}%)`);
        this.entryPrice = null;
        return;
      }
    }

    // RSI 低于超卖阈值 → 买入（均值回归信号）
    if (rsiValue < oversold && this.entryPrice === null) {
      this.buyMarket(this.instrumentId, this.quantity);
      this.entryPrice = close;
      this.log(`OVERSOLD: BUY @ ${close} (RSI=${rsiValue.toFixed(1)})`);
    }
    // RSI 高于超买阈值 → 卖出（平仓）
    else if (rsiValue > overbought && this.entryPrice !== null) {
      this.sellMarket(this.instrumentId, this.quantity);
      this.log(`OVERBOUGHT: SELL @ ${close} (RSI=${rsiValue.toFixed(1)})`);
      this.entryPrice = null;
    }
  }

  // 订单成交回调
  onOrderFilled(order: Order): void {
    this.log(`Filled: ${order.side} qty=${order.filledQty}`);
  }

  protected override onReset(): void {
    super.onReset();
    this.entryPrice = null;
  }
}

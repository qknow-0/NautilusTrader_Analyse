// 引入 decimal.js 高精度计算库
import Decimal from 'decimal.js';
// 引入回测引擎核心模块
import {
  BacktestEngine,   // 回测引擎主类
  InstrumentId,     // 交易对标识符
  Price,            // 价格类型
  Quantity,         // 数量类型
  UnixNanos,        // 纳秒时间戳
  BarAggregation,   // K线聚合方式
  createBar,        // K线工厂函数
  EMACrossStrategy, // EMA 交叉策略
  formatBacktestResult, // 结果格式化
} from '../src/index.js';

// 生成合成 1 分钟 K线数据
function generateBars(
  symbol: string,     // 交易对符号
  venue: string,      // 交易所名称
  startPrice: number, // 起始价格
  numBars: number,    // K线数量
  volatility: number, // 波动率
): import('../src/index.js').Bar[] {
  // 构建交易对标识符
  const instrumentId = InstrumentId.from(`${symbol}.${venue}`);
  const bars: import('../src/index.js').Bar[] = []; // 存储所有K线

  let price = startPrice; // 当前价格（随迭代更新）
  // 使用确定性伪随机数生成器（可复现）
  let seed = 42;
  // 生成 [-1, 1] 范围内的随机数
  function nextRandom(): number {
    seed = (seed * 16807 + 0) % 2147483647; // LCG 线性同余
    return (seed / 2147483647) * 2 - 1; // 映射到 [-1, 1]
  }

  // 回测起始时间
  const startTime = new Date('2024-01-01T00:00:00Z');

  // 逐根生成 K线
  for (let i = 0; i < numBars; i++) {
    const change = nextRandom() * volatility; // 价格变动
    const open = price;                       // 开盘价
    const close = price + change;             // 收盘价
    const high = Math.max(open, close) + Math.abs(nextRandom()) * volatility * 0.5; // 最高价
    const low = Math.min(open, close) - Math.abs(nextRandom()) * volatility * 0.5;  // 最低价
    const volume = 100 + Math.abs(nextRandom()) * 500; // 成交量

    const ts = new Date(startTime.getTime() + i * 60_000); // 每根K线间隔1分钟

    // 创建K线对象并加入数组
    bars.push(
      createBar(
        instrumentId,             // 交易对
        1,                        // 1分钟步长
        BarAggregation.Minute,    // 分钟聚合
        open.toFixed(2),          // 开盘价
        high.toFixed(2),          // 最高价
        low.toFixed(2),           // 最低价
        close.toFixed(2),         // 收盘价
        volume.toFixed(2),        // 成交量
        UnixNanos.fromDate(ts),   // 事件时间
        UnixNanos.fromDate(ts),   // 记录时间
      ),
    );

    price = close; // 下一根K线以上一根收盘价开始
  }

  return bars; // 返回所有K线
}

// 主函数：配置并运行回测
function main() {
  console.log('NautilusTrader-style Node.js Backtest Engine\n');

  // 定义交易对
  const instrumentId = InstrumentId.from('BTC-USDT.BINANCE');

  // 1. 创建回测引擎
  const engine = new BacktestEngine({ traderId: 'TRADER-001' });

  // 2. 添加交易所（配置初始资金）
  engine.addVenue({
    name: 'BINANCE',
    startingBalances: new Map([
      ['USDT', new Decimal(100000)], // 100,000 USDT 起始资金
    ]),
  });

  // 3. 添加交易对
  engine.addInstrument(instrumentId);

  // 4. 生成测试数据（1000 根 1 分钟K线）
  const bars = generateBars('BTC-USDT', 'BINANCE', 50000, 1000, 100);
  engine.addData(bars); // 加载数据到引擎
  console.log(`Loaded ${bars.length} bars`);

  // 5. 添加策略（EMA 9/21 交叉，每次交易 0.1 BTC）
  const strategy = new EMACrossStrategy(
    'EMA-CROSS',              // 策略ID
    instrumentId,             // 交易对
    Quantity.from('0.1'),     // 交易数量
    9,                        // 快速 EMA 周期
    21,                       // 慢速 EMA 周期
  );
  engine.addStrategy(strategy); // 注册策略

  // 6. 运行回测
  console.log('\nRunning backtest...\n');

  // 回测时间范围（跳过前 10 分钟用于 EMA 预热）
  const startTime = UnixNanos.fromDate(new Date('2024-01-01T00:10:00Z'));
  const endTime = UnixNanos.fromDate(new Date('2024-01-01T16:00:00Z'));

  const result = engine.run(startTime, endTime); // 执行回测

  // 7. 打印回测结果
  console.log(formatBacktestResult(result));
}

main(); // 执行主函数

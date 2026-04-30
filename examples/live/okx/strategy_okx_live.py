from decimal import Decimal
from nautilus_trader.trading.strategy import Strategy


class OKXStrategy(Strategy):

    def on_start(self):
        self.log.info("Strategy started")

        # ⚠️ 最新必须带 .OKX
        self.subscribe_bars("BTC-USDT.OKX", "1m")

    # def on_quote(self,quote):
    #     self.log.info(f"{quote}")
    def on_bar(self, bar):
        self.log.info(f"{bar.instrument_id} close={bar.close}")

        # 简单策略：阳线买
        # if bar.close > bar.open:
        #     self.submit_market_order(
        #         instrument_id=bar.instrument_id,
        #         order_side="BUY",
        #         quantity=Decimal("0.001"),
        #     )
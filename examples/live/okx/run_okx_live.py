import os
from pathlib import Path
from dotenv import load_dotenv

from nautilus_trader.cache.config import CacheConfig
from nautilus_trader.common.config import DatabaseConfig, MessageBusConfig

# 加载 .env 文件（优先级：同目录 .env > 项目根目录 .env）
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from nautilus_trader.adapters.okx import OKX
from nautilus_trader.adapters.okx import (
    OKXDataClientConfig,
    OKXExecClientConfig,
)
from nautilus_trader.adapters.okx.factories import (
    OKXLiveDataClientFactory,
    OKXLiveExecClientFactory,
)

from nautilus_trader.config import (
    InstrumentProviderConfig,
    LoggingConfig,
    TradingNodeConfig,
)

from nautilus_trader.live.node import TradingNode

from nautilus_trader.core.nautilus_pyo3 import (
    OKXEnvironment,
    OKXInstrumentType,
    OKXContractType,
)

from strategy_okx_live import OKXStrategy


# 从 .env 读取环境配置，默认 demo
_okx_env = os.getenv("OKX_ENVIRONMENT", "demo").lower()
IS_DEMO = _okx_env in ("demo", "testnet")


def main():

    config = TradingNodeConfig(

        
        # 日志
        logging=LoggingConfig(log_level="INFO"),

           # ===== Cache（存储订单、持仓等快照） =====                                         
        cache=CacheConfig(                                                                  
            # database=DatabaseConfig(                                                        
            #     type="redis",        # Redis 连接                                           
            #     host="127.0.0.1",                                                           
            #     port=6379,                                                                  
            #     password=None,                                                              
            # ),                                                                              
            # 可选：持久化到 PostgreSQL                                                     
            # database=DatabaseConfig(                                                
            #     type="postgres",     # PostgreSQL 连接                                      
            #     host="127.0.0.1",                                                           
            #     port=5432,                                                                  
            #     username="nautilus",                                                        
            #     password="pass",                                                            
            # ),                                                                              
        ),                                                                                  
                                                                                          
        # ===== MessageBus（消息总线持久化） =====                                          
        message_bus=MessageBusConfig(                                                       
            # database=DatabaseConfig(                                                        
            #     type="redis",                                                               
            #     host="127.0.0.1",                                                           
            #     port=6379,                                                                  
            # ),      
            # database=DatabaseConfig(                                                
            #     type="postgres",     # PostgreSQL 连接                                      
            #     host="127.0.0.1",                                                           
            #     port=5432,                                                                  
            #     username="nautilus",                                                        
            #     password="pass",                                                            
            # ),                                                                        
        ),

        # catalogs={
        #     DataCatalogConfig:
        # },


        # ===== 行情 =====
        data_clients={
            OKX: OKXDataClientConfig(
                instrument_provider=InstrumentProviderConfig(load_all=True),
                instrument_types=(OKXInstrumentType.SPOT,),
                contract_types=(OKXContractType.LINEAR,),
                environment=OKXEnvironment.DEMO if IS_DEMO else OKXEnvironment.LIVE,
            ),
        },

        # ===== 交易 =====
        exec_clients={
            OKX: OKXExecClientConfig(
                instrument_provider=InstrumentProviderConfig(load_all=True),
                instrument_types=(OKXInstrumentType.SPOT,),
                contract_types=(OKXContractType.LINEAR,),
                environment=OKXEnvironment.DEMO if IS_DEMO else OKXEnvironment.LIVE,
            ),
        },
    )

    # ===== 创建 node =====
    node = TradingNode(config=config)
    

    # 添加策略
    # node.trader.add_strategy(OKXStrategy())

    # 注册客户端工厂（必须在 build 之前）
    node.add_data_client_factory(OKX, OKXLiveDataClientFactory)
    node.add_exec_client_factory(OKX, OKXLiveExecClientFactory)

    # 构建
    node.build()

    # 运行
    try:
        node.run()
    finally:
        node.dispose()


if __name__ == "__main__":
    # print("API_KEY:"+os.getenv("OKX_API_KEY"))
    main()
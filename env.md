# NautilusTrader 环境变量配置

## 数据路径

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NAUTILUS_PATH` | `/path/to/nautilus/data` | 数据根目录，回测数据 catalog 位于此目录下 |
| `NAUTILUS_DATA_DIR` | `~/Downloads/Data` | 历史行情数据目录 |

## 构建相关

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RUSTUP_TOOLCHAIN` | `stable` | Rust 工具链版本 |
| `BUILD_MODE` | `release` | 构建模式（`release` / `debug`） |
| `PROFILE_MODE` | 空 | 启用性能分析模式 |
| `ANNOTATION_MODE` | 空 | 启用注解模式 |
| `PARALLEL_BUILD` | `true` | 并行编译 |
| `COPY_TO_SOURCE` | `true` | 将构建产物复制到源码目录 |
| `FORCE_STRIP` | `false` | 强制 strip 二进制文件 |
| `PYO3_ONLY` | 空 | 仅构建 PyO3 模块 |
| `DRY_RUN` | 空 | 模拟构建，不实际执行 |
| `HIGH_PRECISION` | `true` | 启用 128 位高精度（16 位小数） |
| `SKIP_RUST_DYLIB_COPY` | 空 | 跳过 Rust 动态库复制 |
| `CARGO_TARGET_DIR` | `./target` | Cargo 产物输出目录 |

## 数据库

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `POSTGRES_HOST` | `localhost` | PostgreSQL 地址 |
| `POSTGRES_PORT` | `5432` | PostgreSQL 端口 |
| `POSTGRES_USERNAME` | `nautilus` | PostgreSQL 用户名 |
| `POSTGRES_PASSWORD` | `pass` | PostgreSQL 密码 |
| `POSTGRES_DATABASE` | `nautilus` | PostgreSQL 数据库名 |
| `USE_POSTGRES_CACHE` | 空 | 是否启用 PostgreSQL 缓存 |

## Docker Compose 数据库

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `POSTGRES_USER` | `nautilus` | Docker 数据库用户名 |
| `POSTGRES_PASSWORD` | `pass` | Docker 数据库密码 |
| `POSTGRES_DB` | `nautilus` | Docker 数据库名 |
| `PGADMIN_DEFAULT_EMAIL` | `admin@mail.com` | pgAdmin 登录邮箱 |
| `PGADMIN_DEFAULT_PASSWORD` | `admin` | pgAdmin 登录密码 |
| `PGADMIN_PORT` | `5051` | pgAdmin Web 端口 |

## OKX 交易所

> 使用前需安装：`uv pip install python-dotenv`

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OKX_API_KEY` | 无 | OKX API Key |
| `OKX_API_SECRET` | 无 | OKX API Secret |
| `OKX_API_PASSPHRASE` | 无 | OKX API Passphrase |
| `OKX_ENVIRONMENT` | `demo` | 运行环境：`demo`（模拟盘）或 `live`（实盘） |

**使用方式：** 在 `examples/live/okx/` 目录下创建 `.env` 文件，或直接在项目根目录 `.env` 中配置。
脚本会自动加载，无需修改代码。不配置 `.env` 时默认走 demo 模式。

## 区块链 / RPC

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RPC_HTTP_URL` | `https://arb1.arbitrum.io/rpc` | HTTP RPC 节点地址 |
| `RPC_WSS_URL` | `wss://arb1.arbitrum.io/ws` | WebSocket RPC 节点地址 |

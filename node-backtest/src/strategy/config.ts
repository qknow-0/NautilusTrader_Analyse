// 策略配置 — 镜像 Rust 的 StrategyConfig

import { StrategyId } from '../core/identifiers.js';
import { OmsType } from '../core/enums.js';

// 策略配置接口
export interface StrategyConfig {
  /** 策略唯一 ID，未提供时自动生成 */
  strategyId?: StrategyId;
  /** 订单 ID 前缀标签 */
  orderIdTag?: string;
  /** 是否使用 UUID 风格的客户端订单 ID */
  useUuidClientOrderIds?: boolean;
  /** 订单管理系统类型 */
  omsType?: OmsType;
  /** 是否记录事件日志 */
  logEvents?: boolean;
  /** 是否记录命令日志 */
  logCommands?: boolean;
  /** 是否自动管理 GTD（Good Till Date）订单过期 */
  manageGtdExpiry?: boolean;
  /** 是否在停止时自动平仓 */
  manageStop?: boolean;
}

// 返回默认策略配置
export function defaultStrategyConfig(): Required<StrategyConfig> {
  return {
    strategyId: StrategyId.from(`STRATEGY-${Date.now()}`),  // 基于时间戳自动生成 ID
    orderIdTag: '001',
    useUuidClientOrderIds: false,
    omsType: OmsType.Hedging,
    logEvents: true,
    logCommands: true,
    manageGtdExpiry: false,
    manageStop: false,
  };
}

// 合并用户配置与默认配置
export function resolveConfig(config?: StrategyConfig): Required<StrategyConfig> {
  const defaults = defaultStrategyConfig();
  return {
    strategyId: config?.strategyId ?? defaults.strategyId,
    orderIdTag: config?.orderIdTag ?? defaults.orderIdTag,
    useUuidClientOrderIds: config?.useUuidClientOrderIds ?? defaults.useUuidClientOrderIds,
    omsType: config?.omsType ?? defaults.omsType,
    logEvents: config?.logEvents ?? defaults.logEvents,
    logCommands: config?.logCommands ?? defaults.logCommands,
    manageGtdExpiry: config?.manageGtdExpiry ?? defaults.manageGtdExpiry,
    manageStop: config?.manageStop ?? defaults.manageStop,
  };
}

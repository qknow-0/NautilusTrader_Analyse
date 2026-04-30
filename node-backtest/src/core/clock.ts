// 时钟 — 为策略提供时间访问和定时器管理

import { UnixNanos } from '../core/types.js';

// 定时器回调函数类型
export type TimerCallback = (name: string, ts: UnixNanos) => void;

// 定时器接口
interface Timer {
  name: string;               // 定时器名称
  intervalNs: bigint;         // 触发间隔（纳秒）
  nextTriggerNs: bigint;      // 下次触发时间（纳秒）
  callback: TimerCallback;    // 触发回调
  stopTimeNs: bigint | null;  // 停止时间（null 表示无限重复）
}

export class Clock {
  private currentTs: UnixNanos;                    // 当前时钟时间
  private timers: Map<string, Timer> = new Map();  // 已注册的定时器

  // 创建时钟，可选指定初始时间
  constructor(now?: UnixNanos) {
    this.currentTs = now ?? UnixNanos.fromMillis(Date.now());
  }

  // 获取当前 UTC 时间
  utcNow(): UnixNanos {
    return this.currentTs;
  }

  // 获取当前时间戳（纳秒）
  timestampNs(): UnixNanos {
    return this.currentTs;
  }

  // 推进时钟（由回测引擎每轮迭代调用），同时触发到期的定时器
  setTimestamp(ts: UnixNanos): void {
    this.currentTs = ts;
    this.fireTimers(ts);
  }

  // 设置重复定时器
  setTimerNs(
    name: string,
    intervalNs: bigint,
    startTimeNs: bigint | null = null,  // 首次触发时间，默认当前时间 + 间隔
    stopTimeNs: bigint | null = null,   // 停止时间，null 表示永不停止
    callback: TimerCallback,
  ): void {
    const firstTrigger = startTimeNs ?? (this.currentTs.value + intervalNs);
    this.timers.set(name, {
      name,
      intervalNs,
      nextTriggerNs: firstTrigger,
      callback,
      stopTimeNs,
    });
  }

  // 设置一次性时间提醒
  setTimeAlertNs(
    name: string,
    alertTimeNs: bigint,
    callback: TimerCallback,
  ): void {
    this.timers.set(name, {
      name,
      intervalNs: 0n,                  // 间隔为 0 表示一次性
      nextTriggerNs: alertTimeNs,
      callback,
      stopTimeNs: alertTimeNs,         // 停止时间 = 触发时间，标记为一次性
    });
  }

  // 取消指定定时器
  cancelTimer(name: string): void {
    this.timers.delete(name);
  }

  // 获取所有定时器名称
  timerNames(): string[] {
    return Array.from(this.timers.keys());
  }

  // 检查定时器是否存在
  hasTimer(name: string): boolean {
    return this.timers.has(name);
  }

  // 触发所有到期的定时器
  private fireTimers(now: UnixNanos): void {
    const toRemove: string[] = [];
    for (const timer of this.timers.values()) {
      if (now.value >= timer.nextTriggerNs) {
        timer.callback(timer.name, now);  // 执行回调
        // 一次性定时器或已过停止时间的定时器需要移除
        if (timer.intervalNs === 0n || now.value >= (timer.stopTimeNs ?? Infinity)) {
          toRemove.push(timer.name);
        } else {
          timer.nextTriggerNs += timer.intervalNs;  // 推进下次触发时间
        }
      }
    }
    for (const name of toRemove) {
      this.timers.delete(name);
    }
  }
}

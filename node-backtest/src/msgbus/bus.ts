/**
 * 带通配符匹配的消息总线（发布/订阅模式）
 *
 * 支持点分层级主题和单级通配符 "*"，例如：
 *   - 订阅 "bar.*" 可匹配 "bar.1s", "bar.1m"
 *   - 订阅 "*" 可匹配任意单级主题
 */

/** 消息处理函数类型 */
type Handler = (data: unknown) => void;

/** 订阅记录 */
interface Subscription {
  /** 主题模式（支持 "*" 通配符） */
  pattern: string;
  /** 回调处理函数 */
  handler: Handler;
  /** 订阅唯一标识，用于退订 */
  id: string;
}

export class MessageBus {
  /** 所有活跃订阅列表 */
  private subscriptions: Subscription[] = [];
  /** 订阅 ID 自增计数器 */
  private idCounter = 0;

  /**
   * 订阅一个主题模式
   *
   * @param pattern 主题模式，支持 "*" 单级通配符
   * @param handler 收到匹配消息时的回调函数
   * @returns 订阅 ID，用于后续退订
   */
  subscribe(pattern: string, handler: Handler): string {
    const id = `sub-${++this.idCounter}`;
    this.subscriptions.push({ pattern, handler, id });
    return id;
  }

  /**
   * 取消订阅
   *
   * @param id 订阅时返回的订阅 ID
   */
  unsubscribe(id: string): void {
    this.subscriptions = this.subscriptions.filter((s) => s.id !== id);
  }

  /**
   * 发布消息到指定主题
   *
   * 遍历所有订阅，将消息投递给主题模式匹配的所有订阅者。
   *
   * @param topic 消息主题
   * @param data 消息内容
   */
  publish(topic: string, data: unknown): void {
    for (const sub of this.subscriptions) {
      if (this.matchPattern(sub.pattern, topic)) {
        sub.handler(data);
      }
    }
  }

  /**
   * 判断主题模式是否匹配实际主题
   *
   * 匹配规则：
   *   - 完全相等即匹配
   *   - 模式为 "*" 匹配任意单级主题
   *   - 点分模式下，每个层级需完全匹配或该层为 "*" 通配符
   *   - 层级数量必须一致
   */
  private matchPattern(pattern: string, topic: string): boolean {
    if (pattern === topic) return true;
    if (pattern === '*') return true;

    const patternParts = pattern.split('.');
    const topicParts = topic.split('.');

    // 层级数不同，无法匹配
    if (patternParts.length !== topicParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      const p = patternParts[i];
      if (p === '*') continue;       // 该层为通配符，跳过
      if (p === topicParts[i]) continue;  // 该层完全匹配
      return false;                   // 不匹配
    }

    return true;
  }
}

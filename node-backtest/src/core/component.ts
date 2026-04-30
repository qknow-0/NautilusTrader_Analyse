// 组件状态机 — 镜像 NautilusTrader Rust 的 Component trait

import { ComponentState, ComponentTrigger } from '../core/enums.js';

/**
 * 组件的有效状态转换表。
 *
 *  PreInitialized → Ready → Starting → Running → Stopping → Stopped
 *                                      ↘ Faulting   ↘ Degrading
 *  Stopped → Resuming → Running
 *  Stopped → Resetting → Ready
 *  Stopped → Disposing → Disposed
 */
// 状态转换矩阵：当前状态 + 触发条件 → 下一状态（null 表示非法转换）
const TRANSITIONS: Record<ComponentState, Record<ComponentTrigger, ComponentState | null>> = {
  [ComponentState.PreInitialized]: {
    [ComponentTrigger.Initialize]: ComponentState.Ready,        // 初始化完成 → Ready
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: null,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Ready]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: ComponentState.Starting,          // 开始启动 → Starting
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: ComponentState.Resetting,         // 重置 → Resetting
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: ComponentState.Disposing,       // 销毁 → Disposing
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: null,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Starting]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: ComponentState.Running,  // 启动完成 → Running
    [ComponentTrigger.Stop]: ComponentState.Stopping,           // 启动中停止 → Stopping
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: ComponentState.Faulting,          // 启动中故障 → Faulting
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Running]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: ComponentState.Stopping,           // 停止 → Stopping
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: ComponentState.Degrading,       // 降级 → Degrading
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: ComponentState.Faulting,          // 故障 → Faulting
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Stopping]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: ComponentState.Stopped,   // 停止完成 → Stopped
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: ComponentState.Faulting,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Stopped]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: ComponentState.Resuming,         // 恢复 → Resuming
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: ComponentState.Resetting,         // 重置 → Resetting
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: ComponentState.Disposing,       // 销毁 → Disposing
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: ComponentState.Faulting,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Resuming]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: ComponentState.Stopping,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: ComponentState.Running, // 恢复完成 → Running
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: ComponentState.Faulting,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Resetting]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: ComponentState.Ready,    // 重置完成 → Ready
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: null,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Disposing]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: ComponentState.Disposed, // 销毁完成 → Disposed
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: null,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Degrading]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: ComponentState.Degraded, // 降级完成 → Degraded
    [ComponentTrigger.Fault]: null,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Degraded]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: ComponentState.Stopping,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: ComponentState.Resuming,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: ComponentState.Faulting,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Faulting]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: null,
    [ComponentTrigger.FaultCompleted]: ComponentState.Faulted,  // 故障完成 → Faulted
  },
  [ComponentState.Faulted]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: null,
    [ComponentTrigger.FaultCompleted]: null,
  },
  [ComponentState.Disposed]: {
    [ComponentTrigger.Initialize]: null,
    [ComponentTrigger.Start]: null,
    [ComponentTrigger.StartCompleted]: null,
    [ComponentTrigger.Stop]: null,
    [ComponentTrigger.StopCompleted]: null,
    [ComponentTrigger.Resume]: null,
    [ComponentTrigger.ResumeCompleted]: null,
    [ComponentTrigger.Reset]: null,
    [ComponentTrigger.ResetCompleted]: null,
    [ComponentTrigger.Dispose]: null,
    [ComponentTrigger.DisposeCompleted]: null,
    [ComponentTrigger.Degrade]: null,
    [ComponentTrigger.DegradeCompleted]: null,
    [ComponentTrigger.Fault]: null,
    [ComponentTrigger.FaultCompleted]: null,
  },
};

// 根据当前状态和触发条件计算下一状态，非法转换会抛出异常
export function transitionState(
  current: ComponentState,   // 当前组件状态
  trigger: ComponentTrigger, // 触发条件
): ComponentState {
  const next = TRANSITIONS[current]?.[trigger];
  if (!next) {
    throw new Error(
      `Invalid state transition: ${current} → ${trigger}`,
    );
  }
  return next;
}

// 检查给定的状态转换是否合法
export function isValidTransition(
  current: ComponentState,   // 当前组件状态
  trigger: ComponentTrigger, // 触发条件
): boolean {
  return !!TRANSITIONS[current]?.[trigger];
}

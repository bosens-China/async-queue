import Scheduler from './scheduler';
import { isFunction, isObjectLink, packing, packingArray } from './utils';
import Event from './event';

export interface Option {
  // 最大请求数
  max: number;
  // 每次请求完成等待时间
  waitTime: number | ((index: number) => number);
  // 每批任务单次等待时间
  waitTaskTime: number | (() => number);
  // 是否抛出错误
  throwError: boolean;
  // 每个任务重试次数
  retryCount: number;
  // 是否为流模式
  flowMode: boolean;
}

interface Change {
  index: number;
  status: 'error' | 'success';
  data: any;
  progress: number;
}
interface MergeValue {
  option: Option;
  tasks: Array<Function>;
  state: 'state' | 'suspend' | 'error' | 'operation' | 'end';
  push(...rest: Array<Function>): void;
  splice(start: number, deleteCount?: number);
  splice(start: number, deleteCount: number, ...rest: Array<Function>);
  suspend(): void;
  operation(): void;
  termination(): void;
  onChange(fn: (value: Change) => { cancel: () => void }): void;
}

interface AsyncQueueValue<T> extends MergeValue, Promise<Array<T>> {}

const asyncQueue = <T = unknown>(task: Array<Function>, option: Partial<Option>): AsyncQueueValue<T> => {
  if (!Array.isArray(task)) {
    throw new Error(`Task must be array!`);
  }
  const {
    max = 1,
    waitTime = 0,
    waitTaskTime = 0,
    throwError = false,
    retryCount = 0,
    flowMode = false,
  } = isObjectLink(option) ? option : {};

  const event = new Event();

  // 将参数细化，防止出现边界情况
  const scheduler = new Scheduler(
    task,
    {
      max: max >= 1 ? max : 1,
      waitTime: isFunction(waitTime) ? waitTime : waitTime >= 0 ? waitTime : 0,
      waitTaskTime: isFunction(waitTaskTime) ? waitTaskTime : waitTaskTime >= 0 ? waitTaskTime : 0,
      throwError,
      retryCount: retryCount >= 0 ? retryCount : 0,
      flowMode,
    },
    event,
  );

  const mergeValue: MergeValue = {
    onChange(fn) {
      event.addListener(fn);
      return {
        cancen: () => event.removeListener(fn),
      };
    },
    push: scheduler.push.bind(scheduler),
    splice: scheduler.splice.bind(scheduler),
    suspend: scheduler.suspend.bind(scheduler),
    operation: scheduler.operation.bind(scheduler),
    termination: scheduler.termination.bind(scheduler),
    get state() {
      return scheduler.state;
    },
    get tasks() {
      return scheduler.tasks;
    },
    get option() {
      return scheduler.option;
    },
  };
  const pro = !task.length ? Promise.resolve([]) : new Promise(scheduler.promiseExecuter.bind(scheduler));
  return Object.assign(pro, mergeValue) as AsyncQueueValue<T>;
};

export { asyncQueue, packing, packingArray };

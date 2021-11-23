import Scheduler from './scheduler';
import { isFunction, isObjectLink, assign } from './utils';
import Event from './event';
import { MergeValue, Option } from './type';

interface AsyncQueueValue<T> extends MergeValue, Promise<Array<T>> {}

const asyncQueue = <T = unknown>(tasks: Array<Function>, option?: Partial<Option>): AsyncQueueValue<T> => {
  if (!Array.isArray(tasks)) {
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
    tasks,
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
    addListener(fn) {
      event.addListener(fn);
      return {
        cancen: () => event.removeListener(fn),
      };
    },
    removeListener: event.removeListener.bind(event),
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
  const pro = !tasks.length ? Promise.resolve([]) : new Promise(scheduler.promiseExecuter.bind(scheduler));
  return assign(pro, mergeValue) as AsyncQueueValue<T>;
};

export { asyncQueue };

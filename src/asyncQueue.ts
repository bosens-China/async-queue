import { Scheduler } from './scheduler';
import type { Change, Options } from './scheduler';
import { isFunction } from './utils';

export type Fn = (...rest: any[]) => any;

const defaults: Options = {
  max: 2,
  waitTime: 0,
  waitTaskTime: 0,
  throwError: true,
  retryCount: 0,
  flowMode: true,
};

class AsyncQueue<T extends Fn> extends Scheduler {
  public result: Promise<Array<Awaited<ReturnType<T>>>>;
  constructor(tasks: Array<T>, options?: Partial<Options>) {
    const o = {
      ...defaults,
      ...options,
    };
    super(tasks, o);
    // 完成赋值
    const pro = (!tasks.length ? Promise.resolve([]) : new Promise(this.package.bind(this))) as Promise<any>;
    this.result = pro;
  }

  /**
   * 添加监听器
   *
   * @param {(values: Change<typeof this.result>) => void} fn
   */
  addListener(fn: (values: Change<typeof this.result>) => void) {
    this.event.addListener(fn);
    return this;
  }

  /**
   * 删除监听器，注意程序完成会自动销毁
   *
   * @param {Fn} [fn]
   */
  removeListener(fn?: Fn) {
    if (fn) {
      this.event.removeListener(fn);
    } else {
      this.event.removeListener();
    }
    return this;
  }
}

export type Encapsulation<U extends Fn, T extends AsyncQueue<U>> = Omit<T, 'result'>;

export interface AsyncQueueFn {
  /**
   * 创建管理队列方法
   *
   * @template T
   * @param {Array<T>} tasks
   * @param {Partial<Options>} [options]
   */
  <T extends Fn>(tasks: Array<T>, options?: Partial<Options>): Encapsulation<
    T,
    AsyncQueue<T> & Promise<Array<Awaited<ReturnType<T>>>>
  >;

  /**
   * 全局配置项，会影响 asyncQueueSingle
   *
   * @type {Options}
   * @memberof AsyncQueueFn
   */
  defaults: Options;
}

export const asyncQueue: AsyncQueueFn = (tasks, options) => {
  if (!Array.isArray(tasks)) {
    throw new Error(`Task must be array!`);
  }
  if (tasks.find((f) => !isFunction(f))) {
    throw new Error(`Children of tasks must be functions!`);
  }
  const child = new AsyncQueue([...tasks], options);
  /*
   * 代理 Promise 相关属性，因为这里要达到一个效果，可以.then 调用以及在后面调用属性和方法
   */
  const proxy = new Proxy(child, {
    get(target, propKey, receiver) {
      if (propKey in Promise.prototype) {
        const value = Reflect.get(target.result, propKey, receiver);

        if (!isFunction(value)) {
          return value;
        }
        return value.bind(target.result);
      }

      const value = Reflect.get(target, propKey, receiver);
      return value;
    },
  });

  return proxy as any;
};
asyncQueue.defaults = defaults;

export type SingleOptions = Pick<Options, 'throwError' | 'retryCount'>;

/**
 * asyncQueue 封装执行单个任务
 *
 * @template T
 * @param {T} task
 * @param {Partial<SingleOptions>} [options]
 */
export const asyncQueueSingle = <T extends Fn>(task: T, options?: Partial<SingleOptions>) => {
  const list = [task];
  return asyncQueue(list, options).then((data) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return data[0]!;
  });
};

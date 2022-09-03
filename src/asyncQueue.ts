import Scheduler from './scheduler';
import Event from './event';
import { isFunction } from './utils';

export type Fn = (...rest: any[]) => any;

const defaults: Options = {
  max: 2,
  waitTime: 0,
  waitTaskTime: 0,
  throwError: false,
  retryCount: 0,
  flowMode: false,
};

export interface Options extends SingleOptions {
  /**
   * 最大请求数
   *
   * @type {number}
   * @memberof Option
   */
  max: number;

  /**
   * 每次请求完成后等待时间
   *
   * @memberof Option
   */
  waitTime: number | ((index: number) => number);

  /**
   * 每批任务结束后等待时间
   *
   * 注意在flowMode模式下不起作用
   *
   * @memberof Option
   */
  waitTaskTime: number | (() => number);

  /**
   * 是否为流模式，默认为并发模式
   *
   * @type {boolean}
   * @memberof Option
   */
  flowMode: boolean;
}

class AsyncQueue<T extends Fn> extends Scheduler {
  readonly result: Promise<Array<Awaited<ReturnType<T>>>>;
  public defaults: Options;

  constructor(tasks: Array<T>, options?: Partial<Options>) {
    const o = {
      ...defaults,
      ...options,
    };
    const event = new Event();
    super(tasks, o, event);
    this.defaults = defaults;
    // 完成赋值
    const pro = (!tasks.length ? Promise.resolve([]) : new Promise(this.promiseExecuter.bind(this))) as Promise<any>;
    this.result = pro;
  }

  /**
   * 返回当前这项任务的状态
   *
   * @readonly
   * @memberof AsyncQueue
   */
  get state() {
    return this._state;
  }

  /**
   * 返回当前的任务总数
   *
   * @readonly
   * @memberof AsyncQueue
   */
  get tasks() {
    return this._tasks;
  }

  /**
   * 返回当前的options配置信息
   *
   * @readonly
   * @memberof AsyncQueue
   */
  get options() {
    return this._options;
  }

  /**
   * 添加一个事件绑定器
   *
   * @param {Fn} fn
   * @return {*}
   * @memberof AsyncQueue
   */
  addListener(fn: Fn) {
    this.event.addListener(fn);
    return this;
  }

  /**
   * 删除事件绑定器，接收参数fn，如果不传递默认删除全部
   *
   * @param {Fn} [fn]
   * @return {*}
   * @memberof AsyncQueue
   */
  removeListener(fn?: Fn) {
    if (fn) {
      this.event.removeListener(fn);
    } else {
      this.event.destroy();
    }
    return this;
  }
}

export interface AsyncQueueFn {
  <T extends Fn>(tasks: Array<T>, options?: Partial<Options>): AsyncQueue<T> & Promise<Array<Awaited<ReturnType<T>>>>;
  defaults: Options;
}

/**
 * 创建一个任务队列，注意接收到的每个tasks都应当为函数
 *
 * @template T
 * @param {Array<T>} tasks
 * @param {Partial<Options>} [options]
 * @return {*}
 */
export const asyncQueue: AsyncQueueFn = (tasks, options) => {
  if (!Array.isArray(tasks)) {
    throw new Error(`Task must be array!`);
  }
  if (tasks.find((f) => !isFunction(f))) {
    throw new Error(`Children of tasks must be functions!`);
  }
  const child = new AsyncQueue(tasks, options);
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

export interface SingleOptions {
  /**
   * 是否抛出错误，默认为false，在发生错误的时候将错误值记录下来
   *
   * @type {boolean}
   * @memberof Option
   */
  throwError: boolean;

  /**
   *  每个任务重试次数
   *
   * @type {number}
   * @memberof Option
   */
  retryCount: number;
}

/**
 * asyncQueue 函数的单任务用法
 *
 * @template T
 * @param {T} task
 * @param {Partial<SingleOptions>} [options]
 * @return {*}
 */
export const asyncQueueSingle = <T extends Fn>(task: T, options?: Partial<SingleOptions>) => {
  const list = [task];
  return asyncQueue(list, options).then((data) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return data[0]!;
  });
};

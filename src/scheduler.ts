/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Event, Fn } from './event';
import { isFunction, sleep } from './utils';

type Resolve = (values: unknown) => void;
type Reject = (values: unknown) => void;

export interface ChangeError {
  /**
   * 当前任务状态
   *
   * @type {'error'}
   * @memberof ChangeError
   */
  status: 'error';

  /**
   * 当前任务的返回结果
   *
   * @type {Error}
   * @memberof ChangeError
   */
  data: Error;
}

export interface ChangeData<T> {
  /**
   * 当前任务状态
   *
   * @type {'success'}
   * @memberof ChangeData
   */
  status: 'success';

  /**
   * 当前任务的返回结果
   *
   * @type {T}
   * @memberof ChangeData
   */
  data: T;
}

export type Change<T = any> = {
  /**
   * 当前任务索引
   *
   * @type {number}
   */
  index: number;

  /**
   * 进度
   *
   * @type {number}
   */
  progress: number;

  /**
   * 任务总数
   *
   * @type {number}
   */
  total: number;
} & (ChangeError | ChangeData<T>);

export interface Options {
  /**
   * 最多处理任务数
   *
   * @type {number}
   * @memberof Options
   */
  max: number;
  /**
   * 每次任务等待时间
   *
   * @memberof Options
   */
  waitTime: number | ((index?: number) => number);
  /**
   * 每批次任务结束等待时间，注意 flowMode模式下无效
   *
   * @memberof Options
   */
  waitTaskTime: number | (() => number);
  /**
   * 发生错误是否立即结束，抛出错误
   *
   * @type {boolean}
   * @memberof Options
   */
  throwError: boolean;
  /**
   * 重试次数
   *
   * @type {number}
   * @memberof Options
   */
  retryCount: number;
  /**
   * 是否为流模式
   *
   * @type {boolean}
   * @memberof Options
   */
  flowMode: boolean;
}

enum States {
  toStart = 1,
  start,
  end,
  error,
}

interface Tasks {
  // 状态
  state: States;
  // 索引
  index: number;
  // 重试次数
  retry: number;
  // 结果
  result: any;
  fn: Fn<Promise<any>>;
}

export class Scheduler {
  private resolve!: Resolve;
  private reject!: Reject;
  private queues: Array<Tasks> = [];
  private options: Options;
  private tasks: Array<Tasks>;
  protected event: Event;

  constructor(tasks: Array<Fn>, options: Options) {
    this.options = options;
    this.tasks = tasks.map((fn, index) => {
      return {
        fn,
        state: States.toStart,
        index,
        result: undefined,
        retry: 0,
      };
    });
    this.event = new Event();
  }

  private clear() {
    this.tasks = [];
    this.queues = [];
    this.event.removeListener();
  }

  // new Promise(this.package) 这样调用
  protected package(resolve: Resolve, reject: Reject) {
    this.resolve = (data) => {
      this.clear();
      resolve(data);
    };
    this.reject = (e) => {
      this.clear();
      reject(e);
    };
    this.run();
  }
  // 执行函数
  private async run() {
    const current = this.executableTasks();
    // 提前结束
    if (!current.length) {
      return this.next();
    }
    // 如果并发模式
    const { flowMode, waitTime } = this.options;
    if (!flowMode) {
      await sleep(isFunction(waitTime) ? waitTime() : waitTime);
      this.queues.push(...current.map((fn) => this.retry(fn)));
      return this.next();
    }
    this.queues.push(...current.map((fn) => this.retry(this.wait(fn))));
    this.next();
  }
  // 已完成任务
  private completed() {
    return this.tasks.filter((f) => {
      return [States.end, States.error].includes(f.state);
    });
  }

  // 是否结束
  private isEnd() {
    return !this.tasks.length || this.completed().length === this.tasks.length;
  }

  private async next() {
    const { flowMode, waitTaskTime, throwError } = this.options;
    // 验证是否结束
    if (this.isEnd()) {
      return this.resolve(this.tasks.map((f) => f.result));
    }

    const implement = (task: Tasks, index?: number) => {
      const { fn } = task;
      return fn()
        .then((data) => {
          task.result = data;
          task.state = States.end;
        })
        .catch((e: Error) => {
          if (throwError) {
            return this.reject(e);
          }
          // 正常记录，不过值当成error
          task.result = e;
          task.state = States.error;
        })
        .finally(() => {
          this.event.emit<Change>({
            index: task.index,
            status: task.state === States.error ? 'error' : 'success',
            data: task.result,
            total: this.tasks.length,
            progress: this.completed().length / this.tasks.length,
          });
          if (flowMode) {
            this.queues.splice(index!, 1);
            this.run();
          }
        });
    };

    if (!flowMode) {
      await Promise.all(this.queues.map((f) => implement(f)));
      // 最后一批任务肯定不需要继续执行
      if (!this.isEnd()) {
        await sleep(isFunction(waitTaskTime) ? waitTaskTime() : waitTaskTime);
      }
      this.queues = [];
      this.run();
      return;
    }
    // 流模式下，注意过滤已经存在的任务

    const executedQueues = this.queues.filter((f) => f.state === States.toStart);
    executedQueues.forEach((f) => {
      f.state = States.start;
    });

    await Promise.all(executedQueues.map((f, index) => implement(f, index)));
  }

  // 流模式下，包裹函数执行每批次前的等待
  private wait(task: Tasks) {
    const { index, fn } = task;
    task.fn = () => {
      const { waitTime } = this.options;
      return sleep(isFunction(waitTime) ? waitTime(index) : waitTime).then(() => {
        return fn();
      });
    };
    return task;
  }

  // 获取可执行的任务数
  private executableTasks() {
    const { max } = this.options;
    // 可取的数量
    const surplus = max - this.queues.length;
    return this.tasks.filter((f) => f.state === States.toStart).slice(0, surplus);
  }

  // 包裹函数，让其成为可以自动重试的函数
  private retry(task: Tasks) {
    const { fn } = task;
    task.fn = () => {
      return Promise.resolve(fn()).catch((e) => {
        const err = e instanceof Error ? e : new Error(e);
        const count = task.retry++;
        const { retryCount } = this.options;
        if (count >= retryCount) {
          return Promise.reject(err);
        }
        return this.retry(task).fn();
      });
    };
    return task;
  }
}

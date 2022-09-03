import type { Fn } from './asyncQueue';
import type { Options } from './asyncQueue';
import Event from './event';
import { isFunction, wait } from './utils';

export interface Change {
  /**
   * 当前索引
   *
   * @type {number}
   * @memberof Change
   */
  index: number;

  /**
   * 完成状态
   *
   * @type {('error' | 'success')}
   * @memberof Change
   */
  status: 'error' | 'success';

  /**
   * 每次任务结束的数据值
   *
   * @type {*}
   * @memberof Change
   */
  data: any | Error;

  /**
   * 当前完成进度
   *
   * @type {number}
   * @memberof Change
   */
  progress: number;

  /**
   * 总数
   *
   * @type {number}
   * @memberof Change
   */
  total: number;
}

enum executionStatus {
  'start',
  'end',
  'remove',
}

class Scheduler {
  protected _options: Options;
  protected _tasks: Array<Fn>;
  protected _state: 'start' | 'suspend' | 'operation' | 'end' | 'error' = 'start';
  // 重试的次数，用WeakMap是为了防止出现垃圾回收问题
  private retryMap: WeakMap<Fn, number> = new WeakMap();
  protected event: Event;
  // 队列，根据此参数控制max的值不要超出边界
  private queue: Array<Fn> = [];
  private err: Error | null = null;

  private resolveFn!: (value: unknown) => void;
  private rejectFn!: (reason?: any) => void;

  /*
   * 之所以采用Symbol是为了执行一些副作用代码而防止出现冲突
   */
  // 执行状态
  private executedSymbol = Symbol('executed');
  // 执行结果
  private resultSymbol = Symbol('result');

  constructor(tasks: Array<Fn>, option: Options, event: Event) {
    this._options = option;
    // 参数校验，必须接收function
    this._tasks = tasks;
    this.event = event;
  }

  /**
   * 添加任务
   *
   * @param {...Array<Fn>} rest
   * @return {*}
   * @memberof Scheduler
   */
  push(...rest: Array<Fn>) {
    this.splice(this._tasks.length, 0, ...rest);
    return this;
  }

  /**
   * 跟 array split 方法一致
   *
   * @param {number} start
   * @param {number} deleteCount
   * @param {...Array<Fn>} rest
   * @return {*}  {this}
   * @memberof Scheduler
   */
  splice(start: number, deleteCount: number, ...rest: Array<Fn>): this;
  splice(start: number, deleteCount?: number): this;
  splice(start: number, deleteCount: number, ...rest: Array<Fn>): this {
    // 如果结束或者发生错误就不继续执行
    if (['end', 'error'].includes(this._state)) {
      return this;
    }

    // 添加的如果不是函数直接抛出错误
    if (!rest.every((f) => isFunction(f))) {
      throw new Error(`Subtask must be a function!`);
    }
    this._tasks.splice(start, deleteCount, ...rest);
    /*
     * 当数组元素发生了改变，要刷新一下队列元素
     * 对比taks和quequ的元素，不符合的则删除
     * 同时将fn打上remove的标签，通知后续不再处理
     */

    this.queue
      .filter((f, index) => {
        if (!this._tasks.includes(f)) {
          return this.queue.splice(index, 1);
        }
        return false;
      })
      .forEach((fn) => {
        fn[this.executedSymbol] = executionStatus.remove;
      });

    this.run();
    return this;
  }

  /**
   * 暂停执行
   *
   * @return {*}
   * @memberof Scheduler
   */
  suspend() {
    if (this._state !== 'operation') {
      return this;
    }
    this._state = 'suspend';
    return this;
  }

  /**
   * 恢复执行
   *
   * @return {*}
   * @memberof Scheduler
   */
  operation() {
    if (this._state !== 'suspend') {
      return this;
    }
    this._state = 'operation';
    this.run();
    return this;
  }

  // 获取任务列表
  private getTaskList(status?: executionStatus) {
    const { executedSymbol } = this;
    const unexecuted = this._tasks.filter((fn) => {
      return fn[executedSymbol] === status;
    });
    return unexecuted;
  }

  // 执行器
  private run() {
    const { _tasks: tasks, _options: options, executedSymbol, _state: state } = this;
    if (state !== 'operation') {
      return;
    }
    // 获取还未开始的任务
    const unexecuted = this.getTaskList();
    // 如果是flowMode为true下需要减去正在队列的值
    const max = options.max - this.queue.length;
    for (let i = 0; i < max; i++) {
      const value = unexecuted[i];
      // 注意可能存在空值的情况，例如tasks还有1个，max为2，这样取值就会取到空
      if (!value) {
        continue;
      }
      // 这里可能改变tasks数组，利用引用传递
      if (!isFunction(value)) {
        throw new Error(`Error, not a function, index is ${i}`);
      }
      value[executedSymbol] = executionStatus.start;
      // 取当前的下标值
      const index = tasks.indexOf(value);
      const retryFn = this.asyncRetry(value, index);
      this.queue.push(retryFn);
      this.actuator(value, retryFn, index);
    }
  }

  protected promiseExecuter(resolve: (value: unknown) => void, reject: (reason?: any) => void) {
    // 将函数包裹一下，待返回promise状态的时候进行副作用的清理
    this.resolveFn = (value) => {
      this._state = 'end';
      this.clear();
      resolve(value);
    };
    this.rejectFn = (reason) => {
      this._state = 'error';
      this.clear();
      reject(reason);
    };
    this._state = 'operation';
    this.run();
  }

  /*
   * 给定函数，将其转化为重试函数
   */
  private asyncRetry(fn: Fn, index: number) {
    const { retryCount } = this._options;
    if (!retryCount) {
      return fn;
    }
    return () => {
      return new Promise((resolve, reject) => {
        Promise.resolve(fn())
          .then(resolve)
          .catch((err) => {
            const count = this.retryMap.get(fn) || 0;
            if (count >= retryCount) {
              reject(err);
              return;
            }
            this.retryMap.set(fn, count + 1);
            // 重试任务也要受waitTime影响
            const { waitTime } = this._options;

            wait(isFunction(waitTime) ? waitTime(index) : waitTime).then(() => {
              // 继续执行，利用promise特性
              resolve(this.asyncRetry(fn, index)());
            });
          });
      });
    };
  }

  // 返回进度
  private progress() {
    const executed = this.getTaskList(executionStatus.end);
    return executed.length / this._tasks.length;
  }

  /**
   * 因为取值根据symbol来的，但是这个是个副作用的代码，在reject或者resolve的时候进行清理
   */
  private cleaningUpTags(fn: Fn) {
    const { resultSymbol, executedSymbol } = this;
    Reflect.deleteProperty(fn, resultSymbol);
    Reflect.deleteProperty(fn, executedSymbol);
  }

  /**
   * 每次执行的task都会经过这里，做中转处理
   */
  private actuator(fn: Fn, retryFn: Fn, index: number) {
    const { executedSymbol, resultSymbol } = this;

    Promise.resolve(retryFn())
      .then((data) => {
        if (fn[executedSymbol] === executionStatus.remove) {
          return;
        }
        fn[executedSymbol] = executionStatus.end;
        fn[resultSymbol] = data;
      })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(`${err}`);
        fn[resultSymbol] = e;
        // 如果抛出错误
        if (this._options.throwError) {
          // 如果暂停状态，不要直接reject，而是等待恢复执行再抛出
          if (this._state === 'suspend') {
            this.err = e;
            return;
          }
          this.rejectFn(e);
          return;
        }
        fn[executedSymbol] = executionStatus.end;
      })
      .finally(() => {
        if (fn[executedSymbol] === executionStatus.remove) {
          this.cleaningUpTags(fn);
          return;
        }

        this.event.emit<Change>({
          index,
          status: fn[resultSymbol] instanceof Error ? 'error' : 'success',
          data: fn[resultSymbol],
          progress: this.progress(),
          total: this._tasks.length,
        });

        // 删除queuq任务
        const subscript = this.queue.indexOf(retryFn);
        if (subscript > -1) {
          this.queue.splice(subscript, 1);
        }
        this.next(index);
      });
  }

  private isEnd() {
    const { resultSymbol } = this;
    const finish = this.getTaskList(executionStatus.end).length === this._tasks.length;

    if (finish) {
      if (this.err) {
        this.rejectFn(this.err);
        return;
      }
      const result = this._tasks.map((fn) => fn[resultSymbol]);

      this.resolveFn(result);
    }
    return finish;
  }

  private async next(index: number) {
    // 如果不符合条件返回
    if (this._state !== 'operation' || this.err || this.isEnd()) {
      return;
    }
    // 等待单次任务间隔
    const { waitTime } = this._options;
    await wait(isFunction(waitTime) ? waitTime(index) : waitTime);
    if (this._options.flowMode) {
      this.run();
      return;
    }
    // 批次任务间隔
    if (!this.queue.length) {
      const { waitTaskTime } = this._options;
      await wait(isFunction(waitTaskTime) ? waitTaskTime() : waitTaskTime);
      this.run();
    }
  }

  /**
   * 终止当前任务
   *
   * @return {*}
   * @memberof Scheduler
   */
  termination() {
    if (!['suspend', 'operation'].includes(this._state)) {
      return this;
    }
    if (this.err) {
      this.rejectFn(this.err);
      return this;
    }
    const executed = this.getTaskList(executionStatus.end).map((fn) => fn[this.resultSymbol]);
    this.resolveFn(executed);
    return this;
  }

  /*
   * 做一些回收，任务全部完成执行
   */
  private async clear() {
    await Promise.resolve();
    this._tasks.forEach((fn) => this.cleaningUpTags(fn));
    this.event.destroy();
    this._tasks = [];
  }
}

export default Scheduler;

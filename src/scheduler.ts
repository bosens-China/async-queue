import { Change, Option } from './type';
import Event from './event';
import { isFunction, wait } from './utils';

enum executionStatus {
  'start',
  'end',
}

class Scheduler {
  option: Option;
  tasks: Array<Function>;
  state: 'start' | 'suspend' | 'operation' | 'end' | 'error' = 'start';
  // 重试的次数，用WeakMap是为了防止出现垃圾回收问题
  retryMap: WeakMap<Function, number> = new WeakMap();
  event: Event;
  // 队列，根据此参数控制max的值不要超出边界
  queue: Array<Function> = [];
  err: Error | null = null;

  resolveFn!: (value: unknown) => void;
  rejectFn!: (reason?: any) => void;

  /*
   * 之所以采用Symbol是为了执行一些副作用代码而防止出现冲突
   */
  // 执行状态
  executedSymbol = Symbol('executed');
  // 执行结果
  resultSymbol = Symbol('result');

  constructor(tasks: Array<Function>, option: Option, event: Event) {
    this.option = option;
    // 参数校验，必须接收function
    this.tasks = tasks.map((fn) => {
      if (!isFunction(fn)) {
        throw new Error(`tasks must be a function!`);
      }
      return fn;
    });
    this.event = event;
  }

  push(...rest: Array<Function>) {
    this.splice(this.tasks.length, 0, ...rest);
  }

  /* eslint-disable no-dupe-class-members */
  splice(start: number, deleteCount: number, ...rest: Array<Function>);
  splice(start: number, deleteCount?: number);
  splice(start: number, deleteCount: number, ...rest: Array<Function>) {
    // 如果结束或者发生错误就不继续执行
    if (['end', 'error'].includes(this.state)) {
      return;
    }
    // 添加的如果不是函数直接抛出错误
    if (Array.isArray(rest)) {
      rest.forEach((fn) => {
        if (!isFunction(fn)) {
          throw new Error(`Subtask must be a function!`);
        }
      });
    }
    this.tasks.splice(start, deleteCount, ...rest);
  }

  // 暂停
  suspend() {
    if (this.state !== 'operation') {
      return;
    }
    this.state = 'suspend';
  }

  // 恢复执行
  operation() {
    if (this.state !== 'suspend') {
      return;
    }
    this.state = 'operation';
    this.run();
  }

  // 获取任务列表
  getTaskList(status?: executionStatus) {
    const { executedSymbol, state } = this;
    /*
     * 每次run的时候都会调用
     * 且执行resove和reject都会清理掉executedSymbol属性，可能导致重复运行
     * 所以判断状态，不对直接return
     */
    if (state !== 'operation') {
      return [];
    }
    const unexecuted = this.tasks.filter((fn) => {
      return fn[executedSymbol] === status;
    });
    return unexecuted;
  }

  // 执行器
  run() {
    const { tasks, option, executedSymbol } = this;
    // 获取还未开始的任务
    const unexecuted = this.getTaskList();
    // 如果是flowMode为true下需要减去正在队列的值
    const max = option.max - this.queue.length;

    for (let i = 0; i < max; i++) {
      const value = unexecuted[i];
      // 注意可能存在空值的情况，例如tasks还有1个，max为2，这样取值就会取到空
      if (!isFunction(value)) {
        continue;
      }
      value[executedSymbol] = executionStatus.start;
      // 取当前的下标值
      const index = tasks.indexOf(value);
      const retryFn = this.asyncRetry(value, index);
      this.queue.push(retryFn);
      this.actuator(value, retryFn, index);
    }
  }

  promiseExecuter(resolve: (value: unknown) => void, reject: (reason?: any) => void) {
    // 将函数包裹一下，待返回promise状态的时候进行副作用的清理
    this.resolveFn = (value) => {
      this.state = 'end';
      this.clear();
      resolve(value);
    };
    this.rejectFn = (reason) => {
      this.state = 'error';
      this.clear();
      reject(reason);
    };
    this.state = 'operation';
    this.run();
  }

  /*
   * 给定函数，将其转化为重试函数
   */
  asyncRetry(fn: Function, index: number) {
    const { retryCount } = this.option;
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
            const { waitTime } = this.option;
            wait(isFunction(waitTime) ? waitTime(index) : waitTime).then(() => {
              // 继续执行，利用promise特性
              resolve(this.asyncRetry(fn, index)());
            });
          });
      });
    };
  }

  // 返回进度
  progress() {
    const executed = this.getTaskList(executionStatus.end);
    return executed.length / this.tasks.length;
  }

  /**
   * 每次执行的task都会经过这里，做中转处理
   */
  actuator(fn: Function, retryFn: Function, index: number) {
    const { executedSymbol, resultSymbol } = this;
    Promise.resolve(retryFn())
      .then((data) => {
        fn[executedSymbol] = executionStatus.end;
        fn[resultSymbol] = data;
      })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(`${err}`);
        fn[resultSymbol] = e;
        // 如果抛出错误
        if (this.option.throwError) {
          // 如果暂停状态，不要直接reject，而是等待恢复执行再抛出
          if (this.state === 'suspend') {
            this.err = e;
            return;
          }
          this.rejectFn(e);
          return;
        }
        fn[executedSymbol] = executionStatus.end;
      })
      .finally(() => {
        this.event.emit<Change>({
          index,
          status: fn[resultSymbol] instanceof Error ? 'error' : 'success',
          data: fn[resultSymbol],
          progress: this.progress(),
          total: this.tasks.length,
        });

        // 删除queuq任务
        const subscript = this.queue.indexOf(retryFn);
        if (subscript > -1) {
          this.queue.splice(subscript, 1);
        }
        this.next(index);
      });
  }

  isEnd() {
    const { resultSymbol } = this;
    const finish = this.getTaskList(executionStatus.end).length === this.tasks.length;
    if (finish) {
      if (this.err) {
        this.rejectFn(this.err);
        return;
      }
      const result = this.tasks.map((fn) => fn[resultSymbol]);
      this.resolveFn(result);
    }
    return finish;
  }

  async next(index: number) {
    // 如果不符合条件返回
    if (this.state !== 'operation' || this.err || this.isEnd()) {
      return;
    }
    // 等待单次任务间隔
    const { waitTime } = this.option;
    await wait(isFunction(waitTime) ? waitTime(index) : waitTime);
    if (this.option.flowMode) {
      this.run();
      return;
    }
    // 批次任务间隔
    if (!this.queue.length) {
      const { waitTaskTime } = this.option;
      await wait(isFunction(waitTaskTime) ? waitTaskTime() : waitTaskTime);
      this.run();
    }
  }

  /**
   * 终止任务，不再后续执行
   */
  termination() {
    if (!['suspend', 'operation'].includes(this.state)) {
      return;
    }
    if (this.err) {
      this.rejectFn(this.err);
      return;
    }
    const executed = this.getTaskList(executionStatus.end).map((fn) => fn[this.resultSymbol]);
    this.resolveFn(executed);
  }

  /**
   * 因为取值根据symbol来的，但是这个是个副作用的代码，在reject或者resolve的时候进行清理
   */
  clear() {
    const { tasks, resultSymbol, executedSymbol } = this;
    tasks.forEach((fn) => {
      Reflect.deleteProperty(fn, resultSymbol);
      Reflect.deleteProperty(fn, executedSymbol);
    });
    /*
     * 做一些回收
     */
    this.event.destroy();
    this.tasks = [];
  }
}

export default Scheduler;

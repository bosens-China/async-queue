import { Option } from './main';
import Event from './event';
import { isFunction, wait } from './utils';

enum executionStatus {
  'start',
  'end',
}

class Scheduler {
  option: Option;
  tasks: Array<Function>;
  state: 'state' | 'suspend' | 'error' | 'operation' | 'end' = 'state';
  retryMap: WeakMap<Function, number> = new WeakMap();
  event: Event;
  queue: Array<Function> = [];
  err: Error | null = null;

  resolveFn!: (value: unknown) => void;
  rejectFn!: (reason?: any) => void;

  // 判断当前队列有没有被执行的依据
  executedSymbol = Symbol('executed');
  resultSymbol = Symbol('result');

  constructor(tasks: Array<Function>, option: Option, event: Event) {
    this.option = option;
    this.tasks = tasks.map((fn) => {
      if (!isFunction(fn)) {
        throw new Error(`tasks must be a function!`);
      }
      return fn;
    });
    this.event = event;
  }

  push(...rest: Array<Function>) {
    this.splice(0, this.tasks.length, ...rest);
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

  // 获取完成列表
  getTaskList(status?: executionStatus) {
    const { executedSymbol } = this;
    const unexecuted = this.tasks.filter((fn) => {
      return fn[executedSymbol] === status;
    });
    return unexecuted;
  }

  run() {
    const { tasks, option, executedSymbol } = this;
    // 获取未开始任务的列表，如果没有说明执行完成
    const unexecuted = this.getTaskList();
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
      const retryFn = this.asyncRetry(value);
      this.queue.push(retryFn);
      this.actuator(value, retryFn, index);
    }
  }

  promiseExecuter(resolve: (value: unknown) => void, reject: (reason?: any) => void) {
    // 将函数包裹一下，待返回promise状态的时候进行副作用的清理
    this.resolveFn = (value) => {
      this.clear();
      resolve(value);
    };
    this.rejectFn = (reason) => {
      this.clear();
      reject(reason);
    };
    this.state = 'operation';
    this.run();
  }

  asyncRetry(fn: Function) {
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
            // 继续执行
            resolve(this.asyncRetry(fn)());
          });
      });
    };
  }

  // 返回进度
  progress() {
    // 获取完成的列表跟总任务对比
    const executed = this.getTaskList(executionStatus.end);
    return executed.length / this.tasks.length;
  }

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

          this.state = 'error';
          return;
        }
        fn[executedSymbol] = executionStatus.end;
      })
      .finally(() => {
        this.event.emit({
          index,
          status: fn[resultSymbol] instanceof Error ? 'error' : 'success',
          data: fn[resultSymbol],
          progress: this.progress(),
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
        this.state = 'error';
        return;
      }
      this.state = 'end';
      const result = this.tasks.map((fn) => fn[resultSymbol]);
      this.resolveFn(result);
    }
    return finish;
  }

  async next(index: number) {
    // 如果不符合条件返回，必须未进行中且没有
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
      this.state = 'error';
      return;
    }
    const executed = this.getTaskList(executionStatus.end);
    this.resolveFn(executed);

    this.state = 'end';
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
  }
}

export default Scheduler;

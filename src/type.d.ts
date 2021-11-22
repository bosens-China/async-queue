export interface Option {
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

  /**
   * 是否为流模式，默认为并发模式
   *
   * @type {boolean}
   * @memberof Option
   */
  flowMode: boolean;
}

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

export interface MergeValue {
  option: Option;
  tasks: Array<Function>;
  state: 'start' | 'suspend' | 'operation' | 'end' | 'error';
  push(...rest: Array<Function>): void;
  splice(start: number, deleteCount?: number);
  splice(start: number, deleteCount: number, ...rest: Array<Function>);

  /**
   * 暂停
   *
   * @memberof MergeValue
   */
  suspend(): void;

  /**
   * 恢复运行
   *
   * @memberof MergeValue
   */
  operation(): void;

  /**
   * 终止任务
   *
   * @memberof MergeValue
   */
  termination(): void;
  /**
   * 添加变化监听器
   *
   * @param {Function} fn
   * @return {*}  {{ cancen: () => void }}
   * @memberof MergeValue
   */
  addListener(fn: (value: Change) => void): { cancen: () => void };

  /**
   * 删除变化监听器
   *
   * @memberof MergeValue
   */
  removeListener: (fn: Function) => void;
}

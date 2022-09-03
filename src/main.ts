import { asyncQueue, asyncQueueSingle } from './asyncQueue';

import type { Options } from './asyncQueue';

/**
 * 传递配置项，返回使用配置项的 asyncQueue asyncQueueSingle方法
 *
 * @param {Partial<Options>} [options]
 * @return {*}
 */
export const create = (options?: Partial<Options>) => {
  return {
    asyncQueue: ((tasks, o) => {
      return asyncQueue(tasks, { ...options, ...o });
    }) as typeof asyncQueue,
    asyncQueueSingle: ((task, o) => {
      return asyncQueueSingle(task, { ...options, ...o });
    }) as typeof asyncQueueSingle,
  };
};
export { wait, random } from './utils';

export * from './asyncQueue';

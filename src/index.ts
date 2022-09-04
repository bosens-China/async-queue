import { asyncQueue, asyncQueueSingle } from './asyncQueue';

import type { Options } from './scheduler';

/**
 * 根据配置项，返回 asyncQueue asyncQueueSingle
 *
 * @param {Partial<Options>} [options]
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
export { sleep, random } from './utils';

export * from './asyncQueue';

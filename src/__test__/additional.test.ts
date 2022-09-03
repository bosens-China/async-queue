/*
 * 测试本次新增的功能点
 */

import { asyncQueue, wait, create } from '../main';

test(`create`, async () => {
  const { asyncQueue, asyncQueueSingle } = create({
    max: 2,
    throwError: true,
  });
  const result = asyncQueue([() => 1]);
  expect(result.options).toMatchObject({
    max: 2,
  });
  await expect(result).resolves.toEqual([1]);
  let i = 0;
  const fn = async () => {
    if (++i <= 2) {
      throw new Error(`error`);
    }
    return i;
  };
  // const resultSingle =
  await expect(asyncQueueSingle(fn)).rejects.toThrow();
  await expect(asyncQueueSingle(fn, { retryCount: 3 })).resolves.toBe(3);
});

test(`call chaining`, async () => {
  const fn = jest.fn();
  const result = asyncQueue([
    async () => {
      await wait(100);
      return 1;
    },
  ])
    .addListener(fn)
    .push(() => Promise.resolve(2))
    .splice(0, 1);
  expect(result.tasks).toHaveLength(1);
  await expect(result).resolves.toEqual([2]);
  expect(fn.mock.calls).toHaveLength(1);
});

test(`defaults`, () => {
  expect(asyncQueue.defaults).toEqual({
    max: 2,
    waitTime: 0,
    waitTaskTime: 0,
    throwError: false,
    retryCount: 0,
    flowMode: false,
  });
  asyncQueue.defaults = {
    max: 1,
    waitTime: 1,
    waitTaskTime: 1,
    throwError: true,
    retryCount: 1,
    flowMode: true,
  };
  expect(asyncQueue.defaults).toEqual({
    max: 1,
    waitTime: 1,
    waitTaskTime: 1,
    throwError: true,
    retryCount: 1,
    flowMode: true,
  });
});

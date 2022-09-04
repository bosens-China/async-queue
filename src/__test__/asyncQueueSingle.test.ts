import { asyncQueueSingle } from '../index';

test(`base`, async () => {
  await expect(asyncQueueSingle(() => 1)).resolves.toBe(1);
});

test(`base`, async () => {
  let i = 0;
  const fn = async () => {
    if (++i < 3) {
      throw new Error(`error`);
    }
    return i;
  };
  await expect(asyncQueueSingle(fn, { retryCount: 2 })).resolves.toBe(3);

  i = 0;
  await expect(asyncQueueSingle(fn, { retryCount: 1 })).rejects.toThrow('error');
});

test(`throwError`, async () => {
  await expect(asyncQueueSingle(() => Promise.reject(1))).rejects.toThrow('1');
  await expect(asyncQueueSingle(() => Promise.reject(1), { throwError: false })).resolves.toThrow('1');
});

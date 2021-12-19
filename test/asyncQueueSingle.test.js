import { asyncQueueSingle } from '../src/asyncQueue';

test(`done`, async () => {
  await expect(asyncQueueSingle(() => 1)).resolves.toBe(1);
  await expect(asyncQueueSingle(() => Promise.resolve('1'))).resolves.toBe('1');
});

test(`选项去除`, async () => {
  const result = asyncQueueSingle(() => 1);
  expect(result.push).toBeUndefined();
  expect(result.operation).toBeUndefined();
});

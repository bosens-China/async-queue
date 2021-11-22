/* eslint-disable prefer-promise-reject-errors */
import { asyncQueue, packingArray } from '../src/main';
import { wait } from '../src/utils';

test('asyncQueue', async () => {
  expect(() => asyncQueue({})).toThrow();
  expect(() => asyncQueue([1])).toThrow();
  const result = asyncQueue([]);

  expect(result.option).toEqual({
    max: 1,
    waitTime: 0,
    waitTaskTime: 0,
    throwError: false,
    retryCount: 0,
    flowMode: false,
  });
});

test('asyncQueue 普通任务测试', async () => {
  expect(asyncQueue([])).resolves.toEqual([]);
  const result = await asyncQueue([() => Promise.resolve(1), () => 2]);
  expect(result).toEqual([1, 2]);
});

test(`asyncQueue error`, async () => {
  const result = await asyncQueue(packingArray(Promise.reject(1), 123));
  expect(result).toEqual([new Error(1), 123]);
  await expect(asyncQueue(packingArray(Promise.reject(1), 123), { throwError: true })).rejects.toThrowError(/1/);
});

test(`retry`, async () => {
  let i = 0;
  const pro = () => {
    if (i >= 2) {
      return Promise.resolve(2);
    }
    return Promise.reject(i++);
  };
  const result = await asyncQueue(packingArray(pro), { retryCount: 2 });
  expect(result).toEqual([2]);
  await expect(asyncQueue(packingArray(pro), { retryCount: 1 })).resolves.toEqual([new Error(1)]);
});

test(`max test one`, async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  // 测试max的影响
  const time = +new Date();
  await expect(asyncQueue(packingArray(pro1, pro2, pro3), { max: 3 })).resolves.toEqual([1, 2, 3]);
  const currentTime = +new Date();
  expect(currentTime - time >= 300 && currentTime - time <= 400).toBeTruthy();
});
test(`max test tow`, async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  const time = +new Date();
  await expect(asyncQueue(packingArray(pro1, pro2, pro3), { max: 1 })).resolves.toEqual([1, 2, 3]);
  const currentTime = +new Date();
  expect(currentTime - time >= 600 && currentTime - time <= 700).toBeTruthy();
});

test.only('flowMode one', async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  const pro4 = () => wait(400).then(() => 4);
  const time = +new Date();
  await expect(asyncQueue(packingArray(pro1, pro2, pro3, pro4), { flowMode: true, max: 2 })).resolves.toEqual([
    1, 2, 3, 4,
  ]);
  const currentTime = +new Date();
  expect(currentTime - time >= 600 && currentTime - time <= 700).toBeTruthy();
});
test('flowMode two', async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  const pro4 = () => wait(400).then(() => 4);
  const time = +new Date();
  await expect(asyncQueue(packingArray(pro1, pro2, pro3, pro4), { flowMode: false, max: 2 })).resolves.toEqual([
    1, 2, 3, 4,
  ]);
  const currentTime = +new Date();
  expect(currentTime - time >= 600 && currentTime - time <= 700).toBeTruthy();
});

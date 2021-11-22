/* eslint-disable prefer-promise-reject-errors */
import { asyncQueue, packingArray } from '../src/main';
import { wait } from '../src/utils';

/*
 * 测试下每次异步的执行时间
 */

const asyncTime = async (fn, section) => {
  const time = +new Date();
  await fn();
  const currentTime = +new Date();
  const result = currentTime - time;

  if (!(result >= section && result <= section + 100)) {
    throw new Error(`time 超时，当前完成时间为: ${result}`);
  }
};

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
  i = 0;
  await expect(asyncQueue(packingArray(pro), { retryCount: 1 })).resolves.toEqual([new Error(1)]);
});

test(`max test one`, async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  await asyncTime(async () => {
    await expect(asyncQueue(packingArray(pro1, pro2, pro3), { max: 3 })).resolves.toEqual([1, 2, 3]);
  }, 300);
});
test(`max test tow`, async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  await asyncTime(async () => {
    await expect(asyncQueue(packingArray(pro1, pro2, pro3), { max: 1 })).resolves.toEqual([1, 2, 3]);
  }, 600);
});

test('flowMode one', async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  const pro4 = () => wait(400).then(() => 4);
  await expect(asyncQueue(packingArray(pro1, pro2, pro3, pro4), { flowMode: true, max: 2 })).resolves.toEqual([
    1, 2, 3, 4,
  ]);
});
test('flowMode two', async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  const pro4 = () => wait(400).then(() => 4);

  await asyncTime(async () => {
    await expect(asyncQueue(packingArray(pro1, pro2, pro3, pro4), { flowMode: false, max: 2 })).resolves.toEqual([
      1, 2, 3, 4,
    ]);
  }, 600);
});

test(`waitTime`, async () => {
  await asyncTime(async () => {
    const reuslt = await asyncQueue(packingArray(1), { waitTime: 200 });
    expect(reuslt).toEqual([1]);
  }, 0);
  await asyncTime(async () => {
    const reuslt = await asyncQueue(packingArray(1, 2), { waitTime: 200 });
    expect(reuslt).toEqual([1, 2]);
  }, 200);
});

test(`waitTime function`, async () => {
  const fn = jest.fn(() => 200);
  await asyncTime(async () => {
    const reuslt = await asyncQueue(packingArray(1, 2), { waitTime: fn });
    // 测试传递的值
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls[0]).toEqual([0]);
    expect(reuslt).toEqual([1, 2]);
  }, 200);
});

test(`waitTaskTime`, async () => {
  // 之所以为0是因为只有一个任务且max为1，直接执行完成了
  await asyncTime(async () => {
    const reuslt = await asyncQueue(packingArray(1), { waitTaskTime: 300 });
    expect(reuslt).toEqual([1]);
  }, 0);
  await asyncTime(async () => {
    const reuslt = await asyncQueue(packingArray(1, 2, 3, 4), { waitTaskTime: 300, flowMode: true });
    expect(reuslt).toEqual([1, 2, 3, 4]);
  }, 0);
  await asyncTime(async () => {
    const fn = jest.fn(() => 300);
    const reuslt = await asyncQueue(packingArray(1), { waitTaskTime: fn });
    expect(fn.mock.calls.length).toBe(0);
    expect(reuslt).toEqual([1]);
  }, 0);
  await asyncTime(async () => {
    const fn = jest.fn(() => 300);
    const reuslt = await asyncQueue(packingArray(1, 2), { waitTaskTime: fn });
    expect(fn.mock.calls.length).toBe(1);
    expect(reuslt).toEqual([1, 2]);
  }, 300);
});

test.only(`waitTime + waitTaskTime`, async () => {
  await asyncTime(async () => {
    const waitTaskTime = jest.fn(() => 100);
    const waitTime = jest.fn(() => 100);
    const reuslt = await asyncQueue(packingArray(1, 2, 3), { waitTaskTime, waitTime });
    expect(waitTaskTime.mock.calls.length).toBe(2);
    expect(waitTime.mock.calls.length).toBe(2);
    expect(waitTime.mock.calls).toEqual([[0], [1]]);
    expect(waitTaskTime.mock.calls).toEqual([[], []]);
    expect(reuslt).toEqual([1, 2, 3]);
  }, 400);
});

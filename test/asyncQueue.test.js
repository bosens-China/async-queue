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

test(`retry waitTime`, async () => {
  let i = 0;
  const pro = () => {
    if (i > 3) {
      return Promise.resolve(4);
    }
    return Promise.reject(i++);
  };
  await asyncTime(async () => {
    const result = await asyncQueue(packingArray(pro), { retryCount: 4, waitTime: 100 });
    expect(result).toEqual([4]);
  }, 400);
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

test(`waitTime + waitTaskTime`, async () => {
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

test(`suspend`, async () => {
  await asyncTime(async () => {
    const result = asyncQueue(packingArray(1, 2, 3));
    result.suspend();
    await wait(100);
    result.operation();
    await expect(result).resolves.toEqual([1, 2, 3]);
  }, 100);
});

test(`termination`, async () => {
  const result = asyncQueue(packingArray(1, 2, 3, 4), { waitTime: 10 });
  await wait(10);
  result.termination();
  await expect(result).resolves.toEqual([1]);
});

test(`tasks,push`, async () => {
  const result = asyncQueue(packingArray(1, 2, 3), { waitTime: 100 });
  expect(result.tasks.length).toBe(3);
  result.push(() => 4);
  expect(result.tasks.length).toBe(4);
  await expect(result).resolves.toEqual([1, 2, 3, 4]);
});

test(`splice`, async () => {
  const result = asyncQueue(packingArray(1, 2, 3), { waitTime: 100 });
  // splice大概分为两种，插入和删除
  result.splice(0, 0, () => 4);
  // 删除原来1的任务
  result.splice(1, 1);
  await expect(result).resolves.toEqual([4, 2, 3]);
});

test(`state`, async () => {
  const result = asyncQueue(packingArray(1, 2, 3), { waitTime: 100 });
  expect(result.state).toBe('operation');
  result.suspend();
  expect(result.state).toBe('suspend');
  result.operation();
  expect(result.state).toBe('operation');
  await result;
  expect(result.state).toBe('end');
});

test(`state error`, async () => {
  const result = asyncQueue(packingArray(Promise.reject(123)), { throwError: true });
  try {
    await result;
  } catch {}
  expect(result.state).toBe('error');
});

test(`addListener`, async () => {
  const fn = jest.fn();
  const result = asyncQueue(packingArray(1, 2, 3));
  result.addListener(fn);
  await result;
  expect(fn.mock.calls.length).toBe(3);
  expect(fn.mock.calls).toEqual([
    [
      {
        index: 0,
        status: 'success',
        data: 1,
        progress: 1 / 3,
        total: 3,
      },
    ],
    [
      {
        index: 1,
        status: 'success',
        data: 2,
        progress: 2 / 3,
        total: 3,
      },
    ],
    [
      {
        index: 2,
        status: 'success',
        data: 3,
        progress: 3 / 3,
        total: 3,
      },
    ],
  ]);
});

test(`addListener oncalcel`, async () => {
  const fn = jest.fn();
  const result = asyncQueue(packingArray(1, 2, 3));
  const value = result.addListener(fn);
  value.cancen();
  await result;
  expect(fn.mock.calls.length).toBe(0);
});
test(`removeListener`, async () => {
  const fn = jest.fn();
  const result = asyncQueue(packingArray(1, 2, 3));
  result.addListener(fn);
  result.removeListener(fn);
  await result;
  expect(fn.mock.calls.length).toBe(0);
});

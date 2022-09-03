/* eslint-disable prefer-promise-reject-errors */
import { asyncQueue } from '../asyncQueue';
import { wait, isFunction } from '../utils';

// 本次测试所用到方法

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

/**
 * 将参数转化为 () => value 形式
 */
const packing = (value) => {
  if (isFunction(value)) {
    return value;
  }
  return () => value;
};

/**
 * 将参数转化为函数调用，有两种调用方式
 * 1. 直接传递([1,2])的形式
 * 2. 传递(1)形式
 */
const packingArray = (value: any | Array<any>, ...rest) => {
  const arr: any[] = [];
  if (rest.length) {
    arr.push(value);
    arr.push(...rest);
  } else {
    if (Array.isArray(value)) {
      arr.push(...value);
    } else {
      arr.push(value);
    }
  }
  return arr.map((item) => packing(item));
};

// 测试正式开始
test('asyncQueue base Options', async () => {
  expect(() => asyncQueue({} as any)).toThrow();
  expect(() => asyncQueue([1] as any)).toThrow();
  const result = asyncQueue([]);
  expect(result.options).toEqual({
    max: 2,
    waitTime: 0,
    waitTaskTime: 0,
    throwError: false,
    retryCount: 0,
    flowMode: false,
  });
  await result;
  expect(result.tasks.length).toBe(0);
});

test('asyncQueue base tasks', async () => {
  expect(asyncQueue([])).resolves.toEqual([]);
  const result = await asyncQueue([() => Promise.resolve(1), () => 2]);
  expect(result).toEqual([1, 2]);
});

test(`asyncQueue tasks error`, async () => {
  const result = await asyncQueue(packingArray(Promise.reject(1), 123));
  expect(result).toEqual([new Error('1'), 123]);
  await expect(asyncQueue(packingArray(Promise.reject(1), 123), { throwError: true })).rejects.toThrowError(/1/);
});

test(`asyncQueue options.retry`, async () => {
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
  await expect(asyncQueue(packingArray(pro), { retryCount: 1 })).resolves.toEqual([new Error('1')]);
});

test(`asyncQueue options.retry-waitTime`, async () => {
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

test(`asyncQueue options.maxAll`, async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  await asyncTime(async () => {
    await expect(asyncQueue(packingArray(pro1, pro2, pro3), { max: 3 })).resolves.toEqual([1, 2, 3]);
  }, 300);
});
test(`asyncQueue options.max`, async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  await asyncTime(async () => {
    await expect(asyncQueue(packingArray(pro1, pro2, pro3), { max: 1 })).resolves.toEqual([1, 2, 3]);
  }, 600);
});

test('asyncQueue options.flowMode on', async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  const pro4 = () => wait(400).then(() => 4);
  await asyncTime(async () => {
    await expect(asyncQueue(packingArray(pro1, pro2, pro4, pro3), { flowMode: true, max: 2 })).resolves.toEqual([
      1, 2, 4, 3,
    ]);
  }, 500);
});
test('asyncQueue options.flowMode off', async () => {
  const pro1 = () => wait(100).then(() => 1);
  const pro2 = () => wait(200).then(() => 2);
  const pro3 = () => wait(300).then(() => 3);
  const pro4 = () => wait(400).then(() => 4);

  await asyncTime(async () => {
    await expect(asyncQueue(packingArray(pro1, pro2, pro4, pro3), { flowMode: false, max: 2 })).resolves.toEqual([
      1, 2, 4, 3,
    ]);
  }, 600);
});

test(`asyncQueue options.waitTime Do not execute`, async () => {
  /*
   * 只有一个不会继续执行 waitTime
   */
  await asyncTime(async () => {
    const reuslt = await asyncQueue(packingArray(1), { waitTime: 200, max: 1 });
    expect(reuslt).toEqual([1]);
  }, 0);
  await asyncTime(async () => {
    const reuslt = await asyncQueue(packingArray(1, 2), { waitTime: 200, max: 1 });
    expect(reuslt).toEqual([1, 2]);
  }, 200);
});

test(`asyncQueue options.waitTime function`, async () => {
  await asyncTime(async () => {
    const fn = jest.fn(() => 200);
    const reuslt = await asyncQueue(packingArray(1, 2), { waitTime: fn, max: 1 });
    // 测试传递的值
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls[0]).toEqual([0]);
    expect(reuslt).toEqual([1, 2]);
  }, 200);

  await asyncTime(async () => {
    const fn = jest.fn(() => 300);
    const reuslt = await asyncQueue(packingArray(1), { waitTaskTime: fn });
    expect(fn.mock.calls.length).toBe(0);
    expect(reuslt).toEqual([1]);
  }, 0);
  await asyncTime(async () => {
    const fn = jest.fn(() => 300);
    const reuslt = await asyncQueue(packingArray(1, 2), { waitTaskTime: fn, max: 1 });
    expect(fn.mock.calls.length).toBe(1);
    expect(reuslt).toEqual([1, 2]);
  }, 300);
});

test(`asyncQueue options.waitTime + options.waitTaskTime`, async () => {
  await asyncTime(async () => {
    const waitTaskTime = jest.fn(() => 100);
    const waitTime = jest.fn(() => 100);
    const reuslt = await asyncQueue(packingArray(1, 2, 3), { waitTaskTime, waitTime, max: 1 });
    expect(waitTaskTime.mock.calls.length).toBe(2);
    expect(waitTime.mock.calls.length).toBe(2);
    expect(waitTime.mock.calls).toEqual([[0], [1]]);
    expect(waitTaskTime.mock.calls).toEqual([[], []]);
    expect(reuslt).toEqual([1, 2, 3]);
  }, 400);
});

test(`asyncQueue methods.suspend`, async () => {
  await asyncTime(async () => {
    const result = asyncQueue(packingArray(1, 2, 3));
    result.suspend();
    await wait(100);
    result.operation();
    await expect(result).resolves.toEqual([1, 2, 3]);
  }, 100);
});

test(`asyncQueue methods.termination`, async () => {
  const result = asyncQueue(packingArray(1, 2, 3, 4), { waitTime: 10 });
  await wait(10);
  result.termination();
  await expect(result).resolves.toEqual([1, 2]);
});

test(`asyncQueue methods.tasks + methods.push`, async () => {
  const result = asyncQueue(packingArray(1, 2, 3), { waitTime: 100 });
  expect(result.tasks.length).toBe(3);
  result.push(() => 4);
  expect(result.tasks.length).toBe(4);
  await expect(result).resolves.toEqual([1, 2, 3, 4]);
});

test(`asyncQueue methods.splice`, async () => {
  const result = asyncQueue(packingArray(1, 2, 3), { waitTime: 100 });
  // splice大概分为两种，插入和删除
  result.splice(0, 0, () => 4);
  // 删除原来1的任务
  result.splice(1, 1);
  await expect(result).resolves.toEqual([4, 2, 3]);
});

test(`asyncQueue state`, async () => {
  const result = asyncQueue(packingArray(1, 2, 3), { waitTime: 100 });
  expect(result.state).toBe('operation');
  result.suspend();
  expect(result.state).toBe('suspend');
  result.operation();
  expect(result.state).toBe('operation');
  await result;
  expect(result.state).toBe('end');
});

test(`asyncQueue state error`, async () => {
  const result = asyncQueue(packingArray(Promise.reject(123)), { throwError: true });
  try {
    await result;
  } catch {
    //
  }
  expect(result.state).toBe('error');
});

test(`asyncQueue methods.addListener`, async () => {
  const fn = jest.fn();
  const result = asyncQueue(packingArray(1, 2, 3), { max: 1 });
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

test(`asyncQueue methods.removeListener`, async () => {
  const fn = jest.fn();
  const result = asyncQueue(packingArray(1, 2, 3));
  result.addListener(fn);
  result.removeListener(fn);
  await result;
  expect(fn.mock.calls.length).toBe(0);
});

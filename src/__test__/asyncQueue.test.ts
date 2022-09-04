import { asyncQueue, create } from '../index';
import { sleep } from '../utils';

test(`base`, async () => {
  await expect(asyncQueue([1, 2, 3].map((f) => () => f))).resolves.toEqual([1, 2, 3]);
});

test(`max`, async () => {
  const arr: Array<number> = [];
  const result = asyncQueue(
    [1, 2, 3].map((f) => () => {
      arr.push(f);

      return f;
    }),
    { max: 1, waitTime: 100 },
  );
  expect(arr).toEqual([]);
  await sleep(100);
  expect(arr).toEqual([1]);
  await sleep(100);
  expect(arr).toEqual([1, 2]);
  await sleep(100);
  expect(arr).toEqual([1, 2, 3]);
  await expect(result).resolves.toEqual([1, 2, 3]);
});

describe('waitTime', () => {
  test(`waitTime flowMode`, async () => {
    const fn = jest.fn(() => 10);
    await asyncQueue(
      [1, 2, 3].map((f) => () => {
        return f;
      }),
      { max: 1, waitTime: fn },
    );
    expect(fn.mock.calls).toHaveLength(3);
    expect(fn.mock.calls).toEqual([[0], [1], [2]]);
  });

  test(`waitTime concurrent`, async () => {
    const fn = jest.fn(() => 10);
    await asyncQueue(
      [1, 2, 3].map((f) => () => {
        return f;
      }),
      { max: 1, waitTime: fn, flowMode: false },
    );
    expect(fn.mock.calls).toHaveLength(3);
    expect(fn.mock.calls).toEqual([[], [], []]);
  });
});

describe(`waitTaskTime`, () => {
  test(`waitTime flowMode`, async () => {
    const fn = jest.fn(() => 0);
    await asyncQueue(
      [1, 2, 3].map((f) => () => {
        return f;
      }),
      { max: 1, waitTaskTime: fn },
    );
    expect(fn.mock.calls).toHaveLength(0);
  });
  test(`waitTime concurrent`, async () => {
    const fn = jest.fn(() => 0);
    await asyncQueue(
      [1, 2, 3].map((f) => () => {
        return f;
      }),
      { max: 1, waitTaskTime: fn, flowMode: false },
    );
    expect(fn.mock.calls).toHaveLength(2);
    expect(fn.mock.calls).toEqual([[], []]);
  });
});

test(`throwError`, async () => {
  await expect(asyncQueue([() => Promise.reject(1)])).rejects.toThrow('1');
  await expect(asyncQueue([() => Promise.reject(1)], { throwError: false })).resolves.toEqual([new Error('1')]);
});

test(`retryCount`, async () => {
  let i = 0;
  const fn = async () => {
    if (++i < 3) {
      throw new Error(`error`);
    }
    return i;
  };
  await expect(asyncQueue([fn], { retryCount: 2 })).resolves.toEqual([3]);
  i = 0;
  await expect(asyncQueue([fn], { retryCount: 1 })).rejects.toThrow('error');
});

describe('defaults', () => {
  const values = {
    max: 2,
    waitTime: 0,
    waitTaskTime: 0,
    throwError: true,
    retryCount: 0,
    flowMode: true,
  };
  afterAll(() => {
    asyncQueue.defaults = values;
  });
  test(`default`, () => {
    expect(asyncQueue.defaults).toEqual(values);
  });

  test('set values', () => {
    asyncQueue.defaults = {
      max: 3,
      waitTime: 1,
      waitTaskTime: 1,
      throwError: false,
      retryCount: 1,
      flowMode: false,
    };
    expect(asyncQueue.defaults).toEqual({
      max: 3,
      waitTime: 1,
      waitTaskTime: 1,
      throwError: false,
      retryCount: 1,
      flowMode: false,
    });
  });
});

describe('event', () => {
  test(`addListener`, async () => {
    const fn = jest.fn();
    await asyncQueue(
      [1, 2, 3].map((f) => () => {
        return f;
      }),
      { max: 1 },
    ).addListener(fn);
    expect(fn.mock.calls).toHaveLength(3);
    expect(fn.mock.calls).toEqual([
      [
        {
          index: 0,
          status: 'success',
          data: 1,
          total: 3,
          progress: 1 / 3,
        },
      ],
      [
        {
          index: 1,
          status: 'success',
          data: 2,
          total: 3,
          progress: 2 / 3,
        },
      ],
      [{ index: 2, status: 'success', data: 3, total: 3, progress: 1 }],
    ]);
  });

  test(`removeListener`, async () => {
    const fn = jest.fn();
    await asyncQueue(
      [1, 2, 3].map((f) => () => {
        return f;
      }),
      { max: 1 },
    )
      .addListener(fn)
      .removeListener(fn);
    expect(fn.mock.calls).toHaveLength(0);
  });
  test(`removeListener all`, async () => {
    const fn = jest.fn();
    await asyncQueue(
      [1, 2, 3].map((f) => () => {
        return f;
      }),
      { max: 1 },
    )
      .addListener(fn)
      .removeListener();
    expect(fn.mock.calls).toHaveLength(0);
  });
});

describe('create', () => {
  test('base', () => {
    const values = Object.values(create());
    expect(values.map((f) => f.name)).toEqual(expect.arrayContaining(['asyncQueue', 'asyncQueueSingle']));
  });
  test('options', async () => {
    const { asyncQueue, asyncQueueSingle } = create({ retryCount: 1 });
    expect((asyncQueue([]) as any).options.retryCount).toBe(1);
    let i = 0;
    const fn = async () => {
      if (++i < 3) {
        throw new Error(`error`);
      }
      return i;
    };
    await expect(asyncQueueSingle(fn)).rejects.toThrow('error');
    i = 0;
    await expect(asyncQueueSingle(fn, { retryCount: 2 })).resolves.toBe(3);
  });
});

describe(`Sequential test`, () => {
  test(`Output sequence`, async () => {
    const fn = jest.fn();
    await asyncQueue(
      Array.from({ length: 20 })
        .fill(undefined)
        .map((_, index) => () => index),
      {
        max: 3,
      },
    ).addListener(fn);
    expect(fn.mock.calls).toHaveLength(20);
    expect(fn.mock.calls.map((f) => f[0].data)).toEqual(
      Array.from({ length: 20 })
        .fill(undefined)
        .map((_, index) => index),
    );
  });
  test(`Output sequence concurrent`, async () => {
    const fn = jest.fn();
    await asyncQueue(
      Array.from({ length: 20 })
        .fill(undefined)
        .map((_, index) => () => index),
      {
        max: 3,
        flowMode: false,
      },
    ).addListener(fn);
    expect(fn.mock.calls).toHaveLength(20);
    expect(fn.mock.calls.map((f) => f[0].data)).toEqual(
      Array.from({ length: 20 })
        .fill(undefined)
        .map((_, index) => index),
    );
  });
});

import { sleep, random, isFunction } from '../utils';

// 添加自定义的匹配器
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

test(`isFunction`, () => {
  expect(
    isFunction(() => {
      //
    }),
  ).toBeTruthy();

  expect(
    isFunction(function test() {
      //
    }),
  ).toBeTruthy();
  expect(isFunction({} as any)).toBeFalsy();
});

test(`random`, () => {
  (expect(random(10, 20)) as any).toBeWithinRange(10, 20);
  (expect(random(1.1, 10.1, false)) as any).toBeWithinRange(1.1, 10.1);
  (expect(random(1, 10)) as any).not.toBeWithinRange(11, 20);
});

test(`sleep`, async () => {
  async function foo<T>(fn: () => T, waitMs: number): Promise<T> {
    await sleep(waitMs);
    return fn();
  }
  jest.useFakeTimers();
  const fn = jest.fn(() => 3);
  const retVal = foo(fn, 1000);
  expect(fn).not.toBeCalled();
  await Promise.resolve().then(() => jest.advanceTimersByTime(1000));
  expect(fn).toHaveBeenCalledTimes(1);
  await expect(retVal).resolves.toBe(3);
});

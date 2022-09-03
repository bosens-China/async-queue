import { isFunction, wait, random } from '../utils';

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
  expect(isFunction({})).toBeFalsy();
});

test(`wait`, async () => {
  const time = +new Date();
  await wait(100);
  expect(+new Date() - time >= 100).toBeTruthy();
});

test(`random`, () => {
  (expect(random(0, 1)) as any).toBeWithinRange(0, 1);
});

test(`random floor`, () => {
  (expect(random(1.1, 10.11)) as any).toBeWithinRange(1.1, 10.11, true);
});

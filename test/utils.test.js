import { isFunction, isObjectLink, wait, packing, packingArray } from '../src/utils';

test(`isFunction`, () => {
  expect(isFunction(() => {})).toBeTruthy();
  expect(isFunction({})).toBeFalsy();
});

test('isObjectLink', () => {
  expect(isObjectLink({})).toBeTruthy();
  expect(isObjectLink(null)).toBeFalsy();
  expect(isObjectLink(() => {})).toBeFalsy();
  expect(isObjectLink([])).toBeTruthy();
});

test(`wait`, async () => {
  const time = +new Date();
  await wait(100);
  expect(+new Date() - time >= 100).toBeTruthy();
});

test(`packing`, async () => {
  const result = packing(Promise.resolve());
  expect(isFunction(result)).toBeTruthy();
  await expect(result()).resolves.toBeUndefined();
  expect(packing(() => 123)()).toBe(123);
});

test(`packingArray`, async () => {
  const reuslt = packingArray(1, 2, 3);
  expect(reuslt.every((item) => isFunction(item))).toBeTruthy();
  expect(reuslt.length).toBe(3);
  expect(packingArray([1, 2, 3]).every((fn) => isFunction(fn))).toBeTruthy();
  expect(packingArray([1, 2, 3]).length).toBe(3);
});

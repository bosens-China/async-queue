import Event from '../src/event';

test(`event addListener`, () => {
  const event = new Event();
  expect(() => event.addListener({})).toThrow();
});

test(`evevt emit`, () => {
  const event = new Event();
  const fn = jest.fn();
  event.addListener(fn);
  event.emit(1, 2, 3);
  expect(fn.mock.calls[0]).toEqual([1, 2, 3]);
  expect(fn.mock.calls.length).toBe(1);
});

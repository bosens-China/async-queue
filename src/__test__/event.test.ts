import { Event } from '../event';

test(`event`, () => {
  const event = new Event();
  const fn = jest.fn();
  event.addListener(fn);
  event.addListener(fn);
  expect(event.list).toHaveLength(2);
  expect(fn.mock.calls).toHaveLength(0);
  event.emit(1);
  expect(fn.mock.calls).toHaveLength(2);
  expect(fn.mock.calls).toEqual([[1], [1]]);
  event.removeListener(fn);
  expect(event.list).toHaveLength(0);
  expect(event.addListener(fn));
  event.removeListener();
  expect(event.list).toHaveLength(0);
});

export type Fn<T = any> = (...rest: any) => T;

export class Event {
  public list: Array<Fn> = [];

  removeListener(listener?: Fn) {
    if (listener) {
      // 这里可能存在多条相同，所以全部删除引用相同的
      let index = this.list.indexOf(listener);
      while (index > -1) {
        this.list.splice(index, 1);
        index = this.list.indexOf(listener);
      }
      return;
    }
    this.list = [];
  }

  addListener(listener: Fn) {
    this.list.push(listener);
  }
  emit<T = any>(values: T) {
    this.list.forEach((fn) => {
      fn(values);
    });
  }
}

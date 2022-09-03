# async-queue

管理异步队列的工具，支持重试以及并发和 `stream` 模式。

```sh
# 两种模式下完成任务的时间
tasks = [1s,2s,4s,3s];
max = 2
# 并发
task => [1s,2s,4s,3s] => [4s,3s] => [] # 完成时间6s
# 流模式
task => [1s,2s,4s,3s] => [1s,3s,2s] => [2s,1s] => [1s] => [] # 完成时间4s

```

## 快速上手

### 安装

```sh
yarn add @boses/async-queue
```

### 使用方式

```js
import { asyncQueue } from '@boses/async-queue';
// or commonjs 引用方式
// const { asyncQueue } = require('@boses/async-queue');

const App = async () => {
  // 异步请求，隐藏具体细节
  const getRquire = [
    async () => {
      // xxx
    },
    async () => {
      // xxx
    },
  ];
  const result = await asyncQueue(getRquire);
};

App();
```

## Api

async-queue 暴露三个 api

- [asyncQueue](#asyncQueue)，管理异步队列
- [SingleOptions](#SingleOptions)，管理单次任务
- [create](#create)，根据 [options](#options) 返回 [asyncQueue](#asyncQueue)、[SingleOptions](#SingleOptions)

### asyncQueue

`(tasks: Array<Function>, options?: Options) => AsyncQueueValue`

创建异步队列任务，具体说明如下

#### task

等待执行的任务列表，传递值必须为`Array<Function>`。

> 你可能会疑惑，为什么要求必须为`() => xxx`的形式？
>
> 这是因为大多数的情况下任务都是通过函数形式调用，例如给定一个 task 通常情况下它会完成一次网络请求或执行一次操作，如果不通过函数形式调用，它的值始终为固定形式。
>
> 为了方便使用，你可以结合`lodash`之类的函数库使用，下面是一个例子
>
> ```js
> import { asyncQueue } from '@boses/async-queue';
> import _ from 'lodash';
> const fn = () => {};
> // 在这里传递参数
> asyncQueue([_.partial(fn, 'test')]);
> ```

#### options

| 名称         | 类型                                      | 默认值  | 描述                                                                 |
| ------------ | ----------------------------------------- | ------- | -------------------------------------------------------------------- |
| max          | `number`                                  | `2`     | 最大请求数                                                           |
| waitTime     | `number` or `((index: number) => number)` | `0`     | 每次请求完成后等待时，index 为任务索引间                             |
| waitTaskTime | `number` or `(() => number)`              | `0`     | 每批任务结束后等待时间，**注意**在`flowMode`模式下不起作用           |
| throwError   | `boolean` or `false`                      | `false` | 是否抛出错误，默认为 false，在发生错误的时候将错误值记录下来         |
| retryCount   | `number` or `false`                       | `0`     | 每个任务重试次数                                                     |
| flowMode     | `boolean` or `false`                      | `false` | 是否为流模式，默认为并发模式。并发和流的区别可以查看文档开头开头例子 |

#### defaults

上述 options 的初始值都包含在 defaults 对象上，因此你可以直接修改这个对象，做到全局修改。

> 注意 asyncQueueSingle 函数的默认值也同样受此影响

```js
import { asyncQueue } from '@boses/async-queue';
asyncQueue.defaults.max = 1;
```

#### AsyncQueueValue

asyncQueue 的返回值，具体返回值如下。

| 名称           | 类型                                                         | 描述                                                                              |
| -------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| options        | `Options`                                                    | 返回处理过的 options 对象                                                         |
| result         | `Promise<any>`                                               | 链式调用时候使用，返回值是 Promise，可以直接 then 调用                            |
| tasks          | `Array<Function>`                                            | 返回传递的 tasks 列表，注意你不应该直接修改 task 的值，而是通过下面的 push 等方法 |
| state          | `['start', 'suspend','operation','end','error']`             | 返回当前状态                                                                      |
| push           | `(...rest: Array<Function>): this`                           | 跟 Array.push 使用方式一致，不过必须传递`Function`的参数                          |
| splice         | `splice(start: number, deleteCount?: number, ...rest?: this` | 跟 Array.splice 使用方式一致，不过添加值必须传递`Function`参数                    |
| suspend        | `() => this`                                                 | 暂停执行                                                                          |
| operation      | `() => this`                                                 | 恢复执行                                                                          |
| termination    | `() => this`                                                 | 终止任务                                                                          |
| addListener    | `(fn: Function): this`                                       | 添加监听器                                                                        |
| removeListener | `(fn?: Function) => this`                                    | 删除监听器，如果不提供 fn 参数则删除全部                                          |

> 注意：`addListener` 添加的监听器会在任务完成自动 `removeListener`，所以不是中途取消监听，无需手动调用。
>
> 上面的方法返回的都是 this，因此可以很容易链式调用。

### asyncQueueSingle

`(tasks: Function, options?: SingleOptions) => Promise<any>`

与 [asyncQueue](#asyncQueue) 使用基本一致，为了方便使用而封装的单次使用方法，具体 Api 如下

#### SingleOptions

| 名称       | 类型                 | 默认值  | 描述                                                          |
| ---------- | -------------------- | ------- | ------------------------------------------------------------- |
| throwError | `boolean` or `false` | `false` | 是否抛出错误，默认为`false`，在发生错误的时候将错误值记录下来 |
| retryCount | `number` or `false`  | `0`     | 每个任务重试次数                                              |

### create

`create(options) => ({asyncQueue, asyncQueueSingle})`

每次创建任务都需要填写相同的配置项，你会觉得繁琐这也是为什么有 create 这个方法的原因，它接收一个 [options](#options)。

返回值为 asyncQueue 以及 asyncQueueSingle

## 例子

## 链式调用

```js
import { asyncQueue, wait } from '@boses/async-queue';
const result = await asyncQueue([
  async () => {
    await wait(100);
    return 1;
  },
])
  .addListener(() => {
    // 变化
  })
  .push(() => Promise.resolve(2))
  // 删除最开始任务
  .splice(0, 1);

console.log(result);
// 2
```

### 爬虫

```js
const axios = require('axios');
const { asyncQueue } = require('@boses/async-queue');

const getPage = async (page = 1) => {
  const { data } = await axios.get(`xxx?p=${page}`);
  return data;
};

const App = async () => {
  const tasks = Array.from({ length: 4 })
    .fill()
    .map((_, index) => () => getPage(index + 1));
  const data = await asyncQueue(tasks, {
    max: 2,
    waitTime: 1000,
    waitTaskTime: 1000,
    retryCount: 1,
  }).addListener((value) => {
    console.log(`当前完成进度为： ${value.progress.toFixed(2)}, 状态为： ${value.status}`);
  });
  console.log(data);
};

App();
```

## 批量插入 element

```js
import { asyncQueue } from '@boses/async-queue';

const app = document.body.querySelector('#app');

const ul = document.createElement('ul');

const task = (_, index) => {
  return () => {
    const li = document.createElement('li');
    li.textContent = `当前元素为：${index + 1}项`;
    ul.appendChild(li);
  };
};

// 为了防止页面卡顿，分批插入
const tasks = Array.from({ length: 1000 }).fill('').map(task);

asyncQueue(tasks, { max: 100, waitTaskTime: 10 }).then((res) => {
  app.appendChild(ul);
});
```

## 兼容性

支持现代浏览器，因为使用了 `WeakMap`、`proxy` 等特性，所以在使用 `webpack` 等构建工具时，让务必让 `babel` 转译此模块。

### [Vue CLI](https://cli.vuejs.org/zh/)

```js
//  vue.config.js
module.exports = {
  transpileDependencies: ['@boses/async-queue'],
};
```

### [webpack](https://webpack.js.org/)

```js
module: {
  rules: [
    {
      test: /\.m?js$/,
      exclude: (modulePath) => {
        // 禁止过滤
        if (modulePath.includes('@boses/async-queue')) {
          return false;
        }
        return /node_modules/.test(modulePath);
      },
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
        },
      },
    },
  ];
}
```

## 协议

[MIT License](./License)

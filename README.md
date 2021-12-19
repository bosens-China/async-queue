# async-queue

让你轻松管理队列的异步，支持并发和流两种模式。

```sh
# 任务总数和每个任务完成的单次时间
tasks = [1s,2s,4s,3s];
max = 2
# 并发
task => [1s,2s] => [4s,3s] # 完成时间6s
# 流模式
task => [1s,2s] => [4s,2s] => [4s,3s] # 完成时间5s

```

## 快速上手

### 安装

```sh
yarn add @boses/async-queue
```

### 用法

```js
const { asyncQueue } = require('@boses/async-queue');
// or es使用方式
// import { asyncQueue } from '@boses/async-queue';

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

> 如果你想引用相关的类型，可以通过下面方式来使用
>
> ```js
> import { SingleOptions, Options } from '@boses/async-queue/dist/type';
> ```

## Api

async-queue 暴露两个 api

- [asyncQueue](#asyncQueue)，管理异步队列
- [SingleOptions](#SingleOptions)，管理单次任务

### asyncQueue

`(tasks: Array<Function>, options?: Options) => AsyncQueueValue`

创建异步队列，具体说明如下

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

| 名称         | 类型                                      | 默认值  | 描述                                                          |
| ------------ | ----------------------------------------- | ------- | ------------------------------------------------------------- |
| max          | `number`                                  | `1`     | 最大请求数                                                    |
| waitTime     | `number` or `((index: number) => number)` | `0`     | 每次请求完成后等待时间                                        |
| waitTaskTime | `number` or `(() => number)`              | `0`     | 每批任务结束后等待时间，**注意**在`flowMode`模式下不起作用    |
| throwError   | `boolean` or `false`                      | `false` | 是否抛出错误，默认为`false`，在发生错误的时候将错误值记录下来 |
| retryCount   | `number` or `false`                       | `0`     | 每个任务重试次数                                              |
| flowMode     | `boolean` or `false`                      | `false` | 是否为流模式，默认为并发模式                                  |

#### AsyncQueueValue

| 名称           | 类型                                                                     | 描述                                                                              |
| -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| options        | `Options`                                                                | 返回处理过的`options`对象                                                         |
| tasks          | `Array<Function>`                                                        | 返回传递的`tasks`列表，注意你不应该直接修改`task`的值，而是通过下面的`push`等方法 |
| state          | `['start', 'suspend','operation','end','error']`                         | 返回当前状态                                                                      |
| push           | `(...rest: Array<Function>): void`                                       | 跟`Array.push`使用方式一致，不过必须传递`Function`的参数                          |
| splice         | `splice(start: number, deleteCount?: number, ...rest?: Array<Function>)` | 跟`Array.splice`使用方式一致，不过添加值必须传递`Function`参数                    |
| suspend        | `() => void`                                                             | 暂停执行                                                                          |
| operation      | `() => void`                                                             | 恢复执行                                                                          |
| termination    | `() => void`                                                             | 终止任务                                                                          |
| addListener    | `(fn: Function): { cancen: () => void }`                                 | 添加监听器，返回的`cancel`方法跟`removeListener`一个作用                          |
| removeListener | `(fn: Function) => void`                                                 | 删除监听器                                                                        |

> 注意：`addListener`添加的监听器会在任务完成自动`removeListener`，所以不是中途取消监听，无需手动调用。

### asyncQueueSingle

`(tasks: Function, options?: SingleOptions) => Promise<any>`

与[asyncQueue](#asyncQueue)使用基本一致，为了方便使用而封装的单次使用方法，具体 Api 如下

#### SingleOptions

| 名称       | 类型                 | 默认值  | 描述                                                          |
| ---------- | -------------------- | ------- | ------------------------------------------------------------- |
| throwError | `boolean` or `false` | `false` | 是否抛出错误，默认为`false`，在发生错误的时候将错误值记录下来 |
| retryCount | `number` or `false`  | `0`     | 每个任务重试次数                                              |

## 例子

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
  const result = asyncQueue(tasks, {
    max: 2,
    waitTime: 1000,
    waitTaskTime: 1000,
    retryCount: 1,
  });
  result.addListener((value) => {
    console.log(`当前完成进度为： ${value.progress.toFixed(2)}, 状态为： ${value.status}`);
  });
  const data = await result;
  // 后续对data进行其他操作
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

支持现代浏览器，因为使用了`WeakMap`、`definePropertie`等特性，所以在使用`webpack`等构建工具时，让务必让`babel`转译此模块。

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

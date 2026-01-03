---
title: C++ std::packaged_task
date: "2021-11-08 18:33:00"
tags: [C++, docs]
category: blog
---
std::packaged\_task是C++11将任务进行包装的一种容器，类似于std::async，但是std::package\_task本身并不负责发起一个并行任务，仅仅将任务与期望包装为一个异步Provider。

<!-- more -->

参考cppreference的 [std::packaged_task](https://zh.cppreference.com/w/cpp/thread/packaged_task) 示例 ：

```cpp

#include <iostream>
#include <cmath>
#include <thread>
#include <future>
#include <functional>

// 避免对std::pow重载集消歧义的独有函数
int f(int x, int y) { return std::pow(x, y); }

void task_lambda()
{
    std::packaged_task<int(int, int)> task([](int a, int b) {
        return std::pow(a, b);
        });
    std::future<int> result = task.get_future();

    task(2, 9);

    std::cout << "task_lambda:\t" << result.get() << std::endl;
}

void task_bind()
{
    std::packaged_task<int()> task(std::bind(f, 2, 11));
    std::future<int> result = task.get_future();

    task();

    std::cout << "task_bind:\t" << result.get() << std::endl;
}

void task_thread()
{
    std::packaged_task<int(int, int)> task(f);
    std::future<int> result = task.get_future();

    std::thread task_td(std::move(task), 2, 10);
    task_td.join();

    std::cout << "task_thread:\t" << result.get() << std::endl;
}

int main()
{
    task_lambda();
    task_bind();
    task_thread();
}

```

正如示例代码展示的那样，std::packaged\_task会将任务包装为可调用对象，类似于std::bind，并且任务的结果被装入std::future，在适当的时候可以通过std::future::get来获得最终结果。

std::packaged\_task的模板参数是函数参数和返回值的类型，可以预料到的是，在构造packaged\_task对象的时候，使用了std::invoke来转发参数，实际上标准库也大都是这样做的。


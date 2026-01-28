---
title: C++ std::mutex和std::lock_guard
date: "2021-09-04 23:50:00"
tags: [C++, docs]
category: blog
---
对于单一对象的单一线程访问，天然就没有线程安全方面的问题，但是对于单一对象的多线程访问，就存在着线程访问顺序甚至指令执行顺序的问题，因此存在一些安全隐患。

为此，系统提供了互斥锁和原子指令来保证单一对象同时仅有一个线程在访问，在C++中抽象为std::mutex和std::atomic 。

<!-- more -->

参考：C++并发编程实战 第二版3.2。

书中提供了线程安全的stack模板如下：

```cpp
#include <exception>
#include <memory>
#include <mutex>
#include <stack>

struct empty_stack : std::exception
{
    const char *what() const noexcept
    {
        return "empty stack!";
    };
};

template <typename T>
class threadsafe_stack
{
private:
    std::stack<T> data;
    mutable std::mutex m;

public:
    threadsafe_stack()
        : data(std::stack<T>()) {}
    threadsafe_stack(const threadsafe_stack &other)
    {
        std::lock_guard<std::mutex> lock(other.m);
        data = other.data; // 1在构造函数体中的执行复制构造，这个复制实际上是STL内置的stack（dqueue）的复制而完成的
    }
    threadsafe_stack &operator=(const threadsafe_stack &) = delete; // 禁止对栈的赋值，但是或许可以右值引用
    void push(T new_value)
    {
        std::lock_guard<std::mutex> lock(m);
        data.push(new_value);
    }
    std::shared_ptr<T> pop()
    {
        std::lock_guard<std::mutex> lock(m);
        if (data.empty())
            throw empty_stack();                                       // 在调用pop前，检查栈是否为空
        std::shared_ptr<T> const res(std::make_shared<T>(data.top())); // 在修改堆栈前，分配出返回值
        data.pop();
        return res;
    }
    void pop(T &value)
    {
        std::lock_guard<std::mutex> lock(m);
        if (data.empty())
            throw empty_stack();
        value = data.top();
        data.pop();
    }
    bool empty() const
    {
        std::lock_guard<std::mutex> lock(m);
        return data.empty();
    }
};
```

其中有几点需要注意：

1. std::lock\_guard类模板是对std::mutex的RAII封装，用于防止忘记解锁以及出现异常时不能被解锁，保证一定程度的线程安全
2. `mutable std::mutex m;` 的作用是在声明为const的函数里对std::mutex进行修改，通过std::lock\_guard，因为只想保护内部数据，而不是保护互斥器不被修改
3. 这个类中大部分成员函数的第一句都是 `std::lock_guard<std::mutex> lock(m)`，即进入函数时构造std::lock\_guard（加锁），退出函数时自动调用析构函数（解锁），因此保证中间部分的执行不会和其他线程并行执行
4. 这个中间部分由于锁的存在保持了原子性，即这个操作在开始执行前，数据是预期状态，执行后，数据也是预期状态（不存在和其他线程的竞争数据）

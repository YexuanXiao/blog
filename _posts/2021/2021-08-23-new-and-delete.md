---
title: C++ new和delete
date: "2021-08-23 17:24:00"
tags: [C++, docs]
category: blog
---
C++设计了new运算符包装了内存分配和指针转换，delete运算符用于释放内存或者析构对象。新的语法使new和delete存在自己的使用技巧。

<!-- more -->

new operator是new运算符，new运算符的作用是调用operator new函数来进行内存分配。

对于内置类型和不含重载的类，编译器会通过重载的全局 `operator new` 和 `operator new[]` 函数（模板）来申请内存空间。如果有重载的new，则使用重载的版本（尽量不要重载全局的new）。

由于STL实际上包含多种重载的new，截止到目前（C++17-23），标准库一共重载了22种new：[operator new, operator new\[\]](https://en.cppreference.com/w/cpp/memory/new/operator_new)。

语法：

`::(可选) new (布置参数)(可选) (类型) 初始化器(可选)`

`::(可选) new (布置参数)(可选) 类型 初始化器(可选)`

最基本的new的重载版本有2个，简称为第一类new：

```cpp
void* operator new  ( std::size_t count );
void* operator new[]( std::size_t count );
```

第一个版本用于分配单个对象，第二个版本用于分配多个对象。

值得注意的是，第二个版本实际上会带来额外开销：这个数组的首个4bit实际上会储存该数组的大小（称为overhead）。

第二类new是C++17开始使用内存对齐的new，其第二个参数是对齐的字节数，同样重载了两个版本。

这个版本由编译器进行调用，不需要传入对齐参数，在C++17开始为默认：[/Zc:alignedNew (C++17 over-aligned allocation)](https://docs.microsoft.com/zh-cn/cpp/build/reference/zc-alignednew?view=msvc-160)

第三类new是不抛出异常的new，表示new分配失败时返回空指针。

```cpp
void* operator new  ( std::size_t count, const std::nothrow_t& tag);
new(nothrow) int(10);
```

还有一类new称为布置（placement） new，其多了一个参数是分配的起始位置（指针）。

这类new不能重载，实际上是由编译器对两个版本的new进行再次重载的结果：

```cpp
new(mem) int(10);
```

mem是一个指针，这个指针可以是堆上的也可以是栈上的。

使用new分配的内存需要使用delete进行释放，使用new\[\] 分配的内存需要使用delete\[\] 进行释放，由于overhead的存在，二者不能混用。

此外重载全局的new和delete实际上不会被调用，请使用成员函数。

<div class="ref-label">参考</div>
<div class="ref-list">
<a href="https://zh.cppreference.com/w/cpp/language/new">
new表达式
</a>
<a href="https://zh.cppreference.com/w/cpp/memory/new/operator_new">
operator new, operator new[]
</a>
</div>

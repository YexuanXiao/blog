---
title: One exception to rule them all
date: "2024-01-20 05:03:00"
tags: [C++]
category: blog
---
本文简单讨论了不同高级编程语言如何表达以及处理错误，并介绍了C++中新的解决方案。

<!-- more -->

## 不同语言的错误处理

### 错误如何表达？

不同语言给出了不同答案：

- 以C为代表的错误码或errno对象
- 以C++为代表的异常对象
- 以Scala为代表的“函数式”结果对象

问题：不同库，不同开发者的喜好不一致，使得用户常常需要在不同的错误码和错误对象间转换

如何处理错误：不同开发者给出了不同答案：

- 完整的保留全部信息
- 终止程序，避免程序以不正确的状态运行
- 收缩或者在合适的时机忽略

问题：用户必须写出繁琐的代码（错误和正常的逻辑掺杂）、被迫终止程序（非bug情况是不可接受的）、错误的收缩（产生bug或者丢失信息）

例子：A库使用错误类型 _A_，B库使用错误类型 _B_，而C库需要在一个函数内调用A库和B库的函数，如何准确的将 _A_ 和 _B_ 传递给C库的调用者？

例子：互联网服务读取JSON中的值，当JSON中的值可能不合法时，如何编写代码处理？

主流语言都广泛使用以上两种或者三种方式，加上不同开发者存在不同的喜好，使得编写代码时时刻面临抉择

### 什么是理想的错误处理？

- 不丢失信息及终止程序
- 不需要调用者转换错误
- 不强制调用者处理错误

### C++异常的问题

- 允许抛出任何类型，难以确定异常对象含义
- 异常对象一定需要堆分配（支持跨线程传递），效率低
- 捕获时类型匹配复杂，效率低

## 解决方案

### 标准错误码和错误对象

Niall Douglas的C++标准提案 [status\_code and standard error object](wg21.link/P1028) [^1] 给出了一种统一的表示方法，旨在解决上述问题：如何表达错误

[^1]: 之所以叫status\_code是因为C++ 11已经使用了error\_code

P1028的核心设计是std::status\_code和std::status\_code\_domain

status\_code实际持有两个成员，一个是指向status\_domain对象的指针，一个是status\_domain中定义的value\_type类型的错误对象。

status\_domain的作用是提供错误码的元数据以及提供错误之间转换的操作，这些元数据以及转换API被实现为虚函数。

status\_domain虽然有虚函数，但status\_domain的所有特殊成员函数都是平凡的，这意味着status\_domain满足字面类型的要求，可以有constexpr的对象。

每一个status\_code\_domain对象储存一个用户提供的唯一ID，该ID用来区分不同的domain，通常由随机数生成器生成，该ID的类型是不小于64位的无符号整数。

在处理错误（捕获时），不同domain之间通过该ID来识别。

status\_code\<void\> 是不持有错误对象的特化，它持有一个指向domain的指针，并且它是平凡的。
template\<typename DomainType\> status\_code\<DomainType\> 是持有错误码的主模板，它继承status\_code\<void\> 并额外储存一个value\_type类型的对象。

### Herbceptions

Herb Sutter在2018年的时候提出了一种解决异常性能问题的新异常方案 [Herbceptions](wg21.link/p0709)，该方案保持现有异常的基本结构：throw以及try，catch块，同时简化异常对象的传递以及消除对RTTI的依赖。

Herbceptions的核心方案是以值的形式抛出一个小对象，该对象足够小，小到可以被储存在函数栈中向下传递，使抛出异常后不再依赖复杂的异常对象管理函数管理异常对象。同时，提供一种不需要RTTI的手段来区分来自不同库，不同功能的异常，也就是std::status\_code的最终目的。

status\_code在Dauglas的提案中是允许任意大小的，但能用于Herbceptions的类型一定满足value\_type的对象可以被储存到寄存器中，此时满足Herbceptions的要求。

在可以预见的未来，会有3种value\_type类型被广泛使用：整数，指针以及std::exception\_ptr。

当value\_type为整数类型时，代表该类（domain）的错误只表达错误本身，而不需要提供额外的信息，如标准库将提供status\_code\<errno\> 来表示POSIX错误，以及status\_code\<DWORD\> 来表示Win32错误。

当value\_type为指针类型时，表示该类错误需要携带额外信息，在抛出时，用户负责申请动态内存储存T的对象，并将指针储存到status\_code中。用户在捕获后可获得该指针，并从该指针中提取数据，以及释放内存。

当value\_type为std::exception\_ptr时，代表该异常是源自旧C++异常（例如std::exception），这是过渡方案。

捕获时，首先解引用捕获的期待对象的domain对象的指针，然后调用domain的比较函数判断期待和目标的domain是否相等，如果返回true，即期待domain能处理目标domain的错误，进行第二步，判断期待和目标是否表示一个错误，如果是一个错误，那么进入当前catch块，如果不等，那么进入下一个catch块。

由于判断domain是否相等是独立的步骤，因此当一次判断返回false时，可以跳过所有期待domain是当前期待domain的catch块。

---
title: 如何消费连续范围和连续迭代器
date: "2025-06-03 10:02:00"
tags: [C++, docs]
category: blog
---
连续迭代器是C++17中引入的新概念，连续迭代器支持的操作几乎完全和随机访问迭代器相同，但连续迭代器允许使用迭代器解引用后对象的地址来作为迭代器使用。一般来说，用户在使用迭代器时不需要关心迭代器的性质，只需要使用标准库提供的算法就能完成任务并且实现自动优化，但连续迭代器的性质使得我们可以进行一些低级操作，而不依赖标准库算法，此时就需要正确理解它。

<!-- more -->

今年进入标准的缺陷解决方案[P3349 Converting contiguous iterators to pointers](//wg21.link/p3349)正式确定了 `std::to_address` 是从连续迭代器获得指针的便捷方法，在新版标准库中，它在C++20模式也有效。

连续迭代器允许转换为指针，带来了两点好处：

+ 指针的迭代是不抛出异常的，因此将连续迭代器转换为指针再迭代不需要担心异常安全
+ 一些低级（通常是C风格）的范围API接受指针作为参数，连续迭代器支持使用它们

大部分用户可能还习惯于C++98风格的迭代器范围，即首迭代器和尾后迭代器具有相同类型，但C++17对范围for的改进以及C++20的范围库支持了哨位类型，使得尾后“迭代器”并不满足任何迭代器，只需要支持和首迭代器进行比较。

问题1：不能对“尾后迭代器”使用 `std::to_address`：因为它不保证是迭代器。正确使用方法是 `std::to_address(first) + std::distance(first, last)`，或者 `std::to_address(first) + (last - first)`。注意，如果使用 `last - first`，需要保证先计算差再计算和，否则会由于越界而产生UB，所以还是推荐使用 `std::distance` 或者 `std::ranges::distance`。

问题2：从连续迭代器获得的指针可能和目标类型的指针不一致：`std::vector<short>` 显然可以用于初始化 `std::vector<int>`，但从它们的迭代器得到指针不是兼容类型。因此，不要在确定了迭代器是连续迭代器后就盲目的把它传递给目标类型的指针，应该验证迭代器的值类型是否等于目标类型。使用 `std::contiguous_iterator<U> && std::is_same_v<value_type, std::iter_value_t<U>>` 和 `std::ranges::contiguous_range<R> && std::is_same_v<value_type, std::ranges::range_value_t<R>>` 可以做到这一点。

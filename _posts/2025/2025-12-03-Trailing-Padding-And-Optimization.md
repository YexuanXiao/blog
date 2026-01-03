---
title: 为什么编译器不能优化尾部具有填充字节的对象的复制
date: "2025-12-03 00:31:00"
tags: [C++, docs]
category: blog
---

原因：尾部填充可能被派生类重用，编译器在代码生成时必须防止派生类的对象被以这种方式破坏，因此无法进行优化。

<!-- more -->

今天有人问我为什么有填充字节，可平凡复制的对象的复制不能被优化成 `memcpy`，并给出了如下代码：

```cpp

#include <type_traits>
#include <cstddef>

struct A {
    short a{};
    char y{};
    // char z{};
};

static_assert(std::is_trivially_copyable_v<A>);

void copy(A * __restrict__ dst, A *__restrict__ from, std::size_t n) {
    for (std::size_t i = 0; i != n; ++i) {
        dst[i] = from[i];
    }
}

```

他发现把注释取消后，编译器就可以将 `copy` 优化为 `memcpy`。

然而他问题没分析对，实际上将 `A::a` 移动到最后面，编译器也能优化 `copy` 函数为 `memcpy`。

```cpp

struct A {
    char y{};
    short a{};
};

```

为什么会有这种现象？原因是，尾部填充字节可以被派生类的子对象重用，因此尾部填充字节不允许被以任何形式修改。这方面Itanium ABI和MSVC ABI应该都有规定。

在这个例子里，虽然提问的人可以看出不存在这种重叠，但编译器前端发出IR时就需要遵守ABI，而优化器显然不会无中生有复制填充字节，因此会错失这种优化机会。或者编译器前端实现某种强大的静态分析技术，能够和提问的人一样一眼看出循环体是实现了在内存上的连续复制，不过这显然没什么意义。

因此，这个例子告诉我们应该使用标准库（包括 `memcpy` 本身）来进行内存复制而不是使用自己写的循环，因为 `memcpy` 实现里写死的 `simd` 代码显然已经做出了连续赋值的假定。C++标准库的 `copy` 等函数也会静态分发到 `memcpy` 上。

注意，这个问题只影响对象复制不影响对象创建，因为即使存在派生类，基类也是比派生类子对象更早初始化的。

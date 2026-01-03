---
title: C++ initializer_list
date: "2021-08-14 06:40:00"
tags: [C++, docs]
category: blog
---
initializer\_list是C++11开始通过标准模板库（STL）提供的一个类模板，它使函数能够非常轻松的使用同类不定长参数。

<!-- more -->

根据上文 [C++聚合类，字面值常量类和constexpr构造函数](/blog/2021/08/13/Aggregate-class-and-constexpr-Constructor/) 已经知道了constexpr构造函数的使用方法，而initializer\_list就是使用constexpr构造函数，并且配合编译期的“黑魔法”来实现的“模板”。

libstdc++ 中initializer\_list实现如下：

```cpp

namespace std {
  template<class E>
    class initializer_list {
    public:
      typedef size_t 		size_type;
      typedef const E* 	const_iterator;

    private:
      iterator			M_array;
      size_type			M_len;

      // The compiler can call a private constructor.
      constexpr initializer_list(const_iterator a, size_type l)
      : M_array(a), M_len(l) { }

    public:
      constexpr initializer_list() noexcept
      : M_array(0), M_len(0) { }

      // Number of elements.
      constexpr size_type size() const noexcept { return M_len; }

      // First element.
      constexpr const_iterator begin() const noexcept { return M_array; }

      // One past the last element.
      constexpr const_iterator end() const noexcept { return begin() + size(); }
    };
}

```

代码非常简单：

1. 使用类模板去定义通用数据类型 \_E
2. 成员包括一个起始指针和一个元素个数
3. 所有成员函数都是constexpr函数
4. 使用constexpr构造函数并且使用初始化列表进行构造

以上这些特性使initializer\_list为字面值常量类，使得编译期可以在编译期尽情优化。

而其中有一个编译期的**黑魔法**，是那个私有constexpr构造函数，这个函数是被编译器使用的（而不是自己调用）。

通过代码你会发现，initializer\_list的**迭代器为简单的const指针**，也就代表其中每个元素都是相同的类型。

标准库中许多容器都添加了initializer\_list类模板作为构造函数的参数，使其能够在初始化阶段同时装填多个数据。

那么自定义的类也可以使用initializer\_list：

```cpp

class FooVector
{
    std::vector<int> content_;

public:
    FooVector(std::initializer_list<int> list)
    {
        for (auto it :list)
        {
            content_.push_back(it);
        }
    }
};

int main(){
    FooVector foo = { 1, 2, 3, 4, 5 };
    FooVector foo2{ 1, 2, 3, 4, 5 };
    FooVector foo3({ 1, 2, 3, 4, 5 });
}

```

由于initializer\_list**有自己的迭代器（或者重载全局迭代器）**，并且指针作为迭代器能递增，能解引用，能判断不等，所以其**支持范围for循环**。

上面我说到，迭代器的有参构造函数属于编译期的**黑魔法**，所以initializer\_list**不能作为函数的返回值类型**（不能复制或者移动）。

initializer\_list还可作为函数参数，用法和构造函数类似，只不过不用赋值运算符，而是用函数调用运算符（类似foo3）。

最后要注意的是，**使用initializer\_list初始化并不是聚合初始化**，这两个概念不能混用。

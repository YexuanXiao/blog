---
title: constexpr 函数，对象和常量求值中的内存分配
date: "2025-05-09 13:59:00"
tags: [C++, docs]
category: blog
---
C++20 的一个重大功能是支持在常量求值中进行内存分配，但如何编写这样的代码？C++11 发明 `constexpr` 后，该关键词的适用范围得到了数次扩张，从结果来说，已经需要“士别三日，当刮目相看”了。

<!-- more -->

### constexpr 对象

C++11 设计之初，受到编译器的水平限制，`constexpr` 对象不能有非平凡的构造和析构函数，因此，该变量必须用初始化器列表进行默认初始化或者使用常量表达式进行初始化。

从 C++20 开始，具有非平凡的构造函数或者析构函数的类型也可以具有 `constexpr` 对象。

`constexpr` 变量必须使用*明显常量求值表达式*初始化。*明显常量求值表达式*是 C++ 标准要求该表达式必须为常量表达式的表达式，例如数组下标和非类型模板实参。

`constexpr` 变量可以使得表达式的值转化为常量，作为静态数据储存在程序中，从而被其他代码使用。

### constexpr 函数

C++ 11 设计之初，受到编译器的水平限制，`constexpr` 函数只允许有一条 `return` 语句来执行逻辑，函数体里剩下只能写 `using` 指令/`using` 声明或者静态断言等非逻辑语句。

从 C++14 开始，该要求被放宽，函数中可以出现任意语句，同时不能出现 `goto` 和 `try`（自然也包括 `catch`）。同时，`constexpr` 函数中声明的对象需要是 `constexpr` 的。

从 C++20 开始，允许 `try`，但不允许控制流进入 `catch`，任何异常抛出时都会导致编译失败。

`constexpr` 函数内部调用的所有函数都必须为 `constexpr`，`constexpr` 函数内部也可以声明非 `constexpr` 的对象。此时由于允许在常量求值中进行内存分配（后文会详细介绍），C++20 已经可以实现在编译期使用 C++ 的大部分功能了。

从 C++23 开始，任何函数都可以声明 `constexpr`，但当中间有表达式的结果不能常量求值且在常量求值时使用该函数时，编译会报错。

Q: 为什么 C++ 23 不能默认所有函数都 `constexpr`？

A: C++11 设计时，`constexpr` 函数默认 `inline`，这在当时是有一定道理的，因为 `constexpr` 函数必须定义在头文件里才能被常量求值，而定义在头文件里需要 `inline` 来支持重定义，因此在 C++11 时，非 `inline` 的 `constexpr` 函数如果允许存在，那一定是错的。同时， **`inline` 是 ABI 的一部分**：`inline` 函数不必产生外部可见的符号，因此如果 C++23 将所有函数默认为 `constexpr`，将导致原来代码中的非显式 `constexpr` 的函数在链接时找不到符号，或者显式 `constexpr` 的函数失去允许重定义功能，无论如何都会破坏程序。

C++20 和 C++23 做的所有努力都是为了一件事：**复用运行期代码**。使用 C++20/23 标准后不需要为相同功能开发出编译期或者运行期使用的两个库，例如不再需要 `constexpr_vector` 和 `std::vector` 同时存在，`std::vector` 也可以在常量求值时使用，这是一个颠覆性的突破。

C++20 同时发明了 `consteval` 函数，`consteval` 函数是必须在编译期计算完成的函数，`consteval` 函数不会在编译结果中产生任何逻辑代码，是对 `constexpr` 函数的补充（`constexpr` 函数在*明显常量求值表达式*中才一定在编译期计算）。

`constexpr` 函数和 `consteval` 函数如果能够常量求值，那么其结果可以*用于初始化 `constexpr` 对象*。

### 常量求值中的内存分配

C++20 允许常量求值时使用 `::new` 和 `::delete`，该特性是配合 `constexpr` 函数中可以出现非 `constexpr` 变量。

从 C++20 开始，编写这样的代码成为可能：

```cpp

consteval/constexpr std::vector<char> foo() {
    std::vector<char> x;
    x.append_range("must allocate");
    return x;
}

static_assert(foo().size() == 14);

```

注意，变量 `x` 不具有也不能为 `constexpr`，这是 C++ 标准为了保持 `constexpr` 和 `consteval` 在此处行为一致而设置的怪癖。同样的限制发生在所有 `constexpr` 变量上，**无论它具有何种储存期**。

例如：

```cpp

consteval/constexpr std::vector<char> foo() {
    std::vector<char> x;
    x.append_range("must allocate");
    return x;
}

auto constexpr y = foo(); // 无法编译！

consteval bar() {
    constexpr auto x = foo(); // 无法编译！
}

```

相同问题的表现还包括：`constexpr` 函数只可以在*明显常量求值表达式*中使用 `consteval` 函数，也就是说

```cpp

consteval std::vector<char> foo() {
    std::vector<char> x;
    x.append_range("must allocate");
    return x;
}

constexpr void bar() {
    auto x = foo(); // 无法编译！
}

constexpr void bar() {
    constexpr auto x = foo().size(); // 没问题！
}

```

C++20 开始，为什么 `constexpr` 的行为这么怪异成为了一个频繁讨论的话题。

在编译期调用 `::new` 会发生什么？答案其实不复杂，编译器会如同分配发生在自己程序中一样，分配一样大小的内存。因此，这块内存在**运行编译器的设备**中，而不是在用户的电脑中。那么，以上列出的一些行为就可以得到解释：

```cpp

consteval/constexpr std::vector<char> foo() {
    std::vector<char> x;
    x.append_range("must allocate");
    return x;
}

constexpr auto y = foo(); // 无法编译！因为 foo 的返回值储存在运行编译器的设备中

```

编译器程序中分配的内存应该由编译器程序自己释放，而不是由结果程序释放。因此，当编译完成后，常量求值时分配的任何内存都会*失效*。

```cpp

consteval/constexpr std::vector<char> foo() {
    std::vector<char> x;
    x.append_range("must allocate");
    return x;
}

static_assert(foo().size() == 14); // 可以编译！因为编译器检查静态断言成立后，
                                   // 就可以释放结果的内存
                                   // 静态断言的条件是明显常量求值表达式
constexpr auto z = foo().size();   // 编译器将结果储存在编译后的程序文件中
                                   // 同时由于用于初始化 constexpr 变量 z，
                                   // foo().size() 是明显常量求值表达式

```

### constexpr 和 consteval 的传染性

C++20 引入了 `consteval` 函数，`consteval` 函数的结果一定被常量求值，因此 `consteval` 函数的结果一定是常量表达式。

而 `constexpr` 函数是可用于常量表达式：标准要求 `constexpr` 函数在不作为*明显常量求值表达式*的一部分时，可以*变为运行期求值*。因此，`constexpr` 函数中对 `consteval` 函数的调用必须作为*明显常量求值表达式*使用：

```cpp

consteval std::vector<char> foo() {
    std::vector<char> x;
    x.append_range("must allocate");
    return x;
}

constexpr void bar() {
    auto x = foo(); // 无法编译！因为 constexpr 函数 bar 的子表达式 foo()
                    // 只用于常量表达式，不能在运行期求值
}

```

因此，可以说 `constexpr` 函数和 `consteval` 函数具有一定的*传染性*。

### 结论

- 通过使得表达式为*明显常量求值表达式*，能够使得 `consteval` 函数和 `constexpr` 函数被编译期计算，结果可以储存在 `constexpr` 变量中。
- 否则，如果调用者是 `constexpr`：被调用者也必须是 `constexpr`，被调用者是 `consteval` 编译会失败，被调用者既不是 `constexpr` 也不是 `consteval` 时，该函数不能常量求值。
- 否则，如果调用者是 `consteval`：被调用者必须是 `consteval` 或者是 `constexpr`，否则会编译失败。

---
title: 深入C++模块
date: "2026-06-22 14:06:22"
tags: [C++,docs]
category: blog
---

之前的文章[C++ 模块](/blog/2022/08/28/Cpp-Module/)介绍了模块的基本概念和语法，但仍然缺乏系统性的指导。该文章总结了我过去使用模块的经验，对于大部分人来说应该足够了。

<!-- more -->

### 预处理器

模块不改变以往的预处理器的运作方式，因此可以正常使用 `#include` 指令。

`import 模块名;` 和 `module 模块名;` 也是预处理指令，不能使用宏替换来展开成它们，而且必须独占一行。对 `module 模块名;` 的处理早于条件编译，因此，不能使用条件编译来选择性开启它们。普通的 `export` 声明不是预处理器指令，不受前述限制。

```cpp
// 尝试用宏控制声明和导入的模块的名字也是无效的
#define X a;
#define Y b;
export module X; // 声明模块X
import Y; // 导入模块Y
#endif
```

```cpp
// 尝试用宏控制是否声明模块是无效的
#ifdef DECLARE_MODULES
export module A; // 即使DECLARE_MODULES未定义，也会将该文件解析为模块接口单元
#endif
```

```cpp
#define EXPORT export
EXPORT module A; // 非法的，不是模块声明
```

推荐做法是在lib.h内使用 `EXPORT` 宏控制导出的声明，然后在cpp声明和导入模块：

```cpp
// lib.h
#ifndef IMPL_MODULE
#ifndef EXPORT
#define EXPORT
#endif
#include <standard_library>
#endif
EXPORT struct bar {};

// module.cpp
export module A;
import std;
#define IMPL_MODULE
#define EXPORT export
#include "lib.h"
```

使用这种方式时，lib.h和模块实现完全是隔离的。

由于模块不能导出宏，模块导入后的内容也和上下文无关，因此一个模块库如果想要提供宏给用户，需要单独把宏隔离为独立的文件。

如果某个库支持使用宏进行配置，那么在改造为模块后，应该在编译模块的时候设置宏定义来进行配置。

可以使用一个config.h，让用户在config.h中提供定义，然后在模块实现文件中 `#include "config.h"` 来实现配置效果。`__has_include` 指令可以测试config.h是否存在，非常有用。

```cpp
// my_lib.cpp
module my_lib;
#if __has_include("my_lib_config.h")
#include "my_lib_config.h"
#endif
// 使用配置宏来控制库的行为，例如：
#ifdef MY_LIB_USE_FEATURE_X
// ...
#endif
```

如果用户提供了 `my_lib_config.h`，其中的宏会被包含并生效；如果没有，库则使用默认行为。

### 模块实现单元和模块接口单元

区分模块实现单元和模块接口单元一般有两个作用。

首先就是隔离实现和接口，如果有些定义不以源码发布，那么在开发时，将这些定义放在模块实现单元中进行开发，将模块接口单元分发给用户。

其次是仅修改模块实现单元的内容后，依赖该模块的代码不需要重新构建，对于大型代码库这可以加快迭代流程。

```cpp
// math.cpp
export module math;
export int add(int a, int b);

// math_impl.cpp
module math;
int add(int a, int b) {
    return a + b;
}
```

当仅修改 `math_impl.cpp` 中 `add` 的实现细节时，所有依赖模块math的翻译单元都不需要重新编译，因为它们只依赖于模块接口。

注意模块分区也支持模块实现单元和模块接口单元的区分，因此使用模块分区实现单元也可以避免不必要的构建。

```cpp
// math.cpp
export module math;
export import :detail;

// math-detail.cpp
export module math:detail;
export int add(int a, int b);

// math-detail_impl.cpp
module math:detail;
int add(int a, int b) {
    return a + b;
}
```

修改 `math-detail_impl.cpp` 同样不会触发依赖 `math` 的代码重新构建。

### 模块分区和多个模块的选择

一般来说，如果你的项目是一个库，那么将该库包装为单一模块是没问题的，这也是标准库目前的方式。因此，如果你是个新手，我强烈建议不要花时间在模块分区上。

当你已经将库实现为模块，并且熟悉模块的各种实现方式后，你才应该尝试模块分区。

使用模块分区一般有两个目的：

1. 提高并行度
2. 向着纯模块发展，也就是说将该项目改造为几乎不使用 `#include`

如果你开发的库的规模非常大，并且各个功能边界清晰，那么使用多模块也是没问题的，单一模块毕竟将所有接口都声明在了一个模块里，减少导入的模块的内容可以避免解析不需要的数据来加速编译和减小内存使用。

如果你开发的是终端软件，那么就不需要为了方便用户使用而编写单一模块，因此也不需要使用模块分区。此时使用多个模块是合适的选择。

多模块的一个限制是，如果类A在模块A声明，那么在模块B中就不能提供A的定义，或者说，模块B中的定义不认为是对模块A的声明的补全，而模块分区无此限制。如果你的代码依赖这种模式，那么必须放在一个模块里，或者使用模块分区。

错误例子：

```cpp
// A.cpp
export module A;
export class Widget; // 仅前向声明

// B.cpp
export module B;
import A;
// 试图补全Widget的定义，但这会创建B的Widget，而不是A的Widget
class Widget {
    void do_something();
};
```

若使用模块分区，补全定义是合法的：

```cpp
// widget.cpp
export module widget;
export import :fwd;
export import :impl;

// widget-fwd.cpp
export module widget:fwd;
export class Widget;

// widget-impl.cpp
module widget:impl;
import :fwd;
class Widget {   // OK，属于同一模块 widget，是对widget:fwd中前向声明的补全
    void do_something();
};
```

我在为C++/WinRT实现模块的时候特意选的多模块而不是单一winrt模块+模块分区，就是在保证提高并行度（Windows.*.h是标准库的10倍大）的同时，避免在迭代idl的过程中需要重新构建那些和迭代的idl无关的代码。

### 避免违反ODR

模块本身没有改变任何ODR相关的规则，但模块化改造时可能导致违反ODR，产生新的违反ODR的代码，暴露违反ODR的代码，以及改变存在违反ODR的错误代码的行为。

违反ODR的首要原因是不兼容的编译选项，例如四家编译器都支持更改`char`的符号性。关于这点，由于历史问题，并没有一个可靠列表来说明哪些选项的不一致会导致违反ODR。目前实现了模块的编译器都有一个不断完善的内部列表，可以在大部分情况下报告存在兼容问题。

违反ODR的代码的错误原因大部分是由于在相同命名空间的结构体/函数在不同条件/文件下使用不同定义或者存在不同定义。

例如有些代码会检测 `NDEBUG` 宏来提供不同的定义，类似的还有Windows的 `UNICODE`和 `_UNICODE` 宏。在一个文件中定义这些宏，并在另一个文件中不定义可能会导致违反ODR。因此，需要确保这些宏被所有需要的地方一致的定义。

```cpp
// header.h
struct Data {
    int value;
#ifdef NDEBUG
    // release 下无调试字段
#else
    int debug_id;
#endif
};
```

如果在编译模块时定义了 `NDEBUG`，而导入该模块的用户代码未定义 `NDEBUG` 且包含了同一头文件，就会导致 `Data` 拥有两个不一致的定义，违反ODR。

还有一种情况是，模板特化被定义在和主模板定义/模板参数定义不同的文件中，如果用户使用的时候没有一致的包含定义特化的文件，那么就会违反ODR。

如果你的库要同时提供头文件和模块两种方式，那么就需要在模块实现内，把声明用 `extern "C++"` 标记，否则这个声明属于当前模块，和以头文件使用时，头文件内的是不同的。

```cpp
// lib.h
void lib_func();

// module.cpp，错误方式
export module lib;
#include "lib.h"   // lib_func 属于模块 lib

// module.cpp，正确方式
export module lib;
extern "C++" {
#include "lib.h"   // lib_func 现在属于全局模块
}
```

如果用户代码在一个文件中 `#include "lib.h"` 并 `import lib;`，将出现两个不同的 `lib_func` 声明，编译器会认为存在冲突的定义。如果在不同文件分别使用 `#include "lib.h"` 和 `import lib;`，则违反ODR。

严格来说，构建二进制库时使用不同版本的编译器或者不同版本的标准实际上也可能导致违反ODR，因为这也会导致产生存在差异的定义，不过实践中由于二进制在ABI层面进行了隔离，因此一般认为不会存在问题。但使用模块时，由于模块编译后储存的是编译器内部结构而不是二进制，因此不同编译器版本和不同标准编译的模块确实是不兼容的。

### inline

在C++中，`inline` 关键词一直对于“内联优化”是多余的，因为在 `inline` 关键词被发明之前，就可以声明一个 `inline` 函数，方式是让它变为一个成员函数并且定义在类的定义里，只要编译器能看到函数的定义，那么编译器当然就可以展开它。你可以阅读《C++语言的设计和演化》了解这部分历史。

模块让 `inline` 函数真正对编译器有意义：为模块内的函数添加 `inline` 会使得模块中间文件（也叫做BMI）中包含该函数的定义。这要求了模块中间文件具有储存函数定义的能力，而不仅仅储存它们的声明。因此，编译器可以在使用 `inline` 函数的地方直接展开该函数，避免了跳转和调用约定的负担。

在模块中的函数写为 `inline` 有一个新的限制，即模块内的 `inline` 函数不能调用内部链接的函数，也不能使用内部链接的变量，因为内部链接的函数和变量不是模块公开接口的一部分，所以 `inline` 函数在其他模块展开时也不能依赖它们。

还有一个模块的特殊规则是模块内的类内定义的成员函数不再是默认 `inline` 的，如果 你确实想要内联它那么需要主动声明为 `inline`。

如果你的库是纯模块的，那么你实际上可以抛弃命名空间作用域的 `inline` 了，因为不需要解决符号冲突问题。不使用 `inline` 还可以减小模块中间文件的体积。

```cpp
// mylib.h
namespace mylib {
    inline int version() { return 1; }
}

// mylib.cpp
export module mylib;
namespace mylib {
    export int version() { return 1; } // 无需 inline
}
```

你可能会担心删除 `inline` 会使得小函数失去优化的能力，不过目前C++的LTO技术（包括ThinLTO）和PGO技术（包括SPGO）已经很成熟了，甚至有bolt这种直接优化二进制的技术，要合理使用它们的效果实际上比添加 `inline` 更好。

### export using 声明

`using` 声明在一直有一个特别的作用：对于函数重载（包括重载中的函数模板），单一 `using` 声明关联所有这些重载；对于函数模板，类模板和别名模板，它关联到主模板。

而模块允许导出 `using` 声明，这代表可以使用 `using` 声明安全导出所有需要导出的东西，只要它存在，而不需要为每个重载添加 `export`，并且它可以安全的自动选择到合适的声明，而不担心为重复的声明重复添加了 `export`，或者错误的为模板特化添加 `export`。

```cpp
export module io;
namespace io {
    void print(int);
    void print(double);
    template<typename T> void print(T);
}
// 导出所有 print 重载
export namespace io {
    using io::print;
}
```

```cpp
export module containers;
namespace containers {
    template<typename T> class vector { /*...*/ };
    template<> class vector<bool> { /*...*/ }; // 特化
}
// 导出 vector 即涵盖主模板和可见的特化
namespace containters {
    export using containers::vector;
}
```

`export` 块包裹特化是无意义的，不会导出主模板或者特化，只有主模板能被导出。为特化直接添加 `export` 是语法错误，而 `using` 声明会自动处理合适的声明。

因此实现模块有两种风格：`using` 风格和直接风格。实际上libc++和libstdc++使用的是 `using` 风格，而STL使用的直接风格。

### 模块包装方案

在之前的文章我已经介绍了 `extern "C++"` 在模块的意义，即允许一个实体以模块和头文件形式暴露给使用者，并且指代相同的实体。该功能和 `export` `using` 一起使得实现模块+头文件产生了几种风格：

风格1：

```cpp
// lib.hpp

#ifndef IMPL_MODULE
#define EXPORT
#include <upstream_library>
#endif

extern "C++" {
namespace A {
    EXPORT struct x {};
}
}

// module.cpp
module;
export module A;
import std;
#define IMPL_MODULE
#define EXPORT export
#include "lib.h"
```

`extern "C++"` 也可以写在 module.cpp中，包裹 `#include "lib.h"`。

风格2：

```cpp
// lib.hpp
#ifndef IMPL_MODULE
#define EXPORT
#include <upstream_library>
#endif

extern "C++" {
namespace A {
    struct x {};
}
}

#ifdef IMPL_MODULE
export namespace A {
    using A::x;
}
#endif

// module.cpp
module;
export module A;
import std;
#define IMPL_MODULE
#define EXPORT export
#include "lib.h"
```

风格3：

```cpp
// lib.hpp

#ifndef IMPL_MODULE
#define EXPORT
#include <upstream_library>
#endif

extern "C++" {
namespace A {
    struct x {};
}
}

// module.cpp
module;
export module A;
import std;
#define IMPL_MODULE
#define EXPORT export
#include "lib.h"
export namespace A {
    using A::x;
}
```

以上三种风格要求你可以修改lib.h，如果你不能修改lib.h，那么有两种风格：

风格4：

```cpp
// lib.hpp
#include <upstream_library>
namespace A {
    struct x {};
}

// module.cpp
module;
// 重新include，或者定义保护宏来“抢占”名字避免在模块实现中包含它的内容
#include <upstream_library>
export module A;
import std;
extern "C++" {
#include "lib.h"
}
export namespace A {
    using A::x;
}
```

由于不能修改 `lib.hpp`，必须将它的内容通过 `extern "C++"` 包含，使得其中所有声明成为不属于任何模块的实体。之后再用 `export using` 将它们导出。模块之前还需额外包含 `<upstream_library>` 以满足依赖，并避免在 `extern "C++"` 块内引入不属于模块的东西。

风格5：

```cpp
// lib.hpp
#include <upstream_library>
namespace A {
    struct x {};
}

// module.cpp
module;
// 在全局模块片段中包含lib.h时不需要extern "C++"
#include "lib.h"
export module A;
import std;
export namespace A {
    using A::x;
}
```

在全局模块片段包含头文件，此时所有声明也属于全局模块，不属于当前模块 `A`。因此可以不使用 `extern "C++"` 而直接包含，然后用 `export using` 导出。这种方式看起来更简洁，但实际上它会在全局模块片段增加不必要的声明。

正如我展示的，如果你不能修改lib.h，那么你应该用 `using` 风格而不是重新声明。

```cpp
// module.cpp
module;
#include "lib.h"
export module A;
import std;
export namespace A {
    struct x; // 不好的写法
}
```

这样重新声明 `struct x` 的潜在风险是，如果lib.h更新时删除了 `x`，那么模块 `A` 就导出了一个自己的 `x` 的声明，导致代码的行为发生改变或者产生难以读懂的错误，例如违反ODR。

### 导入后包含

标准中并没有禁止对相同的对象，先导入后包含是错误的（例如标准库），但从GCC，Clang和MSVC的实现结果来说，先导入后包含存在许多BUG，因此目前可以认为这是共性：

```cpp
#include <vector>
import std; // 没有问题
```

```cpp
import std;
#include <vector> // 可能会导致错误
```

造成这种情况的原因可能是由于C++语法较复杂，先导入后包含时，需要编译器一边进行语法分析，一边进行重复声明的合并，增加了实现的复杂度。

当代码是先包含再导入时，编译器只需要进行语法分析，分析完成后才进行重复声明的合并，相对来说更简单。

因此，目前应保证先导入后包含，如果实在不能避免该问题，可以考虑使用本文的上述说明的方法，为这些头文件增加模块包装器，将它们改写为模块以解决该问题。

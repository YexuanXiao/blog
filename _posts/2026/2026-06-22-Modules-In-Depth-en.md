---
title: Modules In Depth
date: "2026-06-22 14:06:22"
tags: [C++, docs]
category: blog
---

The previous article [C++ Modules](/blog/2026/05/05/Cpp-Module/) introduced the basic concepts and syntax of modules, but still lacked systematic guidance. This article summarizes my experience using modules over the past years and should be sufficient for most people.

<!-- more -->

### Preprocessor

Modules do not change the way the preprocessor works, so you can still use `#include` directives normally.

`import module_name;` and `module module_name;` are also preprocessor directives; they cannot be expanded via macro substitution and must occupy a line by themselves. The handling of `module module_name;` occurs before conditional compilation, so you cannot use conditional compilation to selectively enable them. Ordinary `export` declarations are not preprocessor directives and are not subject to the above restrictions.

```cpp
// Attempting to control the names of declarations and imported modules with macros is also invalid
#define X a;
#define Y b;
export module X; // declares module X
import Y;         // imports module Y
#endif
```

```cpp
// Attempting to control whether a module is declared via macros is invalid
#ifdef DECLARE_MODULES
export module A; // Even if DECLARE_MODULES is not defined, this file will be parsed as a module interface unit
#endif
```

```cpp
#define EXPORT export
EXPORT module A; // Illegal, not a module declaration
```

A recommended practice is to use the `EXPORT` macro inside `lib.h` to control exported declarations, and then in the `.cpp` file declare and import the module:

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

With this approach, `lib.h` and the module implementation are completely isolated.

Since modules cannot export macros, and the contents after importing a module are context independent, if a module library wants to provide macros to users, it must isolate the macros into a separate file.

If a library supports configuration via macros, then after converting it to a module, you should set the macro definitions at compile time to configure the module.

You can use a `config.h` file: let users provide definitions in it, and then `#include "config.h"` in the module implementation file. The `__has_include` directive is very useful for testing whether `config.h` exists.

```cpp
// my_lib.cpp
module my_lib;
#if __has_include("my_lib_config.h")
#include "my_lib_config.h"
#endif
// Use configuration macros to control library behaviour, e.g.:
#ifdef MY_LIB_USE_FEATURE_X
// ...
#endif
```

If the user provides `my_lib_config.h`, its macros will be included and take effect; otherwise, the library uses default behaviour.

### Module Implementation Units and Module Interface Units

Distinguishing between module implementation units and module interface units generally serves two purposes.

First, it separates implementation from interface. If some definitions are not distributed in source form, you can put them in module implementation units during development and distribute only the module interface units to users.

Second, after modifying only the contents of a module implementation unit, code that depends on that module does not need to be rebuilt. For large codebases, this can speed up the iteration cycle.

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

When you modify only the implementation details of `add` inside `math_impl.cpp`, no translation unit that depends on module `math` needs to be recompiled, because they depend only on the module interface.

Note that module partitions also support the distinction between implementation and interface units, so using partition implementation units can also avoid unnecessary builds.

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

Modifying `math-detail_impl.cpp` likewise does not trigger rebuilding of code that depends on `math`.

### Module Partitions vs. Multiple Modules

Generally speaking, if your project is a library, it is fine to wrap it as a single module. This is also how the standard library is currently provided. Therefore, if you are a beginner, I strongly advise not to spend time on module partitions.

Only after you have already implemented your library as a module and are familiar with the various implementation approaches should you try module partitions.

Using module partitions usually serves two purposes:

1. Improving parallelism
2. Moving toward a pure‑module approach. i.e., transforming the project so that it uses almost no `#include`

If the library you develop is very large and the boundaries between functionalities are clear, using multiple modules is also acceptable. A single module declares all interfaces in one module; reducing the amount of imported module content can avoid parsing unnecessary data, speeding up compilation and reducing memory usage.

If you are developing end‑user software, you do not need to provide a single module for user convenience, so module partitions are unnecessary. In that case, using multiple modules is appropriate.

One limitation of multiple modules is that if class `A` is declared in module `A`, then module `B` cannot provide a definition of `A`; in other words, definitions in module `B` are not considered to complete declarations from module `A`. Module partitions do not have this restriction. If your code relies on this pattern, you must put it in a single module or use partitions.

Incorrect example:

```cpp
// A.cpp
export module A;
export class Widget; // only forward declaration

// B.cpp
export module B;
import A;
// Attempt to complete Widget's definition – this creates B::Widget, not A::Widget
class Widget {
    void do_something();
};
```

With module partitions, completing the definition is legal:

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
class Widget {   // OK, belongs to the same module widget, completes the forward declaration in widget:fwd
    void do_something();
};
```

When I implemented modules for C++/WinRT, I deliberately chose multiple modules rather than a single `winrt` module with partitions. That way, I improved parallelism (Windows.*.h files are about 10 times larger than the standard library) while avoiding rebuilding code unrelated to the IDL being iterated.

### Avoiding ODR Violations

Modules themselves do not change any ODR related rules, but modularisation can introduce new ODR violations, expose existing ones, or change the behaviour of buggy code that already violates the ODR.

The primary cause of ODR violations is incompatible compilation options – for example, all four major compilers support changing the signedness of `char`. Historically, there is no definitive list of which options cause ODR violations when inconsistent. Compilers that have implemented modules maintain an internal list that is constantly improved, and in most cases they can report compatibility issues.

Most ODR violations are caused by structures/functions in the same namespace having different definitions under different conditions or in different files.

For instance, some code checks the `NDEBUG` macro to provide different definitions; similarly, Windows' `UNICODE` and `_UNICODE` macros. Defining these macros in one file and not defining them in another can lead to ODR violations. Therefore, you must ensure that such macros are defined consistently everywhere they are needed.

```cpp
// header.h
struct Data {
    int value;
#ifdef NDEBUG
    // no debug field in release
#else
    int debug_id;
#endif
};
```

If `NDEBUG` is defined when compiling the module, but user code that imports the module does not define `NDEBUG` and includes the same header, `Data` will have two inconsistent definitions, violating the ODR.

Another case is when a template specialization is defined in a different file from the primary template / template parameters. If a user does not consistently include the file containing the specialization, an ODR violation occurs.

If your library is to be provided both as headers and as modules, you must mark declarations inside the module implementation with `extern "C++"`; otherwise, those declarations belong to the current module and are different from the ones in the header when used as a header.

```cpp
// lib.h
void lib_func();

// module.cpp, incorrect way
export module lib;
#include "lib.h"   // lib_func belongs to module lib

// module.cpp, correct way
export module lib;
extern "C++" {
#include "lib.h"   // lib_func now belongs to the global module
}
```

If user code in one file does `#include "lib.h"` and `import lib;`, there will be two different declarations of `lib_func`, and the compiler will consider them conflicting. If they are in different files that respectively use `#include` and `import`, it violates the ODR.

Strictly speaking, building binary libraries with different compiler versions or different standard versions can also cause ODR violations because they lead to differing definitions. In practice, however, binaries are isolated at the ABI level, so this is generally not considered problematic. With modules, since compiled modules store compiler internal structures rather than binaries, modules built with different compiler versions or different standards are indeed incompatible.

### inline

In C++, the `inline` keyword has long been redundant for "inline optimization," because even before the `inline` keyword was invented, one could declare an `inline` function by making it a member function defined within the class definition — as long as the compiler could see the function definition, it could certainly expand it. You can read *The Design and Evolution of C++* to learn about that history.

Modules make the `inline` function truly meaningful to the compiler: adding `inline` to a function within a module causes the module's intermediate file (also known as BMI) to include the definition of that function. This requires that the module intermediate file have the ability to store function definitions, not just their declarations. As a result, the compiler can expand the `inline` function directly at the call site, avoiding the overhead of jumps and calling conventions.

There is a new restriction on functions written as `inline` in modules: an `inline` function inside a module cannot call functions with internal linkage, nor can it use variables with internal linkage, because functions and variables with internal linkage are not part of the module's public interface, so the `inline` function cannot rely on them when expanded in other modules.

Another special rule for modules is that member functions defined inside a class within a module are no longer `inline` by default; if you really want to inline it, you need to explicitly declare it as `inline`.

If your library is purely modular, you can actually dispense with `inline` at namespace scope, because there is no need to resolve symbol collision issues. Not using `inline` can also reduce the size of the module intermediate file.

```cpp
// mylib.h
namespace mylib {
    inline int version() { return 1; }
}

// mylib.cpp
export module mylib;
namespace mylib {
    export int version() { return 1; } // no need for inline
}
```

You might worry that removing `inline` would cause small functions to lose optimization opportunities, but by now C++'s LTO technologies (including ThinLTO) and PGO technologies (including SPGO) are quite mature, and there are even technologies like BOLT that directly optimize binaries. Using them appropriately can actually yield better results than adding `inline`.

### Export Using Declarations

`using` declarations have always had a special role: for function overloads (including function templates among the overload set), a single `using` declaration brings in all those overloads; for function templates, class templates, and alias templates, it refers to the primary template.

Modules allow exporting `using` declarations, which means you can safely export everything you need with a single `using` declaration, as long as the entity exists, without having to add `export` to each overload individually. Moreover, it automatically selects the appropriate declarations, avoiding the risk of adding duplicate `export` to repeated declarations or incorrectly adding `export` to specialisations.

```cpp
export module io;
namespace io {
    void print(int);
    void print(double);
    template<typename T> void print(T);
}
// Export all print overloads
export namespace io {
    using io::print;
}
```

```cpp
export module containers;
namespace containers {
    template<typename T> class vector { /*...*/ };
    template<> class vector<bool> { /*...*/ }; // specialization
}
// Exporting vector covers the primary template and visible specialisations
namespace containters {
    export using containers::vector;
}
```

Wrapping a specialization in an `export` block is meaningless, it does not export the primary template or the specialisation; only the primary template can be exported. Adding `export` directly to a specialization is a syntax error, whereas the `using` declaration handles the appropriate declarations automatically.

Thus, there are two styles for implementing modules: the `using` style and the direct style. In practice, libc++ and libstdc++ use the `using` style, while the STL uses the direct style.

### Module Wrapping Strategies

In the previous article I already explained the meaning of `extern "C++"` in the context of modules, it allows an entity to be exposed to users both as a module and as a header, referring to the same entity. Together with `export using`, this gives rise to several styles for providing both a module and a header.

Style 1:

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

`extern "C++"` can also be placed in `module.cpp` wrapping the `#include "lib.h"`.

Style 2:

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

Style 3:

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

All three styles above require that you can modify `lib.h`. If you cannot modify it, there are two alternative styles:

Style 4:

```cpp
// lib.hpp
#include <upstream_library>
namespace A {
    struct x {};
}

// module.cpp
module;
// Re‑include, or define guard macros to “reserve” names so that their content is not included in the module implementation
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

Because you cannot modify `lib.hpp`, you must include its contents inside `extern "C++"` so that all declarations become entities not belonging to any module. Then you use `export using` to export them. Before the module, you also need to additionally include `<upstream_library>` to satisfy dependencies and avoid bringing non‑module things into the `extern "C++"` block.

Style 5:

```cpp
// lib.hpp
#include <upstream_library>
namespace A {
    struct x {};
}

// module.cpp
module;
// Including lib.h in the global module fragment does not require extern "C++"
#include "lib.h"
export module A;
import std;
export namespace A {
    using A::x;
}
```

Including the header in the global module fragment makes all declarations belong to the global module, not to the current module `A`. Therefore, you can include it directly without `extern "C++"` and then use `export using` to export. This looks cleaner, but it actually adds unnecessary declarations to the global module fragment.

As I have shown, if you cannot modify `lib.h`, you should use the `using` style rather than redeclaring.

```cpp
// module.cpp
module;
#include "lib.h"
export module A;
import std;
export namespace A {
    struct x; // poor practice
}
```

The potential risk of redeclaring `struct x` is that if `lib.h` removes `x` in a future update, module `A` would export its own declaration of `x`, causing the code's behaviour to change or producing hard to read errors, such as ODR violations.

### Include After Import

The standard does not forbid including the same thing after importing it (e.g., the standard library), but from the implementation results of GCC, Clang, and MSVC, there are many bugs when including after importing. At present, we can consider this a common pitfall:

```cpp
#include <vector>
import std; // fine
```

```cpp
import std;
#include <vector> // may cause errors
```

The reason is probably the complexity of C++ syntax: when including after importing, the compiler must perform parsing and merging of duplicate declarations simultaneously, increasing implementation complexity.

When the code includes first and imports later, the compiler only needs to parse first, and merging is done after parsing, which is relatively simpler.

Therefore, for now you should ensure that imports come before includes. If you really cannot avoid this issue, you can consider using the wrapping techniques described above - create module wrappers for those headers, turning them into modules to solve the problem.

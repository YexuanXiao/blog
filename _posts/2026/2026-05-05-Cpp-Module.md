---
title: C++ Modules
date: "2026-05-05 16:11:00"
tags: [C++]
category: blog
---
An important feature of C++20 is modules, a completely new way of organising source files. It aims to solve the problems of overly large translation units and repeated template instantiations caused by the traditional source‑file inclusion model, thereby speeding up compilation.

<!-- more -->

### Module Units

A module unit is a translation unit, but not in the traditional sense of a translation unit that produces intermediate representation (IR) or machine code (binary). Instead, it is a new kind of module translation unit based on the C++ abstract machine.

A module unit consists of a global module fragment, a module declaration, a module implementation, and an optional private module fragment. The global module fragment and the private module fragment are optional:

```cpp
// moduleLib.cpp
module; // prologue of the global module fragment
// contents of the global module fragment
export module module_name; // module interface unit declaration
// module module_name;    // module implementation unit declaration
// module implementation
module :private;
// private module fragment implementation
```

If a module declaration does not have `export`, the file is a module implementation unit.

A module declared with `export` is a module interface unit; the rest are module implementation units. A module must have exactly one module interface unit. Module implementation units with the same name automatically obtain the declarations from the module interface unit.

Module names may contain dots (`.`). The dot has no special meaning, but by convention it indicates a hierarchical relationship.

Names beginning with `std` cannot be used as module names; they are reserved.

`import module_name;` imports a module, and `export import module_name;` causes translation units that import the current module to also import the dependency module A.

Note that `import module_name;` and `module module_name;` are also preprocessor directives, and they are processed before macro substitution and conditional compilation.

### Exporting Content

```cpp
// helloworld-impl.cpp
module helloworld;       // module implementation unit

export void hello() {
    std::cout << "Hello world!\n";
}

export {
    int one()  { return 1; }
    int zero() { return 0; }
}

// helloworld.cpp
export module helloworld; // declare a module and serve as the module interface unit

export void hello();      // declare an exported function

// main.cpp
import helloworld;        // import the module

int main() {
    hello();
}
```

Only declarations exported inside a module interface unit can be imported and used outside the module. The module interface unit determines the visibility of declarations.

Note that when `export` is applied to classes, unions, and enums, it distinguishes between declaration and definition. If a declaration appears in the module interface unit and the definition in a module implementation unit, the definition is visible but not reachable (see later).

If a declaration is exported by module A, it cannot be defined in module B, but specialisations are allowed in module B (provided A is imported).

Follow these principles:

1. Only module interface units can export.
2. Full template specialisations, partial specialisations, static assertions, and C++26 `consteval` blocks do not need to be exported.
3. If overloads exist, non‑exported overloads are not visible to external translation units, but are visible within the same module.
4. For a `using` declaration that names functions, all associated overloads are exported.

### Modules and Namespaces

Modules and namespaces are orthogonal; they are not alternatives. Namespaces can be used inside modules, and a namespace may have the same name as the module that contains it.

Exporting a namespace exports the declarations within it, and those declarations still belong to that namespace.

```cpp
module M;

export namespace N {}
```

An unnamed namespace cannot be exported because declarations inside it have internal linkage. Similarly, a function or variable declared `static` cannot be exported, as those also have internal linkage.

### Module Partitions

A module partition is a module unit. A module partition must be imported, directly or indirectly, by the primary module:

```cpp
// A-B.cpp   
export module A:B;

// A-C.cpp
module A:C;

// A.cpp
export module A; // declares the primary module unit A and makes partitions B and C accessible

import :C;
export import :B;
```

A module partition unit is also a module unit. All declarations and definitions inside a module partition are visible in the module unit that imports it, regardless of whether they are exported.

A module partition may be a module interface unit. To export a partition, it must be re‑exported by the primary module interface unit.

```cpp
// A.cpp
export module A;     // declare module interface unit A
export import :Foo;  // import and export module partition A:Foo
export int baz();    // export function

// A-Foo.cpp
export module A:Foo; // declare a module partition Foo of A, which is also an interface unit
import :Internals;   // import A:Internals
export int foo() { return 2 * (bar() + 1); } // export function

// A-Int-impl.cpp
module A:Internals;  // declare partition Internals; only module A can access it because it is not declared as an interface unit
int bar();

// A-impl.cpp

module A;
export import :Foo;  // import and export partition Foo
int bar() { return baz() - 10; }
int baz() { return 30; }
```

There can be at most one module partition with a given name.

Module partitions allow you to organise and extend a module, but declarations that need to be exported must be exported inside the module interface unit.

### Global Module Fragment

The global module fragment serves to isolate definitions/declarations that do not belong to the current module.

```cpp
module;  // optional prologue, indicates that the following is the global module fragment

// Only preprocessor directives may appear here
#define _MSC_VER 1932
#ifdef _MSC_VER
#include <win_impl.h>
#endif

export module A; // the global module fragment can only appear at the top, immediately followed by a module declaration
```

Declarations indirectly declared in the global module fragment belong to the global module, not to the current module. The global module fragment together forms the global module.

In addition, sometimes you need global preprocessor directives for control, e.g., choosing different headers depending on the platform; you can also include them in the global module fragment.

### Visibility and Reachability

If a name in a module translation unit is not exported, it is not visible to external translation units, and name lookup cannot find it.

If the definition of a class, union, or enumeration is in a module implementation unit and is not exported, its definition is not reachable; it cannot be used, and the type is considered incomplete.

### Private Module Fragment

The private module fragment defines a module implementation area that is not a separate module unit, and it can only be accessed by the current module. A module may have at most one private module fragment.

The private module fragment is typically used to implement the entire module in a single file. It is similar to a module implementation unit, but resides in the module interface unit file.

```cpp
export module SingleFile;

// interfaces

module :private;

// implementations
```

Declarations and definitions inside the private module fragment are neither visible nor reachable.

### extern "C++"

C++98 introduced `extern "C"` and `extern "C++"`. For a long time, `extern "C++"` had no practical effect. C++20 repurposed it.

When a declaration marked `extern "C++"` is part of a module implementation, it belongs to the global module. This feature allows a library to be used both as a module and as a header file.

### In Practice

In practice, the module interface unit plays the role of the former header file, and the module implementation unit plays the role of the source file.

For header‑only libraries or libraries that can be distributed in source form, it is generally unnecessary to distinguish between interface and implementation units.

If you need to export macros, you can isolate them in a separate header file and then `#include` it in the global module fragment.

When traditional headers are needed, they should also be included in the global module fragment.

### How Modules Speed Up Compilation

Modules speed up compilation in four ways:

1. Modules avoid repeatedly parsing source text into internal structural representations and performing syntactic analysis. This is similar to precompiled headers.
2. Module units can be compiled independently into object files without repeated code generation. This is something precompiled headers cannot achieve.
3. Modules no longer need `inline` to generate weak symbols for avoiding symbol conflicts, so the linker does not need to deduplicate weak symbols.
4. Modules can cache template instantiation results, saving the compiler from repeated instantiations and also reducing linker pressure.

<div class="ref-label">References</div>
<div class="ref-list">
<span>
ISO/IEC 14882:2020 Programming languages — C++
</span>
<a href="https://en.cppreference.com/w/cpp/language/modules">
Modules
</a>
<a href="https://chuanqixu9.github.io/c++/2025/08/14/C++20-Modules.en.html">
C++20 Modules: Practical Insights, Status and TODOs
</a>
</div>

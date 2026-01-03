---
title: C++ inline说明符
date: "2022-01-08 18:00:00"
tags: [C++,Standard]
category: blog
---
inline是从C继承来的关键词之一，但是C++的inline在不断的增强下几乎完全失去了原本的意义，几乎不再有指导编译器内联优化的作用，反而变为了解决标识符重定义的工具。

<!-- more -->

### 标准

### 9.2.8 The inline specifier \[dcl.inline\]

1. The **inline** specifier shall be applied only to the declaration of a variable or function.

2. A function declaration (9.3.4.6, 11.4.2, 11.9.4) with an **inline** specifier declares an _inline function_. The inline specifier indicates to the implementation that inline substitution of the function body at the point of call is to be preferred to the usual function call mechanism. An implementation is not required to perform this inline substitution at the point of call; however, even if this inline substitution is omitted, the other rules for inline functions specified in this subclause shall still be respected.

   \[_Note 1_ : The **inline** keyword has no effect on the linkage of a function. In certain cases, an inline function cannot use names with internal linkage; see 6.6. — _end note_\]

3. A variable declaration with an **inline** specifier declares an _inline variable_.

4. The **inline** specifier shall not appear on a block scope declaration or on the declaration of a function parameter. If the inline specifier is used in a friend function declaration, that declaration shall be a definition or the function shall have previously been declared inline.

5. If a definition of a function or variable is reachable at the point of its first declaration as inline, the program is ill-formed. If a function or variable with external or module linkage is declared inline in one definition domain, an inline declaration of it shall be reachable from the end of every definition domain in which it is declared; no diagnostic is required.

   \[_Note 2_ : A call to an inline function or a use of an inline variable can be encountered before its definition becomes reachable in a translation unit. — _end note_\]

6. \[_Note 3_ : An inline function or variable with external or module linkage has the same address in all translation units.
   A **static** local variable in an inline function with external or module linkage always refers to the same object. A type defined within the body of an inline function with external or module linkage is the same type in every translation unit. — _end note_\]

7. If an inline function or variable that is attached to a named module is declared in a definition domain, it shall be defined in that domain.
   \[_Note 4_ : A constexpr function (9.2.6) is implicitly inline. In the global module, a function defined within a class definition is implicitly inline (11.4.2, 11.9.4). — _end note_\]

### 9.2.8 inline说明符 \[dcl.inline\]

1. **inline** 说明符应只应用于变量或函数的声明。

2. 函数声明 (9.3.4.6, 11.4.2, 11.9.4) 包含 **inline** 说明符声明了*内联函数*。内联说明符向实现（编译器）表明，在调用点上对函数主体的内联替换要优于通常的函数调用机制。实现不需要在调用点遵守这种内联替换；但是，即使省略了这种内联替换，本条款中规定的内联函数的其他规则仍应得到遵守。
   \[_Note 1_ : **inline** 关键词对函数的链接没有影响。在某些情况下，内联函数不能使用具有内部链接的名称；见6.6 。 — _end note_\]

3. 带有 **inline** 说明符声明的变量是*内联变量*。

4. **inline** 内联说明符不得出现在块范围声明或函数参数的声明中。如果在友元函数声明中使用内联指定符，该声明应该包含定义，或者该函数之前已经被内联声明。

5. 如果函数或变量的定义在其第一次声明为内联时是可以达到的（即，有非inline版本的定义），那么该程序非良构。如果具有外部或模块链接的函数或变量在定义域中被内联声明，那么它的内联声明应可从声明它的每个定义域的末端到达（即每次都有内联声明）；不需要诊断。

   \[_Note 2_ : 对内联函数的调用或对内联变量的使用可以在其定义在翻译单元中可达之前遇到。在翻译单元中可达的定义之前，可以遇到对内联函数的调用或内联变量的使用。 — _end note_\]

6. \[_Note 3_ : 具有外部或模块联系的内联函数或变量在所有翻译单元中具有相同的地址。
   具有外部或模块链接的内联函数中的**静态**局部变量总是指向同一个对象。在具有外部或模块链接的内联函数的主体中定义的类型在每个翻译单元中都是相同的类型。 — _end note_\]

7. 如果附属于命名模块的内联函数或变量被声明在定义域中，它应被定义在该域中。
   \[_Note 4_ : constexpr函数 (9.2.6) 隐式内联。在全局模块中，定义在类中的函数隐式内联 (11.4.2, 11.9.4)。 — _end note_\]

### 解释

#### inline函数

- inline函数不一定被编译器内联，非inline函数也有可能被内联。
- inline函数可以在同一个翻译单元有多个定义，而非inline函数只允许有多个声明，不允许有多个定义，但是两者在同一翻译单元中至少有一个定义。
- inline函数虽然允许有多个定义，但是编译器并会检查多个定义是否相同，存在不同定义的结果是未定义的。
- 如果一个声明带有inline，那么相同定义的函数都应该有inline。
- inline函数默认具有内部链接。如果需要导出，需要使用extern，确保有至少一个实现，否则会发生链接错误。
- 直接在类内定义的函数默认inline，无论是否是友元函数，静态成员函数还是普通成员函数。在类外部由作用域运算符定义的函数默认非inline。
- 可以在定义之前使用inline函数，但是必须在当前翻译单元有定义。

#### inline变量

- inline变量只允许出现在函数外部。
- inline变量允许在不同翻译单元中有多个相同定义，而非inline变量不允许。
- inline变量被所有具有相同定义的翻译单元共享。
- 命名空间作用域的inline const（constexpr）变量默认具有外部链接（导出）。

---
title: C++类的继承
date: "2021-02-01 22:00:00"
tags: [C++,docs]
category: blog
---
继承是C++类的另一个非常重要的特性。

<!-- more -->

## 访问权限

C++中类的成员有3种访问权限：public，private和protected。

对于一个类来说，public下的成员可以在类外被取得和调用，而private和protected下的成员只能由成员函数和友元函数取得和调用。

### 派生类

一个类可以派生自多个类，它可以从多个基类继承数据和函数。类派生列表以一个或多个基类命名，形式如下：

`class derived-class: access-specifier base-class`

例如：

```cpp
class A: public Base {};
class A: public Base1, public Base2 {};
```

### 派生类访问权限规则

如果未使用访问修饰符access-specifier，则默认为private。

- public继承: private无法直接访问，public和protected权限不变。
- protected继承: private无法直接访问，public变为protected。
- private继承: private无法直接访问，public和protected变为private。

同时，派生类可以通过基类public权限的成员函数访问基类中private权限的成员。

<br>

|方式\\基类| public | protected | private |
|:-:|:-:|:-:|:-:|
| public | public | protected | \* |
| protected | protected | protected | \* |
| private | private | private | \* |

<br>

|访问\\权限| public | protected | private |
|:-:|:-:|:-:|:-:|
| 本类 | 是 | 是 | 是 |
| 派生类 | 是 | 是 | 否 |
| 外部 | 是 | 否 | 否 |

一般来说，继承权限尽量使用public。

### private和protect的区别

- 对基类来说private和protected在访问权限上是一样的。
- 派生类无法访承基类的private，可以访承基类的protected。

_**通俗的说，protected是继承后可以访问的private。**_

### 成员继承规律

一个派生类继承了所有的基类成员（包括private权限的成员），但下列情况**除外**：

- 基类的构造函数，析构函数和复制构造函数。
- 基类的重载运算符。
- 基类的友元函数。

## 同名处理规则

当基类和派生类出现同名成员时，需要使用作用域运算符访问基类成员。

当派生类中存在与基类同名的成员函数时，此时遵循C++函数重载规则：派生类仅可以直接重载派生类中的重载函数。

对于静态成员变量，既可以使用对象调用变量，也可以直接通过作用域运算符访问（a是基类的一个静态成员变量）：`Der::a = 0;` `Base::a = 0;` `Der::Base::a = 0;`。

对于多继承而言，如果两个基类中有成员变量或者成员函数重名，那么需要使用作用域去区分。

如果遇到A是B，C的基类，B，C又是D的基类的情况，那么对于A中的成员来说，在D中就有2份。为了解决这个问题，引入虚继承的方式继承A类：

```cpp

class B: virtual public A {};
class C: virtual public A {};

```

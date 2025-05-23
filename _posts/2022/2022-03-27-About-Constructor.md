---
title: 构造函数和 C++ 的哲学
date: "2022-03-27 20:56:00"
tags: [C++,Philosophy]
category: blog
---
知乎的一个问题[Go、Rust、Nim等新兴语言，为什么都抛弃了constructor？](https://www.zhihu.com/question/36586808)可能说出了很多人心中的疑惑，Makoto Ruu 的[回答](https://www.zhihu.com/question/36586808/answer/1433329762)可以说是精确说出了 C++ 的构造函数的设计哲学，现将回答转载至此，著作权归原作者所有。

<!-- more -->

为构造函数赋予特殊的语法地位，并不总是一种画蛇添足。在不同的场合下，专用的构造函数，和语法地位与普通函数没有任何差别的工厂函数，可能有着不同的优劣对比。

先来看工厂函数优于构造函数的方面：

- 降低语法复杂度，回避使用者需要记忆太多特殊规则的心智成本。
- 可以和普通函数一样自由传递，交由各种需要回调的地方，免去需要将特殊语法（`new` 之类）再包一层的麻烦。
- 可以更加灵活的定制构建对象的方式。构造函数的硬性局限在于无法改变调用之前即已分配内存、形成尚待初始化的空架子的固定操作。若特殊的逻辑需要改变这种默认行为则无法实现，包括但不限于：
  - 特定条件下返回空指针/引用。
  - 特定条件下不去新分配对象，而是返回一个别处已有的对象。
  - 在不同条件下分别构建不同的子类型。
  - 平时使用对象的方式并非通过其本身，而是通过某种包装或代理（如智能指针），希望简化构建过程。
  - 在异常发生时，因故不想通过抛异常来解决，而是通过特殊返回值、回调、外部状态等不打破常规执行流的方式进行反映。

可见其中很多场合是现实中不可避免的，所以实际编程中，工厂函数一定会被用到，哪怕语法中已经提供了专门的构造函数也是一样。于是用户时刻面临两种选择，需要仔细思考每个具体地方应该使用哪种，心智的开销、需求变化或单纯误用之后被迫重构的麻烦，都会不断引起反思。事实上，既然其中一种所能涵盖的用场确实是另一种的超集，所以，最终产生是否工厂函数其实可以包办一切、构造函数是否只是多余累赘的念头也是顺理成章。很难说，那些干脆没有构造函数语法概念的新生代语言完全没有受到这种观念的影响。

那么，这种观念是否总是正确呢？不妨就回来接着看下反面，构造函数优于工厂函数的方面：

**封装性**。只有通过构造函数才能建立对象内部状态的一致性，外部代码没有机会来产生非法的对象状态，从而规避了各种误用导致的 bug。这点靠工厂函数是做不到的，因为无法限定用户只能通过工厂函数来创建对象，既然对象的类型本身必须公开（否则外界没法使用），外界就可以通过字面量来创建此种对象，而其内部状态无从经历专业的初始化，显然是非法的。此时类型作者针对用户的、对于类型使用方式的约束，只能通过文档、约定等“人治”的方式来进行，而不能经由编译器、检查器来形成“法制”的硬性保证。这给了用户犯错的机会，是一定程度上对软件工程质量进行了妥协。在具有构造函数概念的语言中，常见的“私有构造函数”套路就是为此而设，但在没有构造函数概念的语言中却无从实施。

实际上，从结论上讲，工厂函数包办一切并没有彻底解决上述的二选一负担，依然在很多时候，还残留下了工厂和字面量的二选一（Go 程序员们想必有所体会，但 Rust 通过字段必须全部赋值的规则可以规避本条）。

**常量成员的初始化**。很多语言具有常量成员的语法功能，只在构造函数中能够赋值，此外的地方则只读。说到底依然是封装性，封装性是广义的概念，其边界并不一定等于类型的边界，实际上，任何功能独立、边界清晰的代码单元都可以进行各种程度的封装，构造函数和常量成员所共同构成的集合同样可以视作一个小小的封装单元，对外界的使用方式进行了一定约束。而其目的，与别处的封装性相同，依然是为了代码质量，从“法制”上杜绝各种误用，一方面降低 bug 概率，另一方面也提高理解代码的容易度。而工厂函数，因为地位与普通函数并无区别，所以无法建立起与特定对象类型的特别联系，从而对对象内容具有特别的操作权限。

\*\*给持有对象类型、但不持有工厂函数的用户以创建同型新对象的能力。\*\*语法上，构造函数是类型的一部分，而工厂函数并不是（哪怕业务上的确是，也不能被语法系统所识别）。创建同类对象并不一定是指克隆现有对象（这种通过普通方法即可实现，并不需要构造函数），也可以是给出全新参数、创建完全不同的个体。一个例子是扩展容器容量的场合：新增的槽位需要新创建的对象来填充。引用语义时填充空值这种取巧办法且略去不谈，若是值语义、或是引用语义也可能要求空值安全的场合则如何？常见的方案可能要求对象具备无参构造函数，以生成默认值对象。

不光 C++ 常用，连 C\# 这种也专门设立了 `new()` 的泛型约束。但无参也仅仅是个低保，还有时候是需要构建非默认的对象内容的。STL 有 `emplace` 一族，虽然只能插入一个元素，但这也只是库作者的选择而已，若想实现一次插入多个同样的非默认对象也并无难点。这都是拜构造函数所赐（是不是 placement 倒不是重点），若想靠工厂，就只能用一个额外的参数把函数传进去了，除编码繁冗外，开销也侵入到了运行时，而非构造函数方式的零开销抽象。或者还有说，这种靠普通的静态成员函数也能实现，并非一定要构造函数。也是事实，单从语法层面确实此处构造函数并无任何特别。但从习俗和便利方面，使用构造函数依然是比强求用户实现某个静态函数要来得人性化和通用化的。试想，在传统上众多可以使用默认隐式无参构造的场合，难道用户也要给随手定义的众多琐碎类型统统实现一个指定的静态方法？另外，若缺乏业界统一标准，不同的库会不会要求用户实现不同的静态方法？

以上最后一条或可视作小众场合，不做过多计较。事实上，最大的着眼点依然在于封装性。构造函数对对象创建的一切入口，从“法制”而非“人治”的层面，有着严密、完备、无所遗漏的接管，并严格杜绝一切产生非一致的非法对象状态的可能性。比起“创建对象”的作用本身，这种“完备”才是其真正意义所在。

在笨重臃肿的软件架构日益受到诟病、乃至连 OO 的“政权合法性”都日益受到挑战的今天，或许强调这种名词并不容易引起共鸣。但实际上，封装性真的只是 OO 的一部分吗？不妨设想，如果完全扔掉封装性，则 OO 会变成怎样？—— 答案是，其实不会怎样，封装性其实是 OO 中最可有可无的一部分。有诸多动态语言，事实上就是几乎没有一点封装性，但表达能力上并没有受到任何影响，照样 OO 得欢。在它们里，可能构造函数才是真正的画蛇添足，模仿残余，完全去掉也没有关系。

比起这点小小侧面，不如说它们欠缺的是整个的“法制”系统，所以才会项目一大就不免在“人制”方面如临大敌，各种规范限制工具辅助严阵以待不敢怠慢，一时爽火葬场的段子广为流传。这也是对本质的一种揭示，说到底，封装性是一种“减法”，并非为软件建模提供什么功能和方便，而正是以提供“不便”的方式，来对人员过度自由的行为进行约束，从而一方面提高软件质量，另一方面提升代码的可读性和可理解性，从而使语言的工程能力得到飞跃。极端一点说的话，弱类型语言才是自由度更大的，一块内存一时可以当整数、一时可以当字符串、再一时还能当指针，按说功能只会是强类型语言的超集。但大规模用起来会是什么感觉想必也显而易见。

然而这也并不是在对某一类语言进行彻底否定，因为世上存在各种各样的领域，没有一把锤子能够普遍适应，天下也不尽是大型工程，在需要轻快敏捷的地方非要套用一大堆严谨规则也是自找麻烦。所以每种语言也有自己的选择，针对预定的问题域被打造成了特定的样子。如何认清自己所面临的问题域，选择最合适的工具，从而避免削足适履的麻烦，发挥最大的应有效用，才是语言的使用者需要始终思考的主题。

<hr>

萧叶轩评：

Bjarne Stroustrup 在《C++ 程序设计语言》第一章说过：

> 上述这些设计和编程风格的强大在于它们的综合，每种风格都对综合起到了重要作用。而这种综合实际上就是 C++。因此，只关注一种风格是错误的：除非你只编写一些玩具程序，否则只关注一种风格会造成开发上的浪费，产生非最优的（不灵活的、冗长的、性能低下的、不宜维护的等等）程序。
> <br>......<br>
> 上述这些风格并非可相互替代的不同选择：每种风格都为表达力更强，效率更高的程序设计风格贡献了重要的技术，而 C++ 为这些风格的组合使用提供了直接支持。

在《C++ 语言的设计和演化》：

> 我当时强烈地感到（现在依然如此），在写每个程序的时都不存在某种唯一的正确途径，而作为程序设计语言的设计者，也没有理由去强迫程序员使用某种特定的风格。但是在另一方面，他们也确实有义务去鼓励和支持各种各样的风格和实践。只要那些东西已经被证明是有效的。他们还应该提供适当的语言特性和工具，以帮助程序员避免面公认的圈套和陷阱。

总的来说，**C++ 是一种偏向学术性质的语言**：C++ 有“民主的”标准委员会，标准委员会要考虑多个角度：数学、逻辑、实用，甚至是对 C 和老标准 C++ 的兼容性。C++ 在语言设计上，相信程序员对自己使用的功能（或者说特性）都有足够的了解，并且相信程序员能够在 C++ 提供的多种范式中选择出合适的（最起码要无误）；C++ 也从来不限制你选择某种范式。这些的组合就是 C++ 的设计哲学。

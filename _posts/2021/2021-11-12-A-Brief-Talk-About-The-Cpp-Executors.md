---
title: 浅谈The C++ Executors
date: "2021-11-12 02:43:00"
tags: [C++, docs]
category: blog
---
就在2021年7月6号，Executors提案又有了亿点点的更新。新的Paper [P2300R1](http://open-std.org/JTC1/SC22/WG21/docs/papers/2021/p2300r1.html)，正式命名为 `std::execution`，相较于The Unified Executor for C++，[P0443R14](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p0443r14)，更系统地阐述了Executors的设计思路；给出了在实现上更多的说明；删除了Executor Concept，保留并确立了Sender/Receiver/Scheduler模型；给出了库里应有的初始算法集合，并对之前的算法设计有不小的改动；还有更多明确的语义如任务的多发射（multi-shot）和单发射（single-shot），任务的惰性（lazy）与及时（eager）提交，等等。笔者业余时间实践的Excutors库也正好实践完成了[P1879R3](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p1897r3.html)的内容，在  `std::execution` 发布的里程碑，借鄙文与大家简单聊聊Executors。

<!-- more -->

**本文转载自知乎用户[@Madokakaroto](https://www.zhihu.com/people/Madokakaroto)所写文章[浅谈The C++ Executors](https://zhuanlan.zhihu.com/p/395250667)。著作权归原作者所有。**

## 1\. Why Executors?

C++一直缺乏可用的并发编程的基础设施，而从C++11以来新引入的基础设施，还有boost，folly等第三方库的改进，都有或多或少的问题和一定的局限性。

### 1.1 `std::async` 并不async

让时间回到C++11标准的近代。C++11标准正式引入了统一的多线程设施，如`<thread>`，`<atomic>`, `<mutex>` 和 `<conditional_variable>` 等low-level的building blocks；也引入了发起异步函数调用的接口 `std::async`。可 `std::async` 并不async。借用cppreference上的示例来说明：

```cpp

std::async([]{ f(); }); /*a temp std::future<void> is constructed*/
/* blocked by the destructor of std::future<void> */
std::async([]{ g(); });

```

以一般理性而言，执行函数g的任务可能在函数f执行的时候，发起调度。但是如上所列代码使用 `std::async` 的方式，发起执行函数g的任务调度，一定发生在执行函数f的任务返回之后 [^1] 。原因是：

- 第一行 `std::async` 创建了一个类型为 `std::future<void>` 的临时变量Temp；
- 临时变量Temp在开始执行第二行之前发生析构；
- `std::future<void>` 的析构函数，会同步地等操作的返回，并阻塞当前线程。

[^1]: 编者注：该问题在之前的文章[C++ std::async](/blog/2021/11/05/std-async/)中提到过，准确来讲就是：std::async返回的std::future是一个纯右值，那么此时如果不选择去使用左值去移动性的接收返回值，则此纯右值会在下一条语句执行前被析构，这将导致调用std::async的线程被该析构过程阻塞，造成事实上的同步执行，而不是异步，因此会造成严重的设计缺陷。

`std::async` 在初期还会为每一个发起的任务，创建一个新的执行线程。因此， `std::async` 臭名昭著。这里既然提到了 `std::future`，它同样也有不少的问题。

### 1.2 Future/Promise模型的演进

[Future/Promise](https://en.wikipedia.org/wiki/Futures_and_promises)模型是一个经典的并发编程模型，它提供给程序员完整的机制来控制程序的同步和异步。C++11中也引入了Future/Promise机制。Future本质上是我们发起的一个并发操作，而Promise本质上则是并发操作的回调。我们可以通过Future对象等待该操作和获取操作的结果，而Promise对象则负责写入返回值并通知我们。C++中典型的Future/Promise的实现如下图所示：

![Future/Promise](//static.nykz.org/blog/images/2021-11-12/Future_Promise.avif "candark")

如图所示，Future与Promise会有指向同一个共享的状态对象Shared State的共享指针（`std::shared_ptr` of Shared State），当Promise对象接受到返回值或者错误之后，通过条件变量通知另一端等待的Future对象。Future对象则可以通过Shared State对象中的状态，来判断接收到回调之后是继续处理业务还是处理错误。由于C++标准中的Future/Promise并不能表达任务的前置与后置的依赖关系，该模型很难满足实际的生产环境。

时间来到的当代，也就是C++14至C++17的时代，有不少类库试图解决这些问题。例如给予Future/Promise表达前置后置依赖的能力（`folly::future`）；能够Fork与Join的能力（`boost::future`）；还有为Future/Promise模型的后置任务，绑定操作Executor等。Future/Promise则改进为如下的实现：

![Improve](//static.nykz.org/blog/images/2021-11-12/Improve.avif "candark")

我们可以通过在Shared State中新增Continuations对象来表达**任务的前置后置关系**。如果需要表达 **Fork**；Continuations对象则是一个容器，同时为了保证线程安全，需要为Continuations额外准备一个Mutex对象。为了表达Join，很多库也实现了WhenAll/WhenAny算法。再就是Continuations有时候也需要制定在哪个Execution Context上执行，很多库都抽象出了 `Semi Future` 与 `Continuable Future` 等概念。还有 `Shared Future` 可以在多个Execution Context上被等待。

以上这些优化，让C++中的Future/Promise模型逐步完善，逐渐有了与DAG相同的表达能力。

### 1.3 Future/Promise模型的缺点

虽然Executors提案从12年就开始起草，但早期的Executor提案还并没有提出Sender/Recevier模型，并依然基于Future/Promsie模型来表达任务图的关系。例如，来自Google专注于并发的提案[N3378](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3378.pdf)和来自NVIDIA专注于并行的提案[N4406](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2015/n4406.pdf)，依旧使用Future/Promise，他们主要把关注点放在了任务调度的抽象上。

大家在逐步推进提案的进程，一统并发与并行的抽象时，发现Future/Promise模型并不能胜任表达任务图的工作。主要有以下几个原因：

1. Future/Promise模型总是及时地，积极地提交任务，而没有惰性提交的特性
2. 任务图中并不是所有的节点都需要Sync Point，但Shared State都创建了同步对象（Condition Variables和Mutex）
3. Shared State总是类型擦除的
4. 只能用并发来实现并行

首先，惰性提交可以保证我们创建完任务图之后再发起整个任务图的执行。这样可以带来两个好处，一个是创建任务图的过程中可以避免链接Continuations而使用锁，其次就是我们有机会分析依赖关系来应用更为复杂的调度算法。

问题2，3和4，笔者都归因于类型擦除。类型擦除的实现，使得我们把所有的问题都抛给了程序的运行时，而完全扔掉了C++强大的编译期能力。我们在使用Future/Promise的时候，已经标明了我们只关心Task的返回值:

```cpp

std::future<int> f = /* ..... */;

```

`std::future<int>` 表达了任意可以返回int类型的操作，因此它不得不丢掉任务图中的类型信息。如Continuation的函数对象类型，前置与后置任务的类型，任务图中的节点是否有同步点，Executor Context的类型等等。而泛滥的使用类型擦除的结果就是抽象不足。而抽象不足则往往会引起语法有效语义无效的实现（例如OOP中的空实现），严重的性能问题还有表达能力的缺失。例如Continuations的类型擦除会丢失inline的优化机会，Shared State的类型擦除会导致问题2与问题4的发生。

### 1.4亟需更为泛型的抽象

市面上已有的一些基于TaskNode抽象的库，例如Unity的JobSystem和UE4的TaskGraph，还有[C++ TaskFlow](https://github.com/taskflow/taskflow)，他们都是类型擦除的实现，除了它们支持了惰性提交之外，其他的问题也无法解决。

问题的答案已经很明朗了，那就是更多的泛型抽象。我们需要一个更为泛型的Executors抽象，来表达我们的任务图，调度策略，并带上执行器的类型信息；使得编译器能够有足够的机会进行激进的优化，使得调度器能够聪明地选择最优的算法，使得执行器能调度到除CPU之外的硬件中执行。这就是下一节将要介绍的The Unified C++ Executors。

## 2\. The Unified C++ Executors

The Unified C++ Executors的首要任务，就是将Future/Promise改造得更为Generic。于是就有了提案中的Sender/Receiver。这一节主要介绍关于Sender/Receiver模型的一些概念，关于Properties的内容则放到以后的文章详细介绍。

## 2.1 Sender/Receiver是泛型的Future/Promise

笔者在这里就不介绍Sender/Receiver的技术细节了，例如The Receiver Contract和各种啰嗦的Concepts与接口设计等。笔者尽量以示例和图表来阐述Executors的设计思想。我们先来看一个例子:

```cpp

using namespace std::execution;
sender auto s = 
    just(1) |
    transfer(thread_pool_scheduler) |
    then([](int value){ return 2.0 * value; });

auto const result = std::this_thread::sync_wait(s);

```

那么s的类型可能形如:

```cpp

then_sender<transfer_sender<just_sender<1>, thread_pool_scheduler_type>, lambda_type>

```

它的对象结构如下图：

![Structure](//static.nykz.org/blog/images/2021-11-12/Structure.avif "candark")

再给出一个用folly的Futures库表达的，不那么严谨的等价示例:

```cpp

auto f = folly::makeFuture<int>(1)
    .via(thread_pool_executor)
    .thenValue([](int value){ return 2.0 * value });
auto const result = f.get();

```

很显然，f的类型已经擦除为了 `future<double>`，其对象结构如下图：

![future\<double\>](//static.nykz.org/blog/images/2021-11-12/future__double__.avif "candark")

我们可以从对象结构中看到，sender对象在类型上保留了全部的类型信息:

- `then` 算法的传递进入的lambda类型
- transfer算法的sender类型
- 线程池的类型
- `just(1)` 返回的sender的类型
- 还有它们之间完整的链接关系！

相比之下，future对象结构则在类型上将这些信息完全丢弃了，只是作为运行期的数据保存于Shared State当中

Sender是泛型的Future，Receiver是泛型的Promsie，但Sender/Receiver模型的表达能力远远高于Future/Promise模型，表达能力的分析我们稍后详细展开来谈。这里值得提及的是，Sender的对象结构，大家是否似曾相识？其实Sender的这种结构，是一个典型的**表达式模板（expression template）**。表达式模板常用于**Linear Algebra Math Library和Lexer**的设计与实现中，因为表达式模板天性就是**惰性求值（Lazy Evaluation）的**，非常适合这些应用场景。Expression Template的设计模式在这里应用到Sender/Receiver模型中，再适合不过了。

### 2.2通过算法来组合Senders

2.1节中的代码使用了链式的pipe operator，如果我们用原始的算法来实现，就如下代码所示：

```cpp

using namespace std::execution;
sender auto s = 
    then(
        transfer(
            just(1), 
            thread_pool_scheduler), 
        [](int value){ return 2.0 * value; });

auto const result = this_thread::sync_wait(s);

```

其中 `just` 不以任何Sender对象作为输入，而返回一个新的Sender，它是Sender的工厂（Factories）。同样Scheduler也是工厂，因为 `scheduler.schedule()` 通常也会返回一个Sender对象。`transfer` 和 `then` 则以Sender对象，或带有其他对象作为输入，并输出Sender. 这类的算法是Sender的适配器（Adaptor）。最后， `std::this_thread::sync_wait` 则以Sender作为输入，而并不返回一个新的Sender，它是Sender对象的消费者（Consumer）。其中，消费者算法一般都不支持pipe operator，原因是担心对用户造成消费者算法还能继续有后继的误导。

Executors中的算法，一定属于这三类中的一个。当用户需要根据自己的业务情况，扩展自己的算法时，就需要确定算法属于那一类。并且还需要实现好算法对应的Sender和Receiver。通常工厂还需要实现自己的Operation State对象，因为工厂创建出的Sender往往都是一切操作的起点。P2300R1中的 [\[4.12\]](http://open-std.org/JTC1/SC22/WG21/docs/papers/2021/p2300r1.html#design-sender-factories)，[\[4.13\]](http://open-std.org/JTC1/SC22/WG21/docs/papers/2021/p2300r1.html#design-sender-adaptors) 与 [\[4.14\]](http://open-std.org/JTC1/SC22/WG21/docs/papers/2021/p2300r1.html#design-sender-consumers)，分别介绍了库中默认的三类算法的集合。

### 2.3连接Sender与Receiver

如果我们要发起一个Sender对象表达的操作，就需要将Sender与一个Recevier对象连接在一起。`std::execution::connect(sender, receiver)` 则会返回一个Concepts为 `operator_state` 的对象，并通过调用`std::execution::start(operation_state)` 发起操作执行。例如， `std::this_thread::sync_wait` 的实现，可能如下代码所示：

```cpp

struct sync_wait_t
{
    template <sender S>
    auto operator() (S&& s) const
    {
        using promise_t = get_promise_type_t<S>; // get promise type
        promise_t promise{}; // construct a promise
        _sync_primitive sync{}; // construct a synchronise primitive object
        sync_wait_receiver receiver{ promise, sync };

        // start the operation
        execution::start(execution::connect(forward<S>(s), move(receiver)));

        sync.wait(); // wait on this thread
        return promise.get_value(); // return value
    }
};

```

代码中可以看到 `std::this_thread::sync_wait` 中调用连接Sender和Receiver，并发起返回的Operation State的代码。除此之外，还在当前线程上同步地等待发起操作的完成。

\*\*Sender的组合是一个创建任务图的过程，而连接Sender与Receiver则是遍历任务图的过程。\*\*整个过程是一个深度优先的遍历，直到遍历至工厂创建的Sender。前面有提及过，工厂创建的Sender才会在与连接Receiver的时候，创建出可以发起的Operation State对象。那么，还是以文章一开始的代码为例，我们来模拟一下Connect的过程，如下图所示：

![Connect](//static.nykz.org/blog/images/2021-11-12/Connect.avif "candark")

上图展示了Sender表达式与 `sync_wait_receiver` 的连接过程的每一个步骤，可以较为清晰的看到 `sync_wait_receiver` 最终与 `just_sender` 连接起来，并创建了Operation State对象。而且，中间的每个算法的 `Receiver` 对象，以Sender相反的顺序，保存在各个连接的层级当中。任务启动以后，Operation State就会以Receiver的关系作为顺序，驱动整个任务的执行进程。

### 2.4 Sender/Receiver模型与编译期优化

泛型与惰性提交，给了编译器足够多的信息和机会进行优化。相较于Future/Promise模型，其中最大的优化就是Sender/Receiver可以抹除调Shared State的运行期开销。我们把2.1节中用Sender/Receiver实现的代码的执行过程，用图表示：

![Processing](//static.nykz.org/blog/images/2021-11-12/Processing.avif "candark")

整个过程实际上只在 `std::this_thread::sync_wait` 那里创建了一次Shared State对象。不仅如此，如果大家阅读过libunifex还可以得知，该Shared State是一个栈上对象，并没有堆分配。除此之外，lambda对象也有内联优化的机会，而不会如同Future/Promise中使用std::function进行类型擦除后，而失去内联优化的机会。内联优化，也意味着对于并行算法，还有矢量化加速的优化机会。Future/Promise不仅没有内联优化的机会，而且每一次使用链接Futures的算法API，会实打实地创建一个Shared State，也就是一个Task，这也会给运行期带来不小的开销。实际上，Future/Promise并不适合性能要求很高的生产环境，比如游戏引擎任务框架等。

Sender/Receiver可以让编译器在编译期将这些负担丢除，提升性能的同时还了增强了表达能力。激进的优化导致的结果是，**代码中的s并不是表达了一个任务链，而是一个Monad**。Sender/Receiver模型的粒度比Future/Promise的粒度更细。

## 3\. 未来的展望

P2300R1的发布，意味着Executors的迭代稳定了下来，未来将不会出现类似P0443这样脑洞大开的重构，希望 `std::execution` 能够早日进入TS阶段。 `std::execution` 中仍有不少脑洞大开的想法，在提案中悬而未决。

### 3.1 Sender/Receiver与Awaitable/Coroutine

笔者在学习 [\[The Ongoing Saga of ISO-C++ Executors\]](https://www.youtube.com/watch?v=iYMfYdO0_OU) 演讲的时候发现了 [\[P1341R0\]](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p1341r0.pdf) Paper的核心观点是：

- Awaitable可以是一个Sender
- Coroutine可以是一个Receiver

在我们的合理封装下，就能够把协程也统一起来:

```cpp

auto const result = this_thread::sync_wait(s);
auto const result = this_fiber::sync_wait(s);

```

### 3.2异构计算

标准委员会的大佬们，不遗余力地尝试使用泛型来设计Executors，还有一个原因是为了布局异构计算。 Execution Context与Scheduler等概念的抽象，可以让Executor不拘泥于只是CPU Thread。它可以是一个常规的CPU Thread，可以是一个GPU，甚至是一个Remote System。只有泛型，才能胜任这个工作，试问被Future中std::function类型擦出的函数对象，如何进行矢量化加速，如何优雅地调度到GPU上？ 泛型可以让代码的编译期上下文完整地保留到最后，也为未来创造了更多可能。

### 4\. 引用参考

1. [P2300R1 - std::execution](http://open-std.org/JTC1/SC22/WG21/docs/papers/2021/p2300r1.html)
2. [P0443R14 - The Unified Executors Proposal for C++](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p0443r14)
3. [N3378 - A preliminary proposal for work executors](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3378.pdf)
4. [N4406 - Parallel Algorithms Need Executors](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2015/n4406.pdf)
5. [P1341R0 - UNIFYING ASYNCHRONOUS APIs IN C++ STANDARD LIBRARY](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p1341r0.pdf)
6. [P1897R3 - Towards C++23 executors: A proposal for an initial set of algorithms](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p1897r3.html)
7. [P1054R0 - A Unified Futures Proposal for C++](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p1054r0.html)
8. [Facebook - Lib Unified Executor](https://github.com/facebookexperimental/libunifex)
9. [Youtube - The Ongoing Saga of ISO-C++ Executors](https://www.youtube.com/watch?v=iYMfYdO0_OU)


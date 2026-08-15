---
title: 协程的协作取消
date: "2026-08-09 20:52:00"
tags: [C++,docs]
category: blog
---

C++20的协程在大多数方面提供了非常高的灵活性，但唯有一点却相对死板，即协程的退出路径。协程只有异常和返回值两个路径可以打断协程执行，可能大部分人意识不到这有什么问题，但我认为这实际上缺了重要一环：协作取消。

<!-- more -->

在过去的几年里，我一直在思考协程如何支持取消操作。目前，终止协程执行有两种途径：返回值和抛出异常。

如果协程被取消时使用返回值（例如，检查 `std::stop_token::stop_requested`），需要将协程的返回类型改为 `std::expected`，并且还要让 `await_resume` 返回 `std::expected`。我认为这并不理想，至少这种方法并未被广泛使用。

使用异常来取消协程是流行的方法。据我所知，大多数库都采用这种方式。但这种方法也存在问题。异常的代价很高；如果子协程被取消，异常会被子协程的 `promise::unhandled_exception` 捕获，然后重新抛给父协程。这种情况会在每个协程帧上发生。

几天前，我有了一个想法：应该允许协程在暂停时被取消。想法的来源是协程的最大特点在于它可以被暂停，暂停的协程可以被销毁，暂停的协程可以被恢复，那么可不可以让暂停的协程可以被取消？我们喜欢暂停了的协程。

暂停的协程可以被销毁这点对C++格外重要，因为C++需要关注如何释放内存。既然暂停了的协程有销毁协程所具有的全部信息，那么实际上它也有取消所需要的全部信息。

销毁暂停的协程实际上可以分为两个步骤：销毁所有存活的协程体内的局部变量（这些对象是动态存活的），和销毁协程公共状态（包括参数，协程内在状态和promise，这些对象在协程整个生存期都存在）。

取消协程不是销毁协程，它注定比销毁协程做更少的事，而显然，它只有选择销毁协程局部变量这一选择。接下来我会从另一个角度解释这种做法合理性。

如何让取消协程融入到现有协程设计中？关键在于，模仿异常。协程由于异常而进入unhandled_exception后，协程不会被销毁。因此，取消协程同样不代表要立即销毁协程。抛出异常进入unhandled_exception是协程执行的一部分，那么取消协程同样也应该是协程执行的一部分。

现在我们看似得到了一个矛盾的结论：协程应该在暂停时才能被取消，但又要让取消发生在执行时。

我提出了一个我认为非常巧妙的设计：在协程暂停时，取消协程是对协程进行一个标记，恢复协程时，这个标记才真正生效，这就破解了矛盾。

也可以从另一个角度来重新认识这个设计：我发明了一个在恢复协程的瞬间立刻抛出异常的方式。但如上文所述，我们不需要真正抛出异常就可以销毁局部变量，我们已经有这些信息了！因此，在这种情况下发生的栈展开完全可以用编译器提供的销毁代码代替。

未捕获的异常会让协程执行unhandled_exception，相对的，取消了的协程应该应该也有类似的机制，因此，取消了的协程会执行unhandled_cancellation。因此，取消了的协程只需要销毁局部变量，而不需要销毁协程公共状态。

到此为止，所有问题我们都解决了。这个设计是自洽而且轻量的，编译器不需要生成额外的销毁代码，编译器只需要根据取消状态，更灵活的执行已有的代码。

我的最终设计是：

为 `std::coroutine_handle` 添加如下两个函数：

```cpp
void request_cancel() const;
```

*前条件*：`*this` 引用一个已暂停的协程，并且该协程尚未被取消。
*效果*：将协程置于已取消状态。

```cpp
bool cancel_requested() const;
```

*前条件*：`*this` 引用一个已暂停的协程。
*返回*：如果已对该协程调用了 `request_cancel()`，则返回 `true`，否则返回 `false`。

一旦协程被恢复且处于已取消状态，就会执行 `promise.unhandled_cancellation()`，随后执行 `co_await promise.final_suspend()`。

`request_cancel()` 的主要用在 `await_suspend` 内部：

```cpp
struct stop_token_awaiter
{
    std::stop_token t;
    bool cancelled = false;

    bool await_ready() { return false; }

    void await_suspend(std::coroutine_handle handle)
    {
        if (t.stop_requested())
        {
            cancelled = true;
            handle.request_cancel();
        }
    }

    void await_resume()
    {
        if (cancelled)
        {
            std::unreachable();
        }
    }
};

auto operator co_await(std::stop_token token)
{
    return stop_token_awaiter{token};
}
```

另一个用例是，当协程被提交到任务队列或调度器但被拒绝时：

```cpp
void await_suspend(std::coroutine_handle handle)
{
    if (!post_to_queue(handle))
    {
        handle.request_cancel();
    }
}
```

如果已知promise类型，则可以将 `handle` 的类型更改为 `std::coroutine_handle<promise>`，并通过promise附加更详细的取消信息。

提供 `cancel_requested()` 的目的是避免promise需要单独存储一个bool供观察者检查。

`unhandled_cancellation` 的典型用法是在promise内部存储额外的取消状态，例如将其转换为异常：

```cpp
struct task
{
    struct promise_type {
        std::exception_ptr e;
        // ...

        void unhandled_cancellation()
        {
            if (!std::coroutine_handle<promise>::from_promise(*this).cancel_requested())
            {
                std::unreachable();
            }
            e = std::make_exception_ptr(cancelled_exception{});
        }

        void unhandled_exception()
        {
            e = std::current_exception();
        }
    };
};
```

为了在协程之间传播取消状态，可以设计如下awaiter：

```cpp
struct propagate_cancellation_awaiter
{
    std::coroutine_handle<promise> child;

    bool await_ready() { return false; }

    void await_suspend(std::coroutine_handle<promise> parent)
    {
        if (child.cancel_requested())
        {
            parent.request_cancel();
        }

        ...
    }
    void await_resume() {}
};
```

新的API还可以用于避免在所有协程帧中抛出和捕获异常。不同的awaiter可以将异常转换为取消，也可以将取消转换为异常：

```cpp
struct exception_to_cancellation_awaiter
{
    std::coroutine_handle<promise> child;
    bool await_ready() { return false; }
    void await_suspend(std::coroutine_handle<promise> parent)
    {
        if (auto &&e = child.promise().get_exception())
        {
            parent.promise().set_exception(e);
            parent.request_cancel();
        }
        // ...
    }
    void await_resume() {}
};

struct cancellation_to_exception_awaiter
{
    std::coroutine_handle<promise> child;
    std::exception_ptr curr_e;
    bool await_ready() { return false; }
    void await_suspend(std::coroutine_handle<promise> parent)
    {
        if (auto &&e = child.promise().get_exception(); child.cancel_requested() && !e)
        {
            curr_e = std::make_exception_ptr(cancelled_exception{});
        }
        else if (e)
        {
            curr_e = e;
        }
        // ...
    }
    void await_resume()
    {
        if (curr_e)
        {
            std::rethrow_exception(e);
        }
    }
};
```

只有发起异常的协程需要抛出异常，只有处理异常的协程需要捕获异常。中间仅传播异常的协程则完全不会进行抛出或捕获操作。

---
title: Strategies for Implementing POSIX Condition Variables on Win32
date: "2026-04-23 01:07:00"
tags: [C++, coroutines, docs]
category: blog
---

本文是Douglas C. Schmidt和Irfan Pyarali的文章 [Strategies for Implementing POSIX Condition Variables on Win32](http://www.cs.wustl.edu/~schmidt/win32-cv-1.html) 的备份，由于原文链接已经失效。我从 Wayback Machine 重新找到[原文](https://web.archive.org/web/20050212055814/http://www.cs.wustl.edu/~schmidt/win32-cv-1.html)并改写为 markdown。

<!-- more -->

[Douglas C. Schmidt](http://www.cs.wustl.edu/~schmidt) and [Irfan Pyarali](http://www.cs.wustl.edu/~irfan/)
[Department of Computer Science](http://www.cs.wustl.edu/cs/)
[Washington University](http://www.wustl.edu/), [St. Louis, Missouri](http://www.st-louis.mo.us/)

---

## 1. Introduction

The threading API provided by the Microsoft Win32 [Richter] family of operating systems (i. e., Windows NT, Windows 95, and Windows CE) provides some of the same concurrency constructs defined by the POSIX Pthreads specification [Pthreads]. For instance, they both support mutexes, which serialize access to shared state. However, Win32 lacks full-fledged condition variables, which are a synchronization mechanism used by threads to wait until a condition expression involving shared data attains a particular state.

The lack of condition variables in Win32 makes it harder to implement certain concurrency abstractions, such as thread-safe message queues and thread pools. This article explores various techniques and patterns for implementing POSIX condition variables correctly and/or fairly on Win32. Section 2 explains what condition variables are and shows how to use them. Section 3 explains alternative strategies for implementing POSIX condition variables using Win32 synchronization primitives. A subsequent article will describe how the *Wrapper Facade* pattern and various C++ language features can help reduce common mistakes that occur when programming condition variables.

## 2. Overview of POSIX Condition Variables

Condition variables are a powerful synchronization mechanism defined in the POSIX Pthreads specification. They provide a different type of synchronization than locking mechanisms like mutexes. For instance, a mutex is used to cause other threads to wait while the thread holding the mutex executes code in a critical section. In contrast, a condition variable is typically used by a thread to make itself wait until an expression involving shared data attains a particular state.

In general, condition variables are more appropriate than mutexes for situations involving complex condition expressions or scheduling behaviors. For instance, condition variables are often used to implement thread-safe message queues [Schmidt], which provide a `producer/consumer` communication mechanism for passing messages between multiple threads. In this use-case, condition variables block producer threads when a message queue is `full` and block consumer threads when the queue is `empty`.

### 2.1 POSIX Condition Variable Operations

The following are the four primary operations defined on POSIX condition variables:

- `pthread_cond_wait (pthread_cond_t *cv, pthread_mutex_t *external_mutex)` -- This function waits for condition `cv` to be notified. When called, it atomically (1) releases the associated `external_mutex` (which the caller must hold while evaluating the condition expression) and (2) goes to sleep awaiting a subsequent notification from another thread (via the `pthread_cond_signal` or `pthread_cond_broadcast` operations described next). The `external_mutex` will be locked when `pthread_cond_wait` returns.
- `pthread_cond_signal (pthread_cond_t *cv)` -- This function notifies one thread waiting on condition variable `cv`.
- `pthread_cond_broadcast (pthread_cond_t *cv)` -- This function notifies all threads that are current waiting on condition variable `cv`.
- `pthread_cond_timedwait (pthread_cond_t *cv, pthread_mutex_t *external_mutex, const struct timespec *abstime)` -- This function is a time-based variant of `pthread_cond_wait`. It waits up to `abstime` amount of time for `cv` to be notified. If `abstime` elapses before `cv` is notified, the function returns back to the caller with an `ETIME` result, signifying that a timeout has occurred. Even in the case of timeouts, the `external_mutex` will be locked when `pthread_cond_timedwait` returns.

The Pthreads API defines two other operations, `pthread_cond_init` and `pthread_cond_destroy`, which initialize and destroy instances of POSIX condition variables, respectively.

### 2.2. Using Condition Variables to Implement Counting Semaphores

The expression waited upon by a condition variable can be arbitrarily complex. For instance, a thread may need to block until a certain expression involving one or more data items shared by other threads becomes true. To illustrate how this works, we'll implement a counting semaphore abstraction below using condition variables.

Counting semaphores are a synchronization mechanism commonly used to serialize or coordinate multiple threads of control. Conceptually, counting semaphores are non-negative integers that can be incremented and decremented atomically. If a thread tries to decrement a semaphore whose value equals 0 this thread is suspended waiting for another thread to increment the semaphore count above 0.

Counting semaphores are often used to keep track of changes in the state of objects shared by multiple threads in a process. For instance, they can record the occurrence of a particular event. Unlike condition variables, semaphores maintain state. Therefore, they allow threads to make decisions based upon this state, even if the event has occurred in the past.

The standard POSIX Pthreads interface doesn't contain a counting semaphore abstraction. However, it's straightforward to create one using mutexes and condition variables, as shown below.

First, we define a struct that holds the state information necessary to implement a counting semaphore:

```c
typedef struct sema_t
{
    private:
    // Current count of the semaphore.
    u_int count_;
    // Number of threads that have called <sema_wait>.
    u_long waiters_count_;
    // Serialize access to <count_> and <waiters_count_>.
    pthread_mutex_t lock_;
    // Condition variable that blocks the <count_> 0.
    pthread_cond_t count_nonzero_;
} sema_t;
```

Instances of type `sema_t` are created by the following `sema_init` factory (error checking is omitted to save space):

```c
int
sema_init(sema_t *s, u_int initial_count)
{
    pthread_mutex_init(&s->lock_);
    pthread_cond_init(&s->count_nonzero_);
    s->count_ = initial_count;
    s->waiters_count_ = 0;
}
```

The `sema_wait` function shown below blocks the calling thread until the semaphore count pointed to by `s` is greater than `0`, at which point the count is atomically decremented.

```c
int
sema_wait(sema_t *s)
{
    // Acquire mutex to enter critical section.
    pthread_mutex_lock(&s->lock_);

    // Keep track of the number of waiters so that <sema_post> works correctly.
    s->waiters_count_++;

    // Wait until the semaphore count is > 0, then atomically release
    // <lock_> and wait for <count_nonzero_> to be signaled.
    while (s->count_ == 0)
        pthread_cond_wait(&s->count_nonzero_,
            &s->lock_);

    // <s->lock_> is now held.

    // Decrement the waiters count.
    s->waiters_count_--;

    // Decrement the semaphore's count.
    s->count_--;

    // Release mutex to leave critical section.
    pthread_mutex_unlock(&s->lock_);
}
```

The counting semaphore implementation shown above uses a `caller manipulates waiter count` idiom to simplify the synchronization between the `sema_wait` and `sema_post` functions. This synchronization idiom is used elsewhere in this article.

The `sema_post` function atomically increments the semaphore count pointed to by `s`. Only one thread will be unblocked and allowed to continue, regardless of the number of threads blocked on the semaphore.

```c
int
sema_post(sema_t *s)
{
    pthread_mutex_lock(&s->lock_);

    // Always allow one thread to continue if it is waiting.
    if (s->waiters_count_ > 0)
        pthread_cond_signal(&s->count_nonzero_);

    // Increment the semaphore's count.
    s->count_++;

    pthread_mutex_unlock(&s->lock_);
}
```

To further clarify the behavior of counting semaphores, assume there are two threads, **T1** and **T2**, both of which are collaborating via semaphore `sema_t *s`. If **T1** calls `sema_wait` when `s`'s semaphore count is `0` it will block until thread **T2** calls `sema_post`. When **T2** subsequently calls `sema_post`, this function detects if the shared data `waiters_count_` is > `0`, which signifies that thread **T1** is blocked waiting to acquire semaphore `s`.

When thread **T2** signals the condition variable `count_nonzero_` in `sema_post`, thread **T1** is awakened in `pthread_cond_wait`. When thread **T1** is rescheduled and dispatched, it re-evaluates its condition expression, i. e., `s->count_ == 0`. If `count_` is > `0` the `sema_post` function returns to thread **T1**.

Note that a while loop is used to wait for condition variable `count_nonzero_` in `sema_wait`. This condition variable looping idiom [Lea] is necessary since another thread, e. g., **T3**, may have acquired the semaphore first and decremented `s->count_` back to `0` before thread **T1** is awakened. In this example, the while loop ensures that **T1** doesn't return until the semaphore is > `0`. In general, the while loop idiom ensures that threads don't return from `pthread_cond_wait` prematurely.

---

## 3. Implementing Condition Variables on Win32

As shown above, POSIX Pthreads defines condition variables via the `pthread_cond_t` type and its supporting operations. In contrast, the Microsoft Win32 interface does not support condition variables natively. To workaround this omission, many developers write POSIX condition variable emulations using Win32 synchronization primitives such as mutexes, critical sections, semaphores, and events, which are outlined in the sidebar.

---

### Sidebar: Overview of Win32 Synchronization Primitives

Win32 contains a range of synchronization primitives. The primitives used in this article are outlined below.

#### Mutexes

Mutexes are `binary semaphores` that serialize thread access to critical sections. Win32 mutexes are accessed via `HANDLE`s, and can serialize threads within one process or across multiple processes. A single mutex is acquired via `WaitForSingleObject` and `WaitForMultipleObjects` can acquire multiple mutexes. A mutex is released via the `ReleaseMutex` operation.

#### Critical Sections

Critical sections are `lightweight` mutexes that can only serialize threads within a single process. They are more efficient than Win32 mutexes, however, and potentially require only a single hardware instruction on some platforms. In contrast, Win32 mutexes require a system call and is substantially slower. A critical section is acquired via `EnterCriticalSection` and released via `LeaveCriticalSection`.

Although they are slower in some situations, some experiments show that critical sections provide no performance benefit at all when running on an SMP system and two threads are running on different processors and contending for the same critical section. Moreover, Win32 mutexes are also functionally richer than critical sections. For instance, `WaitForMultipleObjects` can be used to wait for multiple waitable objects (mutexes, semaphores, threads, processes, etc). By enabling the `waitAll` parameter, all waitable object `HANDLE`s passed to `WaitForMultipleObjects` can be acquired atomically. The `waitAll` feature supports `all or nothing` synchronization semantics that are not available from critical sections.

#### Semaphores

Win32 semaphores are more general synchronization objects that implement the counting semaphores mechanism described in Section 2.2. Like mutexes, Win32 semaphores can synchronize threads within one process or across multiple processes. A single semaphore is acquired via `WaitForSingleObject` and `WaitForMultipleObjects` can acquire multiple semaphores. A semaphore is released via the `ReleaseSemaphore` operation, which increments the semaphore value by a user-specified amount, which is typically `1`.

#### Events

Win32 events come in two types: (1) auto-reset events and (2) manual-reset events. The semantics of the Win32 event operations, e. g., `SetEvent`, `PulseEvent`, `ResetEvent`, differ depending on what type of event they're operating on. A single event of either type can be waited upon via `WaitForSingleObject` and `WaitForMultipleObjects` can wait for multiple events.

When a manual-reset event is signaled by `SetEvent` it sets the event into the signaled state and wakes up all threads waiting on this event. In contrast, when an auto-reset event is signaled by `SetEvent` and there are any threads waiting, it wakes up one thread and reset the event to the non-signaled state. If there are no threads waiting the event remains signaled until a single waiting thread waits on it and is released.

When a manual-reset event is signaled by `PulseEvent` it wakes up all waiting threads and atomically resets the event. In contrast, if an auto-reset event is signaled by `PulseEvent` and there are any threads waiting, it wakes up one thread. In either case, the auto-reset event is set to the non-signaled state.

Both Win32 events and POSIX condition variables provide similar waiting, signaling, and broadcasting features. For instance, `WaitForMultipleObjects` can acquire a mutex and wait on an event simultaneously via the `waitAll` flag and `SignalObjectAndWait` can release a mutex and wait on an event atomically. These functions provide semantics akin to the `pthread_cond_wait` and `pthread_cond_signal`. Thus, there are instances where either events and condition variables can be used interchangably.

However, extreme care must be taken with Win32 events to ensure that there are no race conditions introduced when switching from one mechanism to another. Unfortunately, there's no way to release just one waiting thread with a manual-reset event. Likewise, there's no way to release all waiting threads with an auto-reset event. This limitation is a major source of difficulty when implementing condition variables, as shown in Section 3.

---

After years of repeatedly seeing Win32 implementations of condition variables posted in newsgroups like `comp.programming.threads` it became apparent that many Win32 implementations are either incorrect or contain subtle problems that can lead to starvation, unfairness, or race conditions. To help developers avoid these problems, this article evaluates common strategies for implementing POSIX condition variables on Win32, illustrating common traps and pitfalls and ways to avoid them.

All these strategies described in this paper are designed for threads in the same process. Note that we use a C-style of C++ programming to focus our emphasis on the steps in each solution.

### 3.1. The PulseEvent Solution

The first solution we'll examine starts by defining a `pthread_cond_t` data structure that contains a pair of Win32 events:

```c
typedef struct pthread_cond_t
{
    enum
    {
        SIGNAL = 0,
        BROADCAST = 1,
        MAX_EVENTS = 2
    };

    HANDLE events_[MAX_EVENTS];
    // Signal and broadcast event HANDLEs.
} pthread_cond_t;
```

In this solution, an auto-reset event (`events_[SIGNAL]`) implements `pthread_cond_signal` and a manual-reset event (`events_[BROADCAST]`) implements `pthread_cond_broadcast`.
Using these synchronization mechanisms, the `pthread_cond_init` initialization function is defined as follows:

```c
int
pthread_cond_init(pthread_cond_t *cv,
const pthread_condattr_t *)
{
    // Create an auto-reset event.
    cv->events_[SIGNAL] = CreateEvent(NULL, // no security
                                      FALSE, // auto-reset event
                                      FALSE, // non-signaled initially
                                      NULL); // unnamed

    // Create a manual-reset event.
    cv->events_[BROADCAST] = CreateEvent(NULL, // no security
                                         TRUE, // manual-reset
                                         FALSE, // non-signaled initially
                                         NULL); // unnamed
}
```

The following three functions implement the core operations of POSIX condition variables (for simplicity, most error handling is omitted in this and other solutions). We'll start by defining a mutual exclusion type for the POSIX `pthread_mutex_t` using a Win32 `CRITICAL_SECTION`, as follows:

```c
typedef CRITICAL_SECTION pthread_mutex_t;
```

The `pthread_cond_wait` function first releases the associated `external_mutex` of type `pthread_mutex_t`, which must be held when the caller checks the condition expression. The function then uses `WaitForMultipleObjects` to wait for either the `SIGNAL` or `BROADCAST` event to become signaled:

```c
int
pthread_cond_wait(pthread_cond_t *cv,
pthread_mutex_t *external_mutex)
{
    // Release the <external_mutex> here and wait for either event
    // to become signaled, due to <pthread_cond_signal> being
    // called or <pthread_cond_broadcast> being called.
    LeaveCriticalSection(external_mutex);
    WaitForMultipleObjects(2, // Wait on both <events_>
                           cv->events_,
                           FALSE, // Wait for either event to be signaled
                           INFINITE); // Wait "forever"

    // Reacquire the mutex before returning.
    EnterCriticalSection(external_mutex);
}
```

Note that the `pthread_cond_timedwait` function can be implemented by mapping its `struct timespec *abstime` parameter into a non-`INFINITE` final argument to `WaitForMultipleObject`.

The `pthread_cond_signal` function tries to wakeup one thread waiting on the condition variable `cv`, as follows:

```c
int
pthread_cond_signal(pthread_cond_t *cv)
{
    // Try to release one waiting thread.
    PulseEvent(cv->events_[SIGNAL]);
}
```

The call to `PulseEvent` on the auto-reset event `cv->events_[SIGNAL]` awakens one waiting thread. The `SIGNAL` event is atomically reset to the non-signaled state, even if no threads are waiting on this event.

The `pthread_cond_broadcast` function is similar, though it wakes up all threads waiting on the condition variable `cv`:

```c
int
pthread_cond_broadcast(pthread_cond_t *cv)
{
    // Try to release all waiting threads.
    PulseEvent(cv->events_[BROADCAST]);
}
```

Calling `PulseEvent` on a manual-reset event releases all threads that are waiting on `cv->events_[BROADCAST]`. As with `pthread_cond_signal`, the state of the event is atomically reset to non-signaled, even if no threads are waiting.

#### Evaluating the PulseEvent Solution

Although the `PulseEvent` solution is concise and `intuitive`, it is also incorrect. The root of the problem is known as the `lost wakeup bug`. This bug occurs from the lack of atomicity between (1) releasing the external mutex and (2) the start of the wait, i. e.:

```c
    LeaveCriticalSection(external_mutex);
    // Potential "lost wakeup bug" here!
    WaitForMultipleObjects(2, cv->events_, FALSE, INFINITE);
```

The lost wakeup bug manifests itself when the calling thread is preempted after releasing the `external_mutex`, but before calling `WaitForMultipleObjects`. In this case, a different thread could acquire the `external_mutex` and perform a `pthread_cond_signal` in between the two calls. Because our signal implementation `pulses` the auto-reset event, the event remain unsignaled. Therefore, when the preempted calling thread resumes and calls `WaitForMultipleObjects` it may find both events non-signaled. In this case, it might wait indefinitely since its wakeup signal got `lost`.

Note that this problem could be trivially solved if Win32 provided some type of `SignalObjectAndWaitMultiple` function that released a mutex or critical section and atomically waited for an array of `HANDLE`s to be signaled.

### 3.2. The SetEvent Solution

One way to avoid the lost wakeup bug is to use the `SetEvent` Win32 functions instead of `PulseEvent`. The second solution, shown below, implements this approach using a `pthread_cond_t` data structure that's similar to the first one. The difference is that it maintains a count of the threads waiting on the condition variable and a `CRITICAL_SECTION` to protect this count, as follows:

```c
typedef struct pthread_cond_t
{
    u_int waiters_count_;
    // Count of the number of waiters.

    CRITICAL_SECTION waiters_count_lock_;
    // Serialize access to <waiters_count_>.

    // Same as before...
} pthread_cond_t;
```

The `pthread_cond_init` initialization function is defined as follows:

```c
int
pthread_cond_init(pthread_cond_t *cv,
const pthread_condattr_t *)
{
    // Initialize the count to 0.
    cv->waiters_count_ = 0;

    // Create an auto-reset and manual-reset event, as before...
}
```

The `pthread_cond_wait` function waits for a condition `cv` and atomically releases the associated `external_mutex` that it holds while checking the condition expression:

```c
int
pthread_cond_wait(pthread_cond_t *cv,
pthread_mutex_t *external_mutex)
{
    // Avoid race conditions.
    EnterCriticalSection(&cv->waiters_count_lock_);
    cv->waiters_count_++;
    LeaveCriticalSection(&cv->waiters_count_lock_);

    // It's ok to release the <external_mutex> here since Win32
    // manual-reset events maintain state when used with
    // <SetEvent>. This avoids the "lost wakeup" bug...
    LeaveCriticalSection(external_mutex);

    // Wait for either event to become signaled due to <pthread_cond_signal>
    // being called or <pthread_cond_broadcast> being called.
    int result = WaitForMultipleObjects(2, cv->events_, FALSE, INFINITE);

    EnterCriticalSection(&cv->waiters_count_lock_);
    cv->waiters_count_--;
    int last_waiter =
        result == WAIT_OBJECT_0 + BROADCAST
        && cv->waiters_count_ == 0;
    LeaveCriticalSection(&cv->waiters_count_lock_);

    // Some thread called <pthread_cond_broadcast>.
    if (last_waiter)
        // We're the last waiter to be notified or to stop waiting, so
        // reset the manual event.
        ResetEvent(cv->events_[BROADCAST]);

    // Reacquire the <external_mutex>.
    EnterCriticalSection(external_mutex);
}
```

The release of the `external_mutex` and the subsequent wait for either of the `events_` to become signaled is still non-atomic. This implementation avoids the lost wakeup bug, however, by relying on the `stickiness` of the manual-reset event, the use of `SetEvent` rather than `PulseEvent`, and the `waiters_count_` count. Note how the last waiter thread in `pthread_cond_wait` resets the `broadcast` manual-reset event to non-signaled before exiting the function. This event is signaled in `pthread_cond_broadcast`, which wakes up **all** threads waiting on the condition variable `cv`, as follows:

```c
int
pthread_cond_broadcast(pthread_cond_t *cv)
{
    // Avoid race conditions.
    EnterCriticalSection(&cv->waiters_count_lock_);
    int have_waiters = cv->waiters_count_ > 0;
    LeaveCriticalSection(&cv->waiters_count_lock_);

    if (have_waiters)
        SetEvent(cv->events_[BROADCAST]);
}
```

Calling `SetEvent` on a manual-reset event sets the `cv->events_[BROADCAST]` event to the signaled state. This releases **all** threads until the event is manually reset in the pthread_cond_wait function above.

The `pthread_cond_signal` function wakes up a thread waiting on the condition variable `cv`:

```c
int
pthread_cond_signal(pthread_cond_t *cv)
{
    // Avoid race conditions.
    EnterCriticalSection(&cv->waiters_count_lock_);
    int have_waiters = cv->waiters_count_ > 0;
    LeaveCriticalSection(&cv->waiters_count_lock_);

    if (have_waiters)
        SetEvent(cv->events_[SIGNAL]);
}
```

Calling `SetEvent` on an auto-reset event will set the `cv->events_[SIGNAL]` event to the signaled state. This releases a single thread and atomically resets the event to the non-signaled state. If there are no waiting threads, the `SetEvent` function is skipped.

#### Evaluating the SetEvent Solution

Although the solution above doesn't suffer from the lost wakeup bug exhibited by the `PulseEvent` implementation, it does have the following drawbacks:

- **Unfairness** -- The semantics of the POSIX `pthread_cond_broadcast` function is to wake up all threads currently blocked in wait calls on the condition variable. The awakened threads then compete for the `external_mutex`. To ensure fairness, all of these threads should be released from their `pthread_cond_wait` calls and allowed to recheck their condition expressions before other threads can successfully complete a wait on the condition variable.

Unfortunately, the `SetEvent` implementation above does not guarantee that all threads sleeping on the condition variable when `cond_broadcast` is called will acquire the `external_mutex` and check their condition expressions. Although the Pthreads specification does not mandate this degree of fairness, the lack of fairness can cause starvation.

To illustrate the unfairness problem, imagine there are 2 threads, **C1** and **C2**, that are blocked in `pthread_cond_wait` on condition variable `not_empty_` that is guarding a thread-safe message queue. Another thread, **P1** then places two messages onto the queue and calls `pthread_cond_broadcast`. If **C1** returns from `pthread_cond_wait`, dequeues and processes the message, and immediately waits again then it and only it may end up acquiring both messages. Thus, **C2** will never get a chance to dequeue a message and run.

The following illustrates the sequence of events:

1. Thread **C1** attempts to dequeue and waits on CV `non_empty_`
2. Thread **C2** attempts to dequeue and waits on CV `non_empty_`
3. Thread **P1** enqueues 2 messages and broadcasts to CV `not_empty_`
4. Thread **P1** exits
5. Thread **C1** wakes up from CV `not_empty_`, dequeues a message and runs
Thread **C1** waits again on CV `not_empty_`, immediately dequeues the 2nd message and runs
6. Thread **C1** exits
7. Thread **C2** is the only thread left and blocks forever since `not_empty_` will never be signaled
8. Depending on the algorithm being implemented, this lack of fairness may yield concurrent programs that have subtle bugs. Of course, application developers should not rely on the fairness semantics of `pthread_cond_broadcast`. Howver, there are many cases where fair implementations of condition variables can simplify application code.

- Incorrectness -- A variation on the unfairness problem described above occurs when a third consumer thread, **C3**, is allowed to slip through even though it was not waiting on condition variable `not_empty_` when a broadcast occurred.

To illustrate this, we will use the same scenario as above: 2 threads, **C1** and **C2**, are blocked dequeuing messages from the message queue. Another thread, **P1** then places two messages onto the queue and calls `pthread_cond_broadcast`. **C1** returns from `pthread_cond_wait`, dequeues and processes the message. At this time, **C3** acquires the `external_mutex`, calls `pthread_cond_wait` and waits on the events in `WaitForMultipleObjects`. Since **C2** has not had a chance to run yet, the `BROADCAST` event is still signaled. **C3** then returns from `WaitForMultipleObjects`, and dequeues and processes the message in the queue. Thus, **C2** will never get a chance to dequeue a message and run.

The following illustrates the sequence of events:

1. Thread **C1** attempts to dequeue and waits on CV `non_empty_`
2. Thread **C2** attempts to dequeue and waits on CV `non_empty_`
3. Thread **P1** enqueues 2 messages and broadcasts to CV `not_empty_`
4. Thread **P1** exits
5. Thread **C1** wakes up from CV `not_empty_`, dequeues a message and runs
6. Thread **C1** exits
7. Thread **C3** waits on CV `not_empty_`, immediately dequeues the 2nd message and runs
8. Thread **C3** exits
9. Thread **C2** is the only thread left and blocks forever since `not_empty_` will never be signaled

In the above case, a thread that was not waiting on the condition variable when a broadcast occurred was allowed to proceed. This leads to incorrect semantics for a condition variable.

- **Increased serialization overhead** -- The implementation shown above uses the `waiters_count_lock_` critical section to protect the `waiters_count_` from being corrupted by race conditions. This additional serialization overhead is not necessary as long as `pthread_cond_signal` and `pthread_cond_broadcast` are always called by a thread that has locked the same `external_mutex` used by `pthread_cond_wait`. For instance, application code that always uses the following idiom does not require this additional serialization:

```c
pthread_mutex_t external_mutex;
pthread_cond_t cv;

void
release_resources(int resources_released)
{
    // Acquire the lock.
    pthread_mutex_lock(&external_mutex);

    // Atomically modify shared state here...

    // Could also use <pthread_cond_broadcast>.
    pthread_cond_signal(&cv);

    // Release the lock.
    pthread_mutex_unlock(&external_mutex);
}
```

In contrast, application code that uses the following optimization does require the additional serialization:

```c
void
release_resources(int resources_released)
{
    // Acquire the lock.
    pthread_mutex_lock(&external_mutex);
    int can_signal = 0;

    // Atomically modify shared state here...

    // Keep track of whether we can signal or not
    // as a result of the updated shared state.
    can_signal = 1;

    // Release the lock.
    pthread_mutex_unlock(&external_mutex);

    if (can_signal)
        // Could also use <pthread_cond_broadcast>.
        pthread_cond_signal(&cv);
}
```

The code shown above puts the `pthread_cond_signal` after the `pthread_mutex_unlock` to minimize the number of trips through the condition variable scheduler. The problem with this optimization, of course, is that race conditions can occur on the `waiters_count_` if it was tested/modified without being protected by the `external_mutex`. Note that the `PulseEvents` solution did not have this race condition since it did not have any directly mutable internal state.

In general, race conditions can occur with condition variable implementations that use internal state if threads don't acquire the `external_mutex` when calling `pthread_cond_signal` and `pthread_cond_broadcast`. The POSIX Pthread specification allows these functions to be called by a thread whether or not that thread has currently locked the `external_mutex`. Therefore, although the use of the internal lock can increase overhead, it is necessary to provide robust, standard-compliant condition variable programming model.

### 3.3. The Generation Count Solution

There are several ways to solve the fairness and correctness problems. The following example illustrates one strategy for alleviating these problems. We start by creating a more sophisticated `pthread_cond_t` struct.

```c
typedef struct pthread_cond_t
{
    int waiters_count_;
    // Count of the number of waiters.

    CRITICAL_SECTION waiters_count_lock_;
    // Serialize access to <waiters_count_>.

    int release_count_;
    // Number of threads to release via a <pthread_cond_broadcast> or a
    // <pthread_cond_signal>.

    int wait_generation_count_;
    // Keeps track of the current "generation" so that we don't allow
    // one thread to steal all the "releases" from the broadcast.

    HANDLE event_;
    // A manual-reset event that's used to block and release waiting
    // threads.
} pthread_cond_t;
```

As shown in the `pthread_cond_t` struct above, this solution uses just one Win32 event. This manual-reset event blocks threads in `pthread_cond_wait` and releases one or more threads in `pthread_cond_signal` and `pthread_cond_broadcast`, respectively. To enhance fairness, this scheme uses (1) a `wait_generation_count_` data member to track real signals/broadcasts and (2) a `release_count_` to control how many threads should be notified for each signal/broadcast.

The following function creates and initializes a condition variable using the generation count implementation:

```c
int
pthread_cond_init(pthread_cond_t *cv,
const pthread_condattr_t *)
{
    cv->waiters_count_ = 0;
    cv->wait_generation_count_ = 0;
    cv->release_count_ = 0;

    // Create a manual-reset event.
    cv->event_ = CreateEvent(NULL,  // no security
                             TRUE,  // manual-reset
                             FALSE, // non-signaled initially
                             NULL); // unnamed
}
```

The `pthread_cond_wait` implementation shown below waits for condition `cv` and atomically releases the associated `external_mutex` that must be held while checking the condition expression:

```c
int
pthread_cond_wait(pthread_cond_t *cv,
pthread_mutex_t *external_mutex)
{
    // Avoid race conditions.
    EnterCriticalSection(&cv->waiters_count_lock_);

    // Increment count of waiters.
    cv->waiters_count_++;

    // Store current generation in our activation record.
    int my_generation = cv->wait_generation_count_;

    LeaveCriticalSection(&cv->waiters_count_lock_);
    LeaveCriticalSection(external_mutex);

    for (;;)
    {
        // Wait until the event is signaled.
        WaitForSingleObject(cv->event_, INFINITE);

        EnterCriticalSection(&cv->waiters_count_lock_);
        // Exit the loop when the <cv->event_> is signaled and
        // there are still waiting threads from this <wait_generation>
        // that haven't been released from this wait yet.
        int wait_done = cv->release_count_ > 0
        && cv->wait_generation_count_!= my_generation;
        LeaveCriticalSection(&cv->waiters_count_lock_);

        if (wait_done)
            break;
    }

    EnterCriticalSection(external_mutex);
    EnterCriticalSection(&cv->waiters_count_lock_);
    cv->waiters_count_--;
    cv->release_count_--;
    int last_waiter = cv->release_count_ == 0;
    LeaveCriticalSection(&cv->waiters_count_lock_);

    if (last_waiter)
        // We're the last waiter to be notified, so reset the manual event.
        ResetEvent(cv->event_);
}
```

This function loops until the `event_` HANDLE is signaled and there are still threads from this `generation` that haven't been released from the wait. The `wait_generation_count_` field is incremented every time the `event_` is signal via `pthread_cond_broadcast` or `pthread_cond_signal`. It tries to eliminate the fairness problems with the `SetEvents` solution by not responding to signal or broadcast notifications that have occurred in a previous `generation`, i. e., **before** the current group of threads started waiting.

The following function notifies a single thread waiting on a condition variable:

```c
int
pthread_cond_signal(pthread_cond_t *cv)
{
    EnterCriticalSection(&cv->waiters_count_lock_);
    if (cv->waiters_count_ > cv->release_count_)
    {
        SetEvent(cv->event_); // Signal the manual-reset event.
        cv->release_count_++;
        cv->wait_generation_count_++;
    }
    LeaveCriticalSection(&cv->waiters_count_lock_);
}
```

Note that we only signal the event if there are more waiters than threads in the generation that is in the midst of being released.

The following implementation of `pthread_cond_broadcast` notifies all threads waiting on a condition variable:

```c
int
pthread_cond_broadcast(pthread_cond_t *cv)
{
    EnterCriticalSection(&cv->waiters_count_lock_);
    if (cv->waiters_count_ > 0)
    {
        SetEvent(cv->event_);
        // Release all the threads in this generation.
        cv->release_count_ = cv->waiters_count_;

        // Start a new generation.
        cv->wait_generation_count_++;
    }
    LeaveCriticalSection(&cv->waiters_count_lock_);
}
```

#### Evaluating the Generation Count Solution

The unfairness problem of the `SetEvent` solution is nominally avoided by having each thread test whether there was actually a signal since it waited or if there are only left-over releases. This prevents one thread from taking more than one release without waiting in a new `generation`. However, the following are the subtle traps and pitfalls with this approach:

1. **Busy-waiting** -- This solution can result in busy-waiting if a waiter has the highest priority thread. The problem is that once `pthread_cond_broadcast signals` the manual-reset `event_` it remains signaled. Therefore, the highest priority thread may cycle endlessly through the for loop in `pthread_cond_wait` and never sleep on the event.
2. **Unfairness** -- The for loop in `pthread_cond_wait` leaves the critical section before calling `WaitForSingleObject`. Thus, it's possible for another thread to acquire the `external_mutex` and call `pthread_cond_signal` or `pthread_cond_broadcast` again during this unprotected region. If this situation occurs, the `wait_generation_count_` will increase, which may cause the waiting thread to break out of the loop prematurely. In this case, the waiting thread can steal a release that was intended for another thread. Therefore, the **Generation Count** solution isn't entirely fair after all!
3. **Serialization overhead** -- Because there is additional state in the `pthread_cond_t` implementation, the internal serialization logic is more complex.

### 3.4. The SignalObjectAndWait Solution

A more complete, albeit more complex, way to achieve fairness is to use a broader set of Win32 synchronization mechanisms. The solution shown below leverages the Windows NT 4.0 `SignalObjectAndWait` function, in conjunction with the following three synchronization mechanisms:

- *A Win32 semaphore (sema_)* -- which is used to queue up threads waiting for the condition to become signaled.
- *A Win32 auto-reset event (waiters_done_)* -- which is used by the broadcast or signaling thread to wait for all the waiting thread(s) to wake up and be released from the semaphore.
- *A Win32 Critical Section (waiters_count_lock_)* -- which serializes access to the count of waiting threads.

This approach yields the following `struct` to implement POSIX condition variables on Win32:

```c
typedef struct pthread_cond_t
{
    int waiters_count_;
    // Number of waiting threads.

    CRITICAL_SECTION waiters_count_lock_;
    // Serialize access to <waiters_count_>.

    HANDLE sema_;
    // Semaphore used to queue up threads waiting for the condition to
    // become signaled.

    HANDLE waiters_done_;
    // An auto-reset event used by the broadcast/signal thread to wait
    // for all the waiting thread(s) to wake up and be released from the
    // semaphore.

    size_t was_broadcast_;
    // Keeps track of whether we were broadcasting or signaling. This
    // allows us to optimize the code if we're just signaling.
} pthread_cond_t;
```

For variety's sake, this solution optimizes the serialization required by assuming that the `external_mutex` is held when `pthread_cond_signal` or `pthread_cond_broadcast` is called. If this optimization is not possible, an extra mutex can be added to `pthread_cond_t` and held for the entire duration of the `pthread_cond_signal`, `pthread_cond_broadcast`, `pthread_cond_wait`, and `pthread_cond_timedwait` calls.

The remainder of this section illustrates how to implement condition variables on Windows NT 4.0 using the `SignalObjectAndWait` function. This function atomically signals one `HANDLE` and waits for another `HANDLE` to become signaled. Since mutexes are accessed via `HANDLE`s, whereas `CRITICAL_SECTIONS` are not, we'll need to typedef a Win32 mutex for the POSIX `pthread_mutex_t` instead of a `CRITICAL_SECTION`:

```c
typedef HANDLE pthread_mutex_t;
```

The `pthread_cond_init` function is defined as follows:

```c
int
pthread_cond_init(pthread_cond_t *cv,
const pthread_condattr_t *)
{
    cv->waiters_count_ = 0;
    cv->was_broadcast_ = 0;
    cv->sema_ = CreateSemaphore(NULL, // no security
                                0,    // initially 0
                                0x7fffffff, // max count
                                NULL); // unnamed
    InitializeCriticalSection(&cv->waiters_count_lock_);
    cv->waiters_done_ = CreateEvent(NULL, // no security
                                   FALSE, // auto-reset
                                   FALSE, // non-signaled initially
                                   NULL); // unnamed
}
```

The `pthread_cond_wait` function uses two steps:

1. It waits for the `sema_` semaphore to be signaled, which indicates that a `pthread_cond_broadcast` or `pthread_cond_signal` has occurred.
2. It sets the `waiters_done_` auto-reset event into the signaled state when the last waiting thread is about to leave the `pthread_cond_wait` critical section.

Step 2 collaborates with the `pthread_cond_broadcast` function described below to ensure fairness. But first, here's the implementation of `pthread_cond_wait`:

```c
int
pthread_cond_wait(pthread_cond_t *cv,
pthread_mutex_t *external_mutex)
{
    // Avoid race conditions.
    EnterCriticalSection(&cv->waiters_count_lock_);
    cv->waiters_count_++;
    LeaveCriticalSection(&cv->waiters_count_lock_);

    // This call atomically releases the mutex and waits on the
    // semaphore until <pthread_cond_signal> or <pthread_cond_broadcast>
    // are called by another thread.
    SignalObjectAndWait(*external_mutex, cv->sema_, INFINITE, FALSE);

    // Reacquire lock to avoid race conditions.
    EnterCriticalSection(&cv->waiters_count_lock_);

    // We're no longer waiting...
    cv->waiters_count_--;

    // Check to see if we're the last waiter after <pthread_cond_broadcast>.
    int last_waiter = cv->was_broadcast_ && cv->waiters_count_ == 0;

    LeaveCriticalSection(&cv->waiters_count_lock_);

    // If we're the last waiter thread during this particular broadcast
    // then let all the other threads proceed.
    if (last_waiter)
        // This call atomically signals the <waiters_done_> event and waits until
        // it can acquire the <external_mutex>. This is required to ensure fairness.
        SignalObjectAndWait(cv->waiters_done_, *external_mutex, INFINITE, FALSE);
    else
        // Always regain the external mutex since that's the guarantee we
        // give to our callers.
        WaitForSingleObject(*external_mutex);
}
```

This implementation of `pthread_cond_wait` ensures that the `external_mutex` is held until all threads waiting on the `cv` have a chance to wait again on the `external_mutex` before returning to their callers. This solution relies on the fact that Windows NT mutex requests are queued in FIFO order, rather than in, e. g., `priority order [MSMutex]`. Because the `external_mutex` queue is serviced in FIFO order, all waiting threads will acquire the external mutex before any of them can reacquire it a second time. This property is essential to ensure fairness.

We use the `SignalObjectAndWait` function to ensure atomicity when signaling one synchronization object (`external_mutex`) and waiting for another synchronization object to become signaled (`cv->sema_`). This is particularly important for the last waiter thread, i. e., the one that signals the broadcasting thread when all waiters are done. If we don't leverage the atomicity of `SignalObjectAndWait`, our solution is potentially unfair since the last waiter thread may not get the chance to wait on the `external_mutex` before one of the other waiters gets it, performs some work, releases and then immediately reacquires `external_mutex`.

The `pthread_cond_signal` function is straightforward since it just releases one waiting thread. Therefore, it simply increments the `sema_` semaphore by 1:

```c
int
pthread_cond_signal(pthread_cond_t *cv)
{
    EnterCriticalSection(&cv->waiters_count_lock_);
    int have_waiters = cv->waiters_count_ > 0;
    LeaveCriticalSection(&cv->waiters_count_lock_);

    // If there aren't any waiters, then this is a no-op.
    if (have_waiters)
        ReleaseSemaphore(cv->sema_, 1, 0);
}
```

The `pthread_cond_broadcast` function is more complex and requires two steps:

1. It wakes up all the threads waiting on the `sema_` semaphore, which can be done atomically by passing the `waiters_count_` to `ReleaseSemaphore`;
2. It then blocks on the auto-reset `waiters_done_` event until the last thread in the group of waiting threads exits the `pthread_cond_wait` critical section.

Here's the code:

```c
int
pthread_cond_broadcast(pthread_cond_t *cv)
{
    // This is needed to ensure that <waiters_count_> and <was_broadcast_> are
    // consistent relative to each other.
    EnterCriticalSection(&cv->waiters_count_lock_);
    int have_waiters = 0;

    if (cv->waiters_count_ > 0)
    {
        // We are broadcasting, even if there is just one waiter...
        // Record that we are broadcasting, which helps optimize
        // <pthread_cond_wait> for the non-broadcast case.
        cv->was_broadcast_ = 1;
        have_waiters = 1;
    }

    if (have_waiters)
    {
        // Wake up all the waiters atomically.
        ReleaseSemaphore(cv->sema_, cv->waiters_count_, 0);

        LeaveCriticalSection(&cv->waiters_count_lock_);

        // Wait for all the awakened threads to acquire the counting
        // semaphore.
        WaitForSingleObject(cv->waiters_done_, INFINITE);
        // This assignment is okay, even without the <waiters_count_lock_> held
        // because no other waiter threads can wake up to access it.
        cv->was_broadcast_ = 0;
    }
    else
    {
        LeaveCriticalSection(&cv->waiters_count_lock_);
    }
}
```

As mentioned above, this solution requires that the `pthread_cond_signal` and `pthread_cond_broadcast` are only called by a thread that's locked the same `external_mutex`.

#### Evaluating the SignalObjectAndWait Solution

Our implementation of `pthread_cond_wait` relied on the `SignalObjectAndWait` function, which was first released with Windows NT 4.0. Although this solution provides fairness, it has more overhead than the earlier solutions. For instance, the `external_mutex` is a mutex rather than a critical section, which increases locking and unlocking overhead. Moreover, the `pthread_cond_wait` and `pthread_cond_broadcast` implementations require additional synchronization operations to ensure fairness when broadcasting.
Unfortunately, the `SignalObjectAndWait` function is not available in Windows CE, Windows '95, or Windows NT 3.51. Therefore, emulating condition variables can be trickier, less `fair`, and more computationally expensive on these Win32 platforms. The next article in this series will show how to develop a portable condition variable implementation for platforms that lack `SignalObjectAndWait`.

## 5. Concluding Remarks

This article illustrates why developing condition variables on Win32 platforms is tricky and error-prone. There are several subtle design forces that must be addressed by developers. In general, the different implementations we've examined vary according to their correctness, efficiency, fairness, and portability. No one solution provides all these qualities optimally.

The `SignalObjectAndWait` solution in Section 3.4 is a good approach if fairness is paramount. However, this approach is not as efficient as other solutions, nor is it as portable. Therefore, if efficiency or portability are more important than fairness, the `SetEvent` approach described in Section 3.2 may be more suitable. Naturally, the easiest solution would be for Microsoft to simply provide condition variables in the Win32 API.

The C++ source code for POSIX condition variable on Win32 described in this article is freely available with the ACE framework at [http://www.dre.vanderbilt.edu/~schmidt/ACE.html](http://www.dre.vanderbilt.edu/~schmidt/ACE.html) or [Github](https://github.com/psigen/ace).

---

## Acknowledgements

Thanks to David Holmes <dholmes@mri.mq.edu.au>, Bil Lewis <Bil@LambdaCS.com>, Alan Conway <aconway@iona.ie>, Kenneth Chiu <chiuk@cs.indiana.edu>, Jason Rosenberg <jason@erdas.com>, James Mansion <james@wgold.demon.co.uk>, Saroj Mahapatra <saroj@bear.com>, Yaacov Fenster <fenster@zk3.dec.com>, John Hickin <John.Hickin.hickin@nt.com> and Patrick Taylor <patrick.taylor@template.com> for many suggestions and constructive comments that helped to improve this paper.

---

## References

- [Cargill] Tom Cargill, “Specific Notification for Java Thread Synchronization”, Proceedings of the Pattern Languages of Programming Conference, Allerton Park, Illinois, August, 1996.
- [GoF] Erich Gamma, Richard Helm, Ralph Johnson, and John Vlissides, Design Patterns: Elements of Reusable Software Architecture, Addison-Wesley, 1995.
- [Lea] Doug Lea, Concurrent Programming with Java, Addison Wesley, 1996.
- [MSMutex] “Mutex Wait is FIFO but Can Be Interrupted”, in Win32 SDK Books Online, Microsoft Corporation, 1995.
- [Pthreads] “Threads Extension for Portable Operating Systems”, IEEE P1003.4a, February, 1996.
- [Richter] Jeffrey Richter, Advanced Windows, 1997, Microsoft Press, Redmond, WA.
- [Schmidt] Douglas C. Schmidt and Steve Vinoski, “Comparing Alternative Programming Techniques for Multi-threaded CORBA Servers: Thread Pool”, C++ Report, Volume 8, No. 4, April, 1996.
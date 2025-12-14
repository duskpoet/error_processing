# Imprisoning the Panic

![bug in a cage](./bugs.jpg)

```rust
let (feature_values, _) = features
        .append_with_names(&self.config.feature_names)
        .unwrap();
```

This single line of code recently made unavailable a significant portion of the Internet throughout the world. Yes, I am talking about the infamous Cloudflare outage of November 2025. A lot of fundamental services like X, Zoom, your favorite AI chats, and, the irony - Downdetector, were totally or partially unavailable. In Rust, unwrapping an error results in a panic, which is exactly what happened, causing the specific proxy service unavailability and therefore the aforementioned chaos.
There are a lot of ways this problem could have been avoided, like making an optional service failure non-critical for the main service, but today I want to specifically inspect how different languages handle unexpected and erroneous situations like the one I've started the article with.

## Premise
For every considered language, I am exploring the go-to approach to error handling, and then imagine the following situation: I am writing a web service that uses a 3rd party library that potentially could break in unexpected ways, and how can I, as a main and responsible developer, protect myself and my product.

## Rust
The default approach in Rust - the Result type - is basically an [Either monad](https://www.sandromaglione.com/articles/either-error-handling-functional-programming). The idea of Either is that a value can be exact one of two types, in our case, it's either a normal, success-path value or an error. Processing a Result value is straightforward - we designate what we do in case of a normal value, and what we do in case of an error:
```rust
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        return Err("division by zero".to_string());
    }
    Ok(a / b)
}

match divide(10.0, 2.0) {
        Ok(result) => println!("Result: {:.2}", result),
        Err(e) => {
            println!("Error: {}", e);
        }
}
```
Everything is nice and smooth until a developer decides to skip this process of the result checkup and forcefully acknowledges that an error cannot happen. In this case, one can use methods like `unwrap`, `expect`, which return a normal value or panic if the result contains an error. Let's see how one can protect oneself against something going wrong.

There is a method `std::panic::catch_unwind` that catches some panics and wraps them into the result type again.
```rust
let result = panic::catch_unwind(|| {
    panic!("oh no!");
)
```

This method catches only panics that are implemented via stack unwinding, so it doesn't work for
* crates that were built with panic = "abort" option.
* panics that happen during the unwinding process
* foreign exceptions (like a C++ throw)

And this method also doesn't catch direct terminations like `process::exit`.

## Go
It may not look like this at first, but Go actually has a very similar approach to error handling:
* there is a special `error` type which is an interface with a single method that returns a string. It could be passed around as any other object
* there is a tuple construct, and any function can return a tuple of arbitrary values

Combining all this, we get the following:
```go
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

result, err := divide(num1, num2)
if err != nil {
        fmt.Println("Oh no, it's an error:", err)
} else {
        fmt.Printf("Result: %f", result)
}
```

So, there is no unwrapping, and result inspection should not cause a panic. But there are other ways to cause a panic in Go, like trying to read a nil value or directly causing a panic with the `panic` function. Luckily, there is a way to catch a panic and process it gracefully:
```go
func main() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("Recovered. Error:\n", r)
        }
    }()
    mayPanic()
    fmt.Println("After mayPanic()")
}
```
There is no way to prevent a process exit with `os.Exit(code)` call, so we can't be fully protected from the foreign code misbehavior.  

## Python
Python uses exceptions as the main error-handling mechanism. There are built-in exceptions, and a developer can define their own exceptions by inheriting from the `Exception` class:
```python
def divide(a, b):
        return a / b
        
try:
        result = divide(10, 0)
except ZeroDivisionError as e: # or "Exception as e" to catch all exceptions
        print("Error:", e)
```

To exit a program, one can use `sys.exit(code)` function, which actually raises a `SystemExit` exception. And that means we can catch it and prevent the abrupt termination of a program. There is also a `os._exit(code)` function that terminates the process immediately without any cleanup and cannot be caught, so there is no way to fully protect from that situation, but it's also a pretty exotic and extreme case.

## Java
Now, Java also uses exceptions as the main error handling mechanism, which is very similar to Python. For a forceful exit there is a `System.exit(code)` or `Runtime.getRuntime().exit(code)` methods that terminate the process, but can be caught by a shutdown hook:
```java
public class ExitProtectionDemo {
    public static void main(String[] args) {
        SecurityManager original = System.getSecurityManager();
        
        try {
            // Install protective security manager
            System.setSecurityManager(new SecurityManager() {
                @Override
                public void checkExit(int status) {
                    throw new SecurityException("Exit blocked: " + status);
                }
                
                @Override
                public void checkPermission(java.security.Permission perm) {
                    // Allow everything else
                }
            });
            
            // This would normally terminate the program
            System.out.println("About to call System.exit()...");
            System.exit(42);
            
        } catch (SecurityException e) {
            System.out.println("Caught: " + e.getMessage());
            System.out.println("Program survived!");
            
        } finally {
            // Restore original security manager
            System.setSecurityManager(original);
        }
    }
}
```

This approach is considered deprecated in newer versions, and it also doesn't catch `Runtime.halt(code)` calls that immediately terminate the JVM.

## Javascript
Once again, Javascript uses exceptions for error handling, with the difference that it's not possible to only catch certain exceptions, so developers should filter out and process inside the `catch` block:
```javascript
function referenceUnknownVariable() {
        return unknownVar;
}

try {
        referenceUnknownVariable();
} catch (ex) {
        if (ex instanceof ReferenceError) {
                console.log("Caught a ReferenceError:", ex.message);
        } else {
                console.error("Unexpected error:", ex);
        }
}
```
It doesn't make much sense to use division by zero as an example, since it's a totally legit operation in Javascript and the result is `Infinity`! That's definitely an interesting way to avoid abrupt termination.
For a forceful exit, there is a `process.exit(code)` method in Node.js, which immediately terminates the process and cannot be caught. But Javascript wouldn't be a [meme](https://www.destroyallsoftware.com/talks/wat) if there wasn't some weird way to work around that:
```javascript
const originalExit = process.exit;
class ExitException extends Error {
        constructor(code) {
                super(`Exit blocked: ${code}`);
                this.code = code;
                
        }
}
process.exit = (code) => {
   throw new ExitException(code);
};

...

originalExit.call(process, code); // when you really want to exit
```

## C++
I won't go into details, C++ has exceptions similar to Java and Python as a main historical mechanism for error handling, but it also has a structure similar to Rust's Result type in the form of `std::expected` (since C++23). There are also forceful termination methods, some of which can be caught via global handlers, and some cannot.

## Summary
From the catch and recovery standpoint, Javascript and Go seem to be the most permissible languages, with Go recovery function and Javascript monkey-patch whatever you want. I don't see obvious gaps in other languages though, so it all comes down to picking the right robust tools for the job. I would suggest scanning 3rd party libraries for any direct process termination calls if this is a critical requirement for your project.

After thorough thinking, I still believe that careful architectural design is the best long-term failure tolerance strategy.
If your service has a non-critical dependency that relies on external setup, make sure that failure of that dependency doesn't block or crash your main service.
Another strategy is to partition your service into multiple clusters and do a gradual rollout of new versions to minimize the blast radius. 
After all, the language is just a tool, and it's up to you not to smack your thumb with it.


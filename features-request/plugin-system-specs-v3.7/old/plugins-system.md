I want you to implement a robust, event-driven plugin system in my application, similar to how WordPress Actions and Filters work. This will allow new functionality to be added without modifying the core codebase. The system should be asynchronous and include error handling to isolate plugin failures.

Here is the step-by-step implementation plan:

1.  **Create the Core `HookRegistry` Service**

    Create a central service or class named `HookRegistry`. It should manage the registration and execution of all plugin hooks.

    *   **Methods:**
        *   `registerAction(hookName: string, callback: Function)`: Registers a callback for an action hook.
        *   `registerFilter(hookName: string, callback: Function)`: Registers a callback for a filter hook.
        *   `async dispatchAction(hookName: string, ...args: any[])`: Asynchronously executes all registered callbacks for an action. It should wrap each callback execution in a `try...catch` block to log errors from a specific plugin without stopping the application.
        *   `async applyFilters(hookName: string, initialValue: any, ...args: any[])`: Asynchronously executes a pipeline of filter callbacks. It passes the return value of one callback as the input to the next. This should also use `try...catch` for each step.

2.  **Implement Plugin Discovery and Loading**

    *   Create a directory named `plugins` at the root of the project.
    *   The `HookRegistry` needs a `loadPlugins()` method that:
        1.  Reads an `active_plugins.json` file to get a list of active plugin directory names.
        2.  For each active plugin, it reads a `plugin.json` manifest file from its directory. This manifest should contain `{ "name": "My Plugin", "version": "1.0.0", "entryPoint": "index.js" }`.
        3.  It then dynamically `imports` the `entryPoint` script for each active plugin. The entry point script is responsible for calling the `registerAction` and `registerFilter` methods.

3.  **Integrate Hooks into the Application**

    This is the most crucial step. Strategically place hooks in the existing application code to create extension points. Here are examples of the kinds of hooks to add:

    *   **Action Hooks (for events):**
        *   After a user successfully authenticates, call:
            `await hookRegistry.dispatchAction('user.authenticated', userObject);`
        *   When a new team is created, call:
            `await hookRegistry.dispatchAction('team.created', teamObject);`
        *   Before the application shuts down, call:
            `await hookRegistry.dispatchAction('app.shutdown');`

    *   **Filter Hooks (for data modification):**
        *   Before displaying a user's name on their profile, wrap it in a filter:
            `const displayName = await hookRegistry.applyFilters('user.profile.displayName', user.fullName, userObject);`
        *   When constructing the list of navigation items in the main menu, allow plugins to add or remove items:
            `const navItems = await hookRegistry.applyFilters('navigation.main.items', defaultNavItems);`

4.  **Create an Example Plugin**

    To prove the system works, create a simple example plugin in `plugins/user-greeter/`:

    *   **`plugins/user-greeter/plugin.json`:**
        ```json
        {
          "name": "User Greeter",
          "version": "1.0.0",
          "entryPoint": "index.js"
        }
        ```

    *   **`plugins/user-greeter/index.js`:**
        ```javascript
        // Assume hookRegistry is a globally accessible instance
        // In a real app, you might use dependency injection

        // Action: Log to console when a user logs in
        hookRegistry.registerAction('user.authenticated', (user) => {
          console.log(`Plugin "User Greeter" says: Hello, ${user.fullName}!`);
        });

        // Filter: Add a "Verified" emoji to the user's display name
        hookRegistry.registerFilter('user.profile.displayName', (currentName, user) => {
          if (user.emailVerified) {
            return `${currentName} ✅`;
          }
          return currentName;
        });
        ```

Finally, add `user-greeter` to the `active_plugins.json` file and ensure the application loads and runs it correctly.

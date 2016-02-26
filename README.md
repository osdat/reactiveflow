# **reactiveflow**

### A reactive dataflow JavaScript library inspired by RStudio's Shiny framework

**Reactiveflow** enables declaration of complicated graphs of data dependencies
that automatically update in batch whenever source nodes are changed.
The model was inspired by [Shiny's reactive programming model](http://shiny.rstudio.com/articles/reactivity-overview.html),
but simplified to handle pure dataflow logic without built-in UI component
integration.  Reactiveflow works in both Node.js and the browser.

# Installation

#### In a browser
```html
<script src="reactiveflow-min.js"></script>
```
The entire library is scoped under the `reactiveflow` namespace.

#### In Node.js

Using npm to install:
```
npm install reactiveflow
```
Loading the module:
```javascript
var reactiveflow = require('reactiveflow');
```

# Main concepts

* A **context** represents a dependency graph of nodes that all update
together.  Contexts are created via `reactiveflow.newContext()`.  All nodes
are associated with the single context they're created within.

* A **node** is an abstract type wrapping an arbitrary value that can be
retrieved via `node.getValue()`.  There are two concrete subtypes of
nodes: sources and conduits (covered below).  You can use
`node.addListener(listener)` to register listeners that are called
whenever the node is updated.  Every node is created with a string id
that must be unique within the context it belongs to.

* A **source** is a type of node that can be directly updated to a new
value via `source.triggerUpdate(newValue)`.  This triggers recursive updates
on all of its dependents.  Alternatively, multiple sources
can be updated at the same time using
<code>context.triggerUpdate(sources,&nbsp;newValues)</code>.
These are the only possible ways of triggering an update.  Sources are
created via <code>context.newSource(id,&nbsp;initVal)</code>.

* A **conduit** is a type of node that only updates in response to updates
in the nodes it depends on.  Conduits are created via
<code>context.newConduit(id,&nbsp;configOpts,&nbsp;updateFunc)</code>.
The `configOpts` argument specifies all the nodes depended on, while
`updateFunc` is the function that's called to compute the conduit's
new value whenever it is triggered to update.

# Simple example

Let's define a simple context containing the node structure below:

![Simple example graph](graphviz_diagrams/simple_example.png?raw=true)

```javascript
// Create a context to define nodes within
var context = reactiveflow.newContext();

// Create all the source nodes with their initial values
var rawFirstName = context.newSource('rawFirstName', 'John');
var rawLastName = context.newSource('rawLastName', 'Chambers');
var format = context.newSource('format', 'lowercase');

// Create conduit nodes to wire up dependencies
var firstName = context.newConduit('firstName',
  {args: [rawFirstName, format]},
  function(args) {
    return (args.format === 'lowercase') ?
      args.rawFirstName.toLowerCase() :
      args.rawFirstName.toUpperCase();
  }
);
var lastName = context.newConduit('lastName',
  {args: [rawLastName, format]},
  function(args) {
    return (args.format === 'lowercase') ?
      args.rawLastName.toLowerCase() :
      args.rawLastName.toUpperCase();
  }
);
var fullName = context.newConduit('fullName',
  {args: [firstName, lastName], initVal: '[initial value]'},
  function(args) {
    return args.firstName + ' ' + args.lastName;
  }
)

// Every node has a value
console.log(rawFirstName.getValue());  // prints: John
console.log(rawLastName.getValue());  // prints: Chambers
console.log(format.getValue());  // prints: lowercase
console.log(fullName.getValue());  // prints: [initial value]
// Conduits that aren't constructed with initVal will make an initial updateFunc call
console.log(firstName.getValue());  // prints: john
console.log(lastName.getValue());  // prints: chambers
```

A couple things to notice:
* In our example, the var name of each source and conduit is identical to
the id it's constructed with.  
(e.g. <code>var <b>format</b> = context.newSource(<b>'format'</b>, 'lowercase');</code>)  
This isn't strictly necessary, but it's
highly recommended for consistency since reactiveflow contexts have no
knowledge of the var names.  The `args` properties passed to each conduit's
`updateFunc` are based on the node ids.
* The call to <code>context.newConduit(id,&nbsp;configOpts,&nbsp;updateFunc)</code>
requires `configOpts` to have an `args` property specifying which nodes the
conduit is dependent on.  `configOpts` can optionally have an `initVal`
property containing the conduit's initial value.  If this property is missing,
`updateFunc` will be called upon construction to compute an initial value.

We've wired up the context but haven't done anything with it yet.
Let's trigger our first update on the `format` source node.

```javascript
format.triggerUpdate('uppercase');

// All dependent conduits are updated
console.log(format.getValue())  // prints: uppercase
console.log(firstName.getValue());  // prints: JOHN
console.log(lastName.getValue());  // prints: CHAMBERS
console.log(fullName.getValue());  // prints: JOHN CHAMBERS
```

Triggering `format` propagates updates to `firstName` and `lastName`, which
in turn cause `fullName` to update.  All this happens in a single synchronous
batch, so `fullName` will only be recomputed once
even though both of its arguments were updated.  This stands in
contrast to a simple asynchronous approach, where a single update to
a node like `format` could result in 2 updates to `fullName`.
In reactiveflow, any `triggerUpdate()` call will only cause a node to
update at most once.

Instead of updating a single source node, you can also update a set of sources
simultaneously:

```javascript
context.triggerUpdate([rawFirstName, rawLastName], ['Hadley', 'Wickham']);

// All dependent conduits are updated
console.log(rawFirstName.getValue())  // prints: Hadley
console.log(rawLastName.getValue())  // prints: Wickham
console.log(firstName.getValue());  // prints: HADLEY
console.log(lastName.getValue());  // prints: WICKHAM
console.log(fullName.getValue());  // prints: HADLEY WICKHAM
```

# Modified example

Let's modify the simple example above to show some more
advanced features.  We're going to create a new context almost
identical to the simple example but with `format` being converted
to *passive* arguments (`pArgs`), represented by dashed gray lines
in the diagram below:

![Modified example graph](graphviz_diagrams/modified_simple_example.png?raw=true)

```javascript
// Create a context to define nodes within
var ctx2 = reactiveflow.newContext();

// Create all the source nodes with their initial values
ctx2.newSource('rawFirstName', 'John');
ctx2.newSource('rawLastName', 'Chambers');
ctx2.newSource('format', 'lowercase');

console.log(ctx2.nodes.rawFirstName.getValue());  // prints: John
```

We created a new context, `ctx2`, and this time we've created sources
without even assigning them to JavaScript variables.  In fact, we don't
really need the variables since we can always retrieve any node
by its id using the `nodes` property on the context.

Next let's define a more generic `nameUpdateFunc` that we'll reuse
for both our `firstName` and `lastName` conduits.

```javascript
var nameUpdateFunc = function(args) {
  return (args.format === 'lowercase') ?
    args.rawName.toLowerCase() :
    args.rawName.toUpperCase();
};
```

Instead of copying the same formatting logic for separate
`firstName` and `lastName` conduits, we access a `rawName`
property in `args`.  This doesn't refer to a valid node id,
so we need to tell each conduit to use `rawName` as an alias
when we construct it:

```javascript
// Create conduit nodes to wire up dependencies
ctx2.newConduit('firstName',
  {args: {rawName: 'rawFirstName'}, pArgs: 'format'},
  nameUpdateFunc
);
ctx2.newConduit('lastName',
  {args: {rawName: 'rawLastName'}, pArgs: 'format'},
  nameUpdateFunc
);

console.log(ctx2.nodes.firstName.getValue());  // prints: john
console.log(ctx2.nodes.lastName.getValue());  // prints: chambers
```

Instead of passing in an array of nodes to `args`, we can pass an
array of objects mapping alias names to nodes.  In fact, we're not
referencing nodes directly here; we can just use their string ids.
When there's only a single node in `args`, there's no need to wrap it
in an array.

The `pArgs` property has identical type expectations
as `args`, but none of the nodes in `pArgs` cause the conduit to update.
They are just passive arguments that show up in the updateFunc's
`args` parameter (as you can see in the definition of `nameUpdateFunc`).

Finally, let's construct the `fullName` conduit.  We'll also add a listener
to track any updates on it.

```javascript
ctx2.newConduit('fullName',
  {args: ['firstName', 'lastName']},
  function(args, currVal) {
    var newVal = args.firstName + ' ' + args.lastName;
    if (newVal === currVal)
      return;  // returning undefined will prevent updating
    return newVal;
  }
)

console.log(ctx2.nodes.fullName.getValue());  // prints: john chambers

// Define and add listener to fullName
var listener = function(value, node) {
  console.log(node.id + ' - ' + value);
};
ctx2.nodes.fullName.addListener(listener);
```

The updateFunc for `fullName` demonstrates a couple additional features.  In
addition to the `args` argument, updateFunc can take a `currVal` argument
that's set to the node's current value.  If updateFunc returns undefined,
the conduit won't be updated and won't propagate updates to its dependents.
(Its dependents can still be triggered to update by other nodes though.)
Since returning undefined prevents an update, none of the conduit's
listeners will be called.

With the wiring complete, let's trigger some updates.

```javascript
ctx2.nodes.format.triggerUpdate('uppercase');
// (fullName listener does NOT trigger)

console.log(ctx2.nodes.firstName.getValue());  // prints: john
console.log(ctx2.nodes.lastName.getValue());  // prints: chambers
```

Since `format` does not have any non-passive dependents, it's the only
node that gets updated here.  If `firstName` or `lastName` were
updated, they would be uppercase, but nothing has triggered them yet.
Let's "update" `rawLastName` to cause `lastName` to update.  We're
going to set `rawLastName` to be the same value that it currently is.
This still triggers an update since reactiveflow doesn't check the
new values for equality.

```javascript
// "Update" rawLastName to be the same value it currently is
ctx2.nodes.rawLastName.triggerUpdate(ctx2.nodes.rawLastName.getValue());
// fullName listener prints: fullname - john CHAMBERS

console.log(ctx2.nodes.firstName.getValue());  // prints: john
console.log(ctx2.nodes.lastName.getValue());  // prints: CHAMBERS
console.log(ctx2.nodes.fullName.getValue());  // prints: john CHAMBERS
```

`lastName` now picks up the new value of its passive `format` argument.
`fullName` is updated due to `lastName`
so the fullName listener is triggered.  Finally, let's perform the
same exact update to `rawLastName` to see `fullName` prevent its own update.

```javascript
// "Update" rawLastName to be the same value it currently is again
ctx2.nodes.rawLastName.triggerUpdate(ctx2.nodes.rawLastName.getValue());
// (fullName listener does NOT trigger)
```

Since the `fullName` updateFunc explicitly compares against its current
value, it prevents an update in this case and therefore prevents
notification of any of its listeners.

This concludes our tour of the primary features of reactiveflow.


# API Reference

By convention, when a *clean map* is mentioned we mean an object created with
`Object.create(null)`.  Such an object has no inherited properties,
so `Object.keys(obj)`, `for (key in obj)` loops, and `key in obj` tests
all work without requiring `hasOwnProperty()`.

All properties that begin with an underscore (e.g. `context._privateProp`)
should be considered private implementation details.

reactiveflow.**version**

* The reactiveflow version string

## context

reactiveflow.**newContext**()

* Constructs a new context

context.**hasId**(*id*)

* Returns true if and only if the context has a node with the given *id*

context.**nodes**

* A *clean map* from all of the context's node ids to its nodes.  This
property and all of its entries should be treated as read-only.

context.**triggerUpdate**(*sources*, *newValues*)

* Triggers a simultaneous update for the array of *sources* to
take on the respective array of *newValues*.  The *sources* array may
contain either source nodes or their id strings.
* Updates will propagate recursively to dependent conduits, but no node will
update more than once in a single `context.triggerUpdate` call.
* Before any conduit is triggered to call its updateFunc, all the nodes
it depends on (including passive arguments) are guaranteed to have already
been updated if they are going to be triggered at all.
(This is accomplished via a topological sort of the dependency graph.)
* All listeners for updated nodes are triggered in batch after all nodes
have already been updated.
* It is an error to make another `triggerUpdate` call while an update
is already in progress.  This means none of the updateFuncs or listeners
are allowed to directly trigger updates in the same context they're in.
One workaround could be to use `setTimeout`, but the possibility of infinite
loops may be a concern.

context.**triggerUpdate**(*sourceMap*)

* A variation of the method above that takes a *sourceMap* from source node
ids to their new values
* e.g. `context.triggerUpdate({source1: 'val1', source2: 'val2'})`

## node

node.**getValue**()

* Returns the node's current value

node.**id**

* The unique string id of the node.  Treat as read-only.

node.**context**

* The context this node belongs to.  Treat as read-only.

node.**addListener**(*listener*)

* Adds a listener that will be called whenever this node is updated
* signature: **listener**(*value*, *node*)
  * `value` is the newly updated value of the node
  * `node` is a reference to the node itself

node.**removeListener**(*listener*)

* Removes the specified listener from this node.  Only one instance of the
listener is removed if it was added multiple times.

node.**removeAllListeners**()

* Removes all listeners from the node

node.**listenerCount**()

* Returns the number of listeners on this node

## source

context.**newSource**(*id*, *initVal*)

* Creates a new source node with *initVal* as the
initial value.  The context must not already have a node with
the given *id*.

source.**triggerUpdate**(*newValue*)

* Triggers an update for the source, propagating to its descendants.
This is equivalent to calling
<code>context.triggerUpdate([source],&nbsp;[newValue])</code>

## conduit

context.**newConduit**(*id*, *configOpts*, *updateFunc*)

* Creates a new conduit node.  The context must not already have a
node with the given *id*.
* *configOpts* must be an object with only the following possible properties:
  * `args` is a mandatory property defining which nodes the conduit is
  dependent on to trigger it to update.
  *args* should consist of an array of "items", where
  each item is either a node, a node id, or a map from aliases to nodes
  or node ids.  If only one item is present, it does not need to be wrapped
  within an array.  Here are a bunch of valid example `args`:
    * `[node1, node2]`
    * `['node1', 'node2']`
    * `'node1'`
    * `[{alias: node1}, node2]`
    * `{alias1: 'node1', alias2: 'node2'}`
  * `pArgs` is an optional property defining passive arguments the conduit
  receives in its *updateFunc* but is not triggered to update by.  It
  is specified in the same possible ways as *args*.  The set of all nodes and
  aliases specified by *args* and *pArgs* must be unique.  (A node can't
  be both in *args* and *pArgs* for the same conduit.)
  * `initVal` is an optional property specifying the initial value
  of the conduit.  If it isn't specified, *updateFunc* is called to compute
  the initial value instead.  This initial call will have *currVal* set
  to `null` and *updateMap* empty.  (See the *updateFunc* signature below.)
* *updateFunc* is the function that's called to compute the conduit's new
value whenever it's triggered to update.  Having *updateFunc* return
`undefined` will prevent the conduit from updating: it
will keep its current value and won't trigger any of its
dependents or listeners.
* signature: **updateFunc**(*args*, *currVal*, *updateMap*, *node*)
  * `args` is a *clean map* from the aliases of this conduit's
  arguments (including passive arguments) to their corresponding values.
  These are all the nodes specified via *args* and *pArgs* in *configOpts*.
  Any argument that wasn't given an alias will use its node id as the "alias"
  by default.
  * `currVal` is the current value of the conduit
  * `updateMap` is a *clean map* from aliases to nodes consisting of
  only the arguments that triggered this conduit to update.  This will never
  include passive arguments since passive arguments don't cause a conduit
  to update.
  * `node` is a reference to the conduit itself


*Note: this library relies on ECMAScript 5 features.*

# reactiveflow

### A reactive dataflow JavaScript library inspired by RStudio's Shiny framework

**Reactiveflow** enables declaration of complicated graphs of data dependencies
that automatically update in batch whenever source nodes are changed.
The model was inspired by [Shiny's reactive programming model](http://shiny.rstudio.com/articles/reactivity-overview.html),
but simplified to handle pure dataflow logic without built-in UI component
integration.

The main concepts in reactiveflow:

* A **context** represents a dependency graph of nodes that all update
together.  They are created via `reactiveflow.newContext()`.  All nodes
are associated with the single context they're created within.

* A **node** is an abstract type wrapping an arbitrary value that can be
retrieved via `node.getValue()`.  There are two concrete subtypes of
nodes: sources and conduits (covered below).  You can use
`node.addListener(listener)` to register listeners that are called
whenever the node is updated.  Every node is created with a string id
that must be unique within the context it belongs to.

* A **source** is a type of node that can be directly updated to a new
value via `source.triggerUpdate(newValue)`.  This causes all its
dependents to be recursively updated.  Alternatively, multiple sources
can be updated at the same time using
<code>context.triggerUpdate(sources,&nbsp;newValues)</code>.
These are the only possible ways of triggering an update.  Sources are
created via <code>context.newSource(id,&nbsp;initVal)</code>.

* A **conduit** is a type of node that only updates in response to updates
in the nodes it depends on.  It is created via
<code>context.newConduit(id,&nbsp;configOpts,&nbsp;updateFunc)</code>.
The `configOpts` argument is an object that must have an `args` property,
an array of the nodes that it actively depends on.  Optionally, `configOpts`
may contain a similar `pArgs` property for "passive argument" nodes that
don't trigger an update in the conduit but are referenced whenever an
update occurs.  The `updateFunc` argument is the function that's
called to compute the conduit's new value whenever it is triggered to update.  

Examples and API reference coming soon...  The Jasmine spec summary may
be of interest in the meantime (spec/jasmine.html)

Note: this library relies on ECMAScript 5 features.
